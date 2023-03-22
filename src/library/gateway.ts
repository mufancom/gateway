import {EventEmitter} from 'events';
import {Server} from 'http';
import type {ListenOptions} from 'net';

import type {Handler} from 'express';
import Express from 'express';

import type {LogFunction} from './log';
import type {
  GatewayTargetMatchResult,
  IGatewayTarget,
  IGatewayTargetDescriptor,
} from './target';
import type {GatewayTargetDescriptor} from './targets';
import {GATEWAY_TARGET_CONSTRUCTOR_DICT} from './targets';

export interface GatewayOptions {
  listen?: ListenOptions;
  targets: GatewayTargetDescriptor[];
}

export class Gateway extends EventEmitter {
  readonly app = Express();

  readonly server = new Server(this.app);

  private targets: IGatewayTarget<IGatewayTargetDescriptor>[] = [];

  constructor(private options: GatewayOptions) {
    super();

    const {targets: targetDescriptors} = options;

    const {app, targets, log} = this;

    for (const descriptor of targetDescriptors) {
      const Target = GATEWAY_TARGET_CONSTRUCTOR_DICT[descriptor.type];
      targets.push(new Target(descriptor, this, log));
    }

    app.use(this.middleware);
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

  private middleware: Handler = async (
    request,
    response,
    next,
  ): Promise<void> => {
    let target: IGatewayTarget<IGatewayTargetDescriptor> | undefined;
    let match: GatewayTargetMatchResult | undefined;

    for (const candidateTarget of this.targets) {
      const candidateMatch = candidateTarget.match(request);

      if (candidateMatch) {
        target = candidateTarget;
        match = candidateMatch;
        break;
      }
    }

    if (!target) {
      response.status(404).send('No gateway target matched');
      return;
    }

    await target.handle(
      request,
      response,
      next,
      target.buildTargetPath(match!),
    );
  };
}

export interface Gateway {
  emit(event: 'log', data: LogEventData): boolean;

  on(event: 'log', listener: (data: LogEventData) => void): this;
}

export interface LogEventData {
  level: 'info' | 'warn' | 'error';
  /** The event that triggers this log. */
  event: string;
  [key: string]: unknown;
}
