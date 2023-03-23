import type {IncomingMessage} from 'http';
import {PassThrough} from 'stream';
import {URL} from 'url';

import type {NextFunction, Request, Response} from 'express';
import type {ServerOptions} from 'http-proxy';
import type Server from 'http-proxy';
import {createProxyServer} from 'http-proxy';

import type {Gateway} from '../gateway';
import type {LogFunction} from '../log';
import type {IGatewayTargetDescriptor} from '../target';
import {AbstractGatewayTarget} from '../target';

const WEBSOCKET_ENABLED_DEFAULT = false;

const MAX_REQUEST_SIZE_DEFAULT = undefined;

export interface ProxyTargetDescriptor extends IGatewayTargetDescriptor {
  type: 'proxy';
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

  private maxRequestSize: number | undefined;

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

  async handle(
    request: Request,
    response: Response,
    _next: NextFunction,
    target: string,
  ): Promise<void> {
    const [, query] = parseURL(request.url!);

    let buffer: PassThrough | undefined;

    const maxRequestSize = this.maxRequestSize;

    if (typeof maxRequestSize === 'number') {
      const responseHeadersFallback = this.responseHeadersFallback;

      const contentLength = Number(request.headers['content-length']);

      if (contentLength > maxRequestSize) {
        response.writeHead(413, responseHeadersFallback).end();
        return;
      }

      let buffered = 0;

      buffer = new PassThrough();

      buffer.on('data', (chunk: Buffer) => {
        buffered += chunk.length;

        if (buffered <= maxRequestSize) {
          return;
        }

        response.writeHead(413, responseHeadersFallback).end();
      });

      request.pipe(buffer);
    }

    return new Promise((resolve, reject) => {
      response.on('finish', resolve);

      this.proxy.web(
        request,
        response,
        {
          target: target + query,
          buffer,
        },
        error => {
          if (error.code === 'ECONNRESET') {
            request.socket.destroy();
            resolve();
          } else {
            reject(error);
          }
        },
      );
    });
  }

  private setupWebsocketUpgrade(): void {
    this.gateway.server.on(
      'upgrade',
      (request: IncomingMessage, socket, head) => {
        const [path, query] = parseURL(request.url!);

        const match = this.match({
          path,
          headers: request.headers,
        });

        if (match === undefined) {
          return;
        }

        const target = this.buildTargetPath(match) + query;

        this.proxy.ws(request, socket, head, {
          target,
        });
      },
    );
  }
}

function parseURL(url: string): [path: string, query: string] {
  const {pathname, search} = new URL(url, 'protocol://hostname');
  return [pathname, search];
}
