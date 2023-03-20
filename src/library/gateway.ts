import assert from 'assert';
import {EventEmitter} from 'events';
import {Server} from 'http';
import type {ListenOptions} from 'net';

import type {Context, Next} from 'koa';
import Koa from 'koa';
import Session from 'koa-session';

import type {LogFunction} from './log';
import type {
  GatewayTargetDescriptor,
  IGatewayTarget,
  IGatewayTargetDescriptor,
} from './target';
import {GATEWAY_TARGET_CONSTRUCTOR_DICT} from './target';

const GATEWAY_OPTIONS_DEFAULT = {
  session: false,
};

export interface GatewayOptions {
  keys?: string[];
  listen?: ListenOptions;
  session?: GatewaySessionOptions | boolean;
  targets: GatewayTargetDescriptor[];
}

export class Gateway extends EventEmitter {
  readonly koa = new Koa();

  readonly server = new Server(this.koa.callback());

  readonly sessionEnabled: boolean;

  private targets: IGatewayTarget<IGatewayTargetDescriptor>[] = [];

  constructor(private options: GatewayOptions) {
    super();

    const {
      keys,
      session: sessionOptions = GATEWAY_OPTIONS_DEFAULT.session,
      targets: targetDescriptors,
    } = options;

    const koa = this.koa;

    if (keys) {
      koa.keys = keys;
    }

    if (sessionOptions) {
      this.sessionEnabled = true;

      if (
        typeof sessionOptions !== 'boolean' &&
        typeof sessionOptions.secure === 'boolean'
      ) {
        const secure = sessionOptions.secure;

        koa.use((context, next) => {
          // Hack koa request so that it initiate cookies with secure option.
          Object.defineProperty(context.request, 'secure', {
            writable: false,
            value: secure,
          });

          return next();
        });
      }

      koa.use(
        Session(
          {
            ...(sessionOptions === true ? undefined : sessionOptions),
            // By calling `save()` it marked session force save on commit.
            // However, it won't reset the force save state after
            // `manuallyCommit()`. This will result in another auto commit that
            // might cause error for proxy target (header already sent). So we
            // disable `autoCommit` altogether.
            autoCommit: false,
          },
          koa,
        ),
      );
    } else {
      this.sessionEnabled = false;
    }

    const targets = this.targets;
    const log = this.log;

    for (const descriptor of targetDescriptors) {
      const Target = GATEWAY_TARGET_CONSTRUCTOR_DICT[descriptor.type];
      targets.push(new Target(descriptor, this, log));
    }

    koa.use(this.middleware);
  }

  serve(listeningListener?: () => void): Server {
    const {listen: listenOptions} = this.options;

    return this.server.listen(listenOptions, listeningListener);
  }

  protected log: LogFunction = (level, event, data) => {
    this.emit('log', {
      level,
      event,
      ...data,
    });
  };

  private middleware = async (context: Context, next: Next): Promise<void> => {
    let target: IGatewayTarget<IGatewayTargetDescriptor> | undefined;
    let base: string | undefined;

    for (const candidateTarget of this.targets) {
      const candidateBase = candidateTarget.match(context);

      if (typeof candidateBase === 'string') {
        assert(context.url.startsWith(candidateBase));

        target = candidateTarget;
        base = candidateBase;
        break;
      }
    }

    if (!target) {
      context.body = 'No gateway target matched';
      return;
    }

    if (this.sessionEnabled && target.sessionEnabled) {
      const session = context.session!;

      if (!session._sessCtx.prevHash) {
        // If session has never been set.
        session.save();
      }

      await context.session!.manuallyCommit();
    }

    await target.handle(context, next, base!);
  };
}

export interface Gateway {
  emit(event: 'log', data: LogEventData): boolean;

  on(event: 'log', listener: (data: LogEventData) => void): this;
}

export interface GatewaySessionOptions
  extends Partial<Omit<Session.opts, 'autoCommit'>> {}

export interface LogEventData {
  level: 'info' | 'warn' | 'error';
  /** The event that triggers this log. */
  event: string;
  [key: string]: unknown;
}
