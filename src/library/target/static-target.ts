import type {Context, Middleware, Next} from 'koa';
import Koa from 'koa';
import Compress from 'koa-compress';
import mount from 'koa-mount';
import Static from 'koa-static';

import type {Gateway} from '../gateway';
import type {LogFunction} from '../log';

import type {IGatewayTargetDescriptor} from './target';
import {AbstractGatewayTarget} from './target';

const STATIC_TARGET_DESCRIPTOR_DEFAULT = {
  compress: {
    br: false,
  },
  static: {},
} as const;

export interface StaticTargetDescriptor extends IGatewayTargetDescriptor {
  type: 'static';
  target: string;
  compress?: Compress.CompressOptions | boolean;
  static?: Static.Options;
}

export class StaticTarget extends AbstractGatewayTarget<StaticTargetDescriptor> {
  private koa = new Koa();

  private baseToMountMap = new Map<string, Middleware>();

  constructor(
    descriptor: StaticTargetDescriptor,
    gateway: Gateway,
    log: LogFunction,
  ) {
    super(descriptor, gateway, log);

    const {
      target,
      compress: compressOptions = STATIC_TARGET_DESCRIPTOR_DEFAULT.compress,
      static: staticOptions,
    } = descriptor;

    const koa = this.koa;

    if (compressOptions) {
      koa.use(
        Compress(
          compressOptions === true
            ? STATIC_TARGET_DESCRIPTOR_DEFAULT.compress
            : compressOptions,
        ),
      );
    }

    koa.use(Static(target, staticOptions));
  }

  async handle(context: Context, next: Next, base: string): Promise<void> {
    if (!base) {
      base = '/';
    }

    const baseToMountMap = this.baseToMountMap;

    let middleware = baseToMountMap.get(base);

    if (!middleware) {
      middleware = mount(base, this.koa);
      baseToMountMap.set(base, middleware);
    }

    await middleware(context, next);
  }
}
