import type {IncomingHttpHeaders} from 'http';

import type {Next} from 'koa';
import type {Dict} from 'tslang';

import type {Gateway} from '../gateway';
import type {LogFunction} from '../log';

const hasOwnProperty = Object.prototype.hasOwnProperty;

export interface GatewayTargetMatchContext {
  url: string;
  path: string;
  headers: IncomingHttpHeaders;
}

export type GatewayTargetMatchFunction = (
  context: GatewayTargetMatchContext,
) => string | undefined;

export type GatewayTargetMatchTextPattern =
  | string
  | RegExp
  | (string | RegExp)[];

export type GatewayTargetMatchPattern =
  | GatewayTargetMatchTextPattern
  | GatewayTargetMatchFunction
  | {
      path?: GatewayTargetMatchTextPattern;
      headers?: Dict<string | RegExp | boolean>;
    };

export interface IGatewayTargetDescriptor {
  type: string;
  match?: GatewayTargetMatchPattern;
  session?: boolean;
}

export interface GatewayTargetGenerics<
  TDescriptor extends IGatewayTargetDescriptor = IGatewayTargetDescriptor,
> {
  TDescriptor: TDescriptor;
}

abstract class GatewayTarget<TDescriptor extends IGatewayTargetDescriptor> {
  declare TDescriptor: TDescriptor;

  constructor(
    readonly descriptor: TDescriptor,
    readonly gateway: Gateway,
    protected readonly log: LogFunction,
  ) {}

  get sessionEnabled(): boolean {
    const {session: sessionEnabled} = this.descriptor;

    if (this.gateway.sessionEnabled) {
      return sessionEnabled ?? true;
    } else {
      if (sessionEnabled) {
        throw new Error('Session is not enabled in gateway');
      }

      return false;
    }
  }

  abstract handle(
    context: GatewayTargetMatchContext,
    next: Next,
    base: string,
  ): Promise<void>;

  match(context: GatewayTargetMatchContext): string | undefined {
    const {match} = this.descriptor;
    return matchContext(context, match);
  }
}

export const AbstractGatewayTarget = GatewayTarget;

export type IGatewayTarget<TDescriptor extends IGatewayTargetDescriptor> =
  GatewayTarget<TDescriptor>;

declare class GatewayTargetBivariance<
  TTarget extends GatewayTargetGenerics,
> extends GatewayTarget<TTarget['TDescriptor']> {
  override handle(
    context: GatewayTargetMatchContext,
    next: Next,
    base: string,
  ): Promise<void>;
}

export type GatewayTargetConstructor = typeof GatewayTargetBivariance;

export function matchContext(
  context: GatewayTargetMatchContext,
  match: GatewayTargetMatchPattern = '',
): string | undefined {
  if (
    typeof match === 'string' ||
    match instanceof RegExp ||
    Array.isArray(match)
  ) {
    match = {
      path: match,
    };
  }

  if (typeof match === 'function') {
    return match(context);
  }

  const {path: pathPattern, headers: headerPatternDict} = match;

  let base: string | undefined = '';

  if (pathPattern) {
    base = matchPath(context.path, pathPattern);

    if (base === undefined) {
      return undefined;
    }
  }

  if (headerPatternDict && !matchHeaders(context.headers, headerPatternDict)) {
    return undefined;
  }

  return base;
}

function matchPath(
  path: string,
  pattern: GatewayTargetMatchTextPattern,
): string | undefined {
  const patterns = Array.isArray(pattern) ? pattern : [pattern];

  for (const pattern of patterns) {
    if (typeof pattern === 'string') {
      // E.g. pattern '/app' matches both '/app' and '/app/workbench', not not
      // '/app-workbench'.
      const matched =
        path.startsWith(pattern) &&
        (path.length === pattern.length ||
          pattern[pattern.length - 1] === '/' ||
          path[pattern.length] === '/');

      if (matched) {
        return pattern;
      }
    } else {
      const groups = pattern.exec(path);
      const base = groups ? groups[1] ?? groups[0] : undefined;

      return base !== undefined && path.startsWith(base) ? base : undefined;
    }
  }

  return undefined;
}

function matchHeaders(
  headers: IncomingHttpHeaders,
  headerPatternDict: Dict<string | RegExp | boolean>,
): boolean {
  for (const [name, valuePattern] of Object.entries(headerPatternDict)) {
    let value = hasOwnProperty.call(headers, name) ? headers[name] : undefined;

    if (typeof valuePattern === 'boolean') {
      if (valuePattern ? value === undefined : value !== undefined) {
        return false;
      }
    } else {
      if (value === undefined) {
        return false;
      }

      if (typeof value === 'string') {
        value = [value];
      }

      if (typeof valuePattern === 'string') {
        if (!value.some(singleValue => singleValue === valuePattern)) {
          return false;
        }
      } else {
        if (
          !value.some(singleValue => (valuePattern as RegExp).test(singleValue))
        ) {
          return false;
        }
      }
    }
  }

  return true;
}
