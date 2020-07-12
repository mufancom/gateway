import Koa, {Context, Middleware, Next} from 'koa';
import Compress from 'koa-compress';
import mount from 'koa-mount';
import Static from 'koa-static';

import {AbstractGatewayTarget, IGatewayTargetDescriptor} from './target';

const STATIC_TARGET_DESCRIPTOR_DEFAULT = {
  session: false,
  compress: true,
  static: {},
};

export interface StaticTargetDescriptor extends IGatewayTargetDescriptor {
  type: 'static';
  target: string;
  compress?: Compress.CompressOptions | boolean;
  static?: Static.Options;
}

export class StaticTarget extends AbstractGatewayTarget<
  StaticTargetDescriptor
> {
  private koa = new Koa();

  private baseToMountMap = new Map<string, Middleware>();

  constructor(descriptor: StaticTargetDescriptor) {
    super(descriptor);

    let {
      target,
      compress: compressOptions = STATIC_TARGET_DESCRIPTOR_DEFAULT.compress,
      static: staticOptions,
    } = descriptor;

    let koa = this.koa;

    if (compressOptions) {
      koa.use(Compress(compressOptions === true ? {} : compressOptions));
    }

    koa.use(Static(target, staticOptions));
  }

  get sessionEnabled(): boolean {
    let {
      session: sessionEnabled = STATIC_TARGET_DESCRIPTOR_DEFAULT.session,
    } = this.descriptor;

    return sessionEnabled;
  }

  async handle(context: Context, next: Next, base: string): Promise<void> {
    let baseToMountMap = this.baseToMountMap;

    let middleware = baseToMountMap.get(base);

    if (!middleware) {
      middleware = mount(base, this.koa);
      baseToMountMap.set(base, middleware);
    }

    await middleware(context, next);
  }
}
