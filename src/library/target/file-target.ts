import assert from 'assert';

import type {Context, Middleware, Next} from 'koa';
import compose from 'koa-compose';
import type {CompressOptions} from 'koa-compress';
import Compress from 'koa-compress';
import type {SendOptions} from 'koa-send';
import send from 'koa-send';

import type {Gateway} from '../gateway';
import type {LogFunction} from '../log';

import type {IGatewayTargetDescriptor} from './target';
import {AbstractGatewayTarget} from './target';

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
    gateway: Gateway,
    log: LogFunction,
  ) {
    super(descriptor, gateway, log);

    const {
      target,
      compress: compressOptions = FILE_TARGET_DESCRIPTOR_DEFAULT.compress,
      send: sendOptions,
    } = descriptor;

    const middlewareArray: Middleware[] = [];

    if (compressOptions) {
      middlewareArray.push(
        Compress(
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
    const middleware = this.middleware;

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
