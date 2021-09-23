import {IncomingMessage, OutgoingMessage, Server as HTTPServer} from 'http';

import Server, {ServerOptions, createProxyServer} from 'http-proxy';
import {Context, Next} from 'koa';

import {LogFunction} from '../log';

import {AbstractGatewayTarget, IGatewayTargetDescriptor} from './target';

const setHeader = OutgoingMessage.prototype.setHeader;

export interface ProxyTargetDescriptor extends IGatewayTargetDescriptor {
  type: 'proxy';
  target: string;
  options?: Omit<ServerOptions, 'target' | 'ignorePath'>;
}

export class ProxyTarget extends AbstractGatewayTarget<ProxyTargetDescriptor> {
  private proxy: Server;

  private websocketUpgradeInitialized = false;

  constructor(descriptor: ProxyTargetDescriptor, log: LogFunction) {
    super(descriptor, log);

    let {options} = descriptor;

    this.proxy = createProxyServer({...options, ignorePath: true});

    this.proxy.on('error', error => this.log('proxy-server-error', {error}));
  }

  async handle(context: Context, _next: Next, base: string): Promise<void> {
    let {options: {ws: websocketEnabled = false} = {}} = this.descriptor;

    if (websocketEnabled) {
      this.ensureWebsocketUpgrade(context);
    }

    let target = this.buildTargetURL(context.url, base);

    let setCookieHeaders = context.response.headers['set-cookie'] as
      | string[]
      | string
      | undefined;

    setCookieHeaders =
      setCookieHeaders === undefined
        ? []
        : typeof setCookieHeaders === 'string'
        ? [setCookieHeaders]
        : setCookieHeaders;

    let originalCookieHeader = context.request.headers['cookie'];
    let newCookieHeader = setCookieHeaders
      .map(header => header.match(/[^;]+/)![0])
      .join('; ');

    let headers = newCookieHeader
      ? {
          cookie: originalCookieHeader
            ? `${originalCookieHeader}; ${newCookieHeader}`
            : newCookieHeader,
        }
      : undefined;

    let req = context.req;
    let res = context.res;

    res.setHeader = setHeaderOverride;

    return new Promise((resolve, reject) => {
      res.on('finish', resolve);

      this.proxy.web(
        req,
        res,
        {
          target,
          headers,
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

  private ensureWebsocketUpgrade(context: Context): void {
    if (this.websocketUpgradeInitialized) {
      return;
    }

    this.websocketUpgradeInitialized = true;

    let server = (context.req.connection as any).server as HTTPServer;

    server.on('upgrade', (req: IncomingMessage, socket, head) => {
      let url = req.url!;

      let base = this.match({
        url,
        path: url.match(/^[^?]*/)![0],
        headers: req.headers,
      });

      if (base === undefined) {
        return;
      }

      let target = this.buildTargetURL(url, base);

      this.proxy.ws(req, socket, head, {
        target,
      });
    });
  }

  private buildTargetURL(url: string, base: string): string {
    let {target} = this.descriptor;

    return `${target.replace('{base}', base)}${url.slice(base.length)}`;
  }
}

function setHeaderOverride(
  this: OutgoingMessage,
  name: string,
  value: string | number | string[],
): void {
  if (name.toLowerCase() === 'set-cookie') {
    let originalValue = this.getHeader('set-cookie');

    if (Array.isArray(originalValue) && typeof value !== 'number') {
      value = [...originalValue, ...(Array.isArray(value) ? value : [value])];
    }
  }

  return setHeader.call(this, name, value);
}
