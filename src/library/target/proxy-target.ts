import type {IncomingMessage} from 'http';
import {ServerResponse} from 'http';
import {PassThrough} from 'stream';

import type {ServerOptions} from 'http-proxy';
import type Server from 'http-proxy';
import {createProxyServer} from 'http-proxy';
import type {Context, Next} from 'koa';

import type {Gateway} from '../gateway';
import type {LogFunction} from '../log';

import type {IGatewayTargetDescriptor} from './target';
import {AbstractGatewayTarget} from './target';

const setHeader = ServerResponse.prototype.setHeader;

const WEBSOCKET_ENABLED_DEFAULT = false;

const MAX_REQUEST_SIZE_DEFAULT = 1 * 1024 ** 2; // 1MB

export interface ProxyTargetDescriptor extends IGatewayTargetDescriptor {
  type: 'proxy';
  target: string;
  options?: Omit<ServerOptions, 'target' | 'ignorePath'> & {
    maxRequestSize?: number;
    /**
     * If request is responded by the gateway for some reason (currently if
     * request exceeds `maxRequestSize`), the headers fallback will be used.
     * This option can be used to handle CORS headers.
     */
    responseHeadersFallback?: Record<string, string>;
  };
}

export class ProxyTarget extends AbstractGatewayTarget<ProxyTargetDescriptor> {
  private proxy: Server;

  private maxRequestSize: number;

  private responseHeadersFallback: Record<string, string> | undefined;

  constructor(
    descriptor: ProxyTargetDescriptor,
    gateway: Gateway,
    log: LogFunction,
  ) {
    super(descriptor, gateway, log);

    const {
      options: {
        ws = WEBSOCKET_ENABLED_DEFAULT,
        maxRequestSize = MAX_REQUEST_SIZE_DEFAULT,
        responseHeadersFallback,
        ...options
      } = {},
    } = descriptor;

    this.maxRequestSize = maxRequestSize;
    this.responseHeadersFallback = responseHeadersFallback;

    this.proxy = createProxyServer({
      ...options,
      ws,
      ignorePath: true,
    });

    this.proxy.on('error', error =>
      this.log('error', 'proxy-server-error', {error}),
    );

    if (ws) {
      this.setupWebsocketUpgrade();
    }
  }

  async handle(context: Context, _next: Next, base: string): Promise<void> {
    const {url, request, response, req, res} = context;

    const target = this.buildTargetURL(url, base);

    let setCookieHeaders = response.headers['set-cookie'] as
      | string[]
      | string
      | undefined;

    setCookieHeaders =
      setCookieHeaders === undefined
        ? []
        : typeof setCookieHeaders === 'string'
        ? [setCookieHeaders]
        : setCookieHeaders;

    const originalCookieHeader = request.headers['cookie'];
    const newCookieHeader = setCookieHeaders
      .map(header => header.match(/[^;]+/)![0])
      .join('; ');

    const headers = newCookieHeader
      ? {
          cookie: originalCookieHeader
            ? `${originalCookieHeader}; ${newCookieHeader}`
            : newCookieHeader,
        }
      : undefined;

    res.setHeader = setHeaderOverride;

    let buffer: PassThrough | undefined;

    const maxRequestSize = this.maxRequestSize;

    if (typeof maxRequestSize === 'number') {
      const responseHeadersFallback = this.responseHeadersFallback;

      const contentLength = Number(request.headers['content-length']);

      if (contentLength > maxRequestSize) {
        res.writeHead(413, responseHeadersFallback).end();
        return;
      }

      let buffered = 0;

      buffer = new PassThrough();

      buffer.on('data', (chunk: Buffer) => {
        buffered += chunk.length;

        if (buffered <= maxRequestSize) {
          return;
        }

        res.writeHead(413, responseHeadersFallback).end();
      });

      req.pipe(buffer);
    }

    return new Promise((resolve, reject) => {
      res.on('finish', resolve);

      this.proxy.web(
        req,
        res,
        {
          target,
          headers,
          buffer,
        },
        error => {
          if (error.code === 'ECONNRESET') {
            req.socket.destroy();
            resolve();
          } else {
            reject(error);
          }
        },
      );
    });
  }

  private setupWebsocketUpgrade(): void {
    this.gateway.server.on('upgrade', (req: IncomingMessage, socket, head) => {
      const url = req.url!;

      const base = this.match({
        url,
        path: url.match(/^[^?]*/)![0],
        headers: req.headers,
      });

      if (base === undefined) {
        return;
      }

      const target = this.buildTargetURL(url, base);

      this.proxy.ws(req, socket, head, {
        target,
      });
    });
  }

  private buildTargetURL(url: string, base: string): string {
    const {target} = this.descriptor;

    return `${target.replace('{base}', base)}${url.slice(base.length)}`;
  }
}

function setHeaderOverride(
  this: ServerResponse,
  name: string,
  value: string | number | string[],
): ServerResponse {
  if (name.toLowerCase() === 'set-cookie') {
    const originalValue = this.getHeader('set-cookie');

    if (Array.isArray(originalValue) && typeof value !== 'number') {
      value = [...originalValue, ...(Array.isArray(value) ? value : [value])];
    }
  }

  return setHeader.call(this, name, value);
}
