import assert from 'assert';
import {Server} from 'http';

import {Context, Middleware, Next} from 'koa';
import compose from 'koa-compose';
import compress, {CompressOptions} from 'koa-compress';
import send, {SendOptions} from 'koa-send';

import {LogFunction} from '../log';

import {AbstractGatewayTarget, IGatewayTargetDescriptor} from './target';

const FILE_TARGET_DESCRIPTOR_DEFAULT = {
  compress: {
    br: false,
  },
  send: {},
} as const;

export interface FileTargetDescriptor extends IGatewayTargetDescriptor {
  type: 'file';
  target: string;
  compress?: CompressOptions | boolean;
  send?: SendOptions;
}

export class FileTarget extends AbstractGatewayTarget<FileTargetDescriptor> {
  private middleware: Middleware;

  constructor(
    descriptor: FileTargetDescriptor,
    _server: Server,
    log: LogFunction,
  ) {
    super(descriptor, log);

    let {
      target,
      compress: compressOptions = FILE_TARGET_DESCRIPTOR_DEFAULT.compress,
      send: sendOptions,
    } = descriptor;

    let middlewareArray: Middleware[] = [];

    if (compressOptions) {
      middlewareArray.push(
        compress(
          compressOptions === true
            ? FILE_TARGET_DESCRIPTOR_DEFAULT.compress
            : compressOptions,
        ),
      );
    }

    middlewareArray.push(async context => {
      return send(context, target, sendOptions);
    });

    this.middleware = compose(middlewareArray);
  }

  async handle(context: Context, next: Next): Promise<void> {
    let middleware = this.middleware;

    await middleware(context, next);
  }
}

export function createIndexFileFallbackMatchPathRegex(prefix = ''): RegExp {
  if (prefix) {
    assert(prefix.startsWith('/'));
    assert(!prefix.endsWith('/'));
  }

  return new RegExp(`^${prefix}(?=(?:/[^.]*)?(?:\\?|$))`);
}
