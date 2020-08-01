import {IncomingHttpHeaders} from 'http';

import {Context, Next} from 'koa';
import {Dict} from 'tslang';

import {LogFunction} from '../log';

const hasOwnProperty = Object.prototype.hasOwnProperty;

const GATEWAY_TARGET_DESCRIPTOR_DEFAULT = {
  session: true,
};

export interface GatewayTargetMatchContext {
  url: string;
  path: string;
  headers: IncomingHttpHeaders;
}

export type GatewayTargetMatchFunction = (
  context: GatewayTargetMatchContext | Context,
) => string | undefined;

export interface IGatewayTargetDescriptor {
  type: string;
  match?:
    | string
    | string[]
    | RegExp
    | GatewayTargetMatchFunction
    | {
        path?: string | string[] | RegExp;
        headers?: Dict<string | RegExp | boolean>;
      };
  session?: boolean;
}

abstract class GatewayTarget<TDescriptor extends IGatewayTargetDescriptor> {
  constructor(
    readonly descriptor: TDescriptor,
    protected readonly log: LogFunction,
  ) {}

  get sessionEnabled(): boolean {
    let {
      session: sessionEnabled = GATEWAY_TARGET_DESCRIPTOR_DEFAULT.session,
    } = this.descriptor;

    return sessionEnabled;
  }

  abstract handle(context: Context, next: Next, base: string): Promise<void>;

  match(context: GatewayTargetMatchContext): string | undefined {
    let {match = ''} = this.descriptor;

    if (
      typeof match === 'string' ||
      Array.isArray(match) ||
      match instanceof RegExp
    ) {
      match = {
        path: match,
      };
    }

    if (typeof match === 'function') {
      return match(context);
    }

    let {path: pathPattern, headers: headerPatternDict} = match;

    let base: string | undefined = '';

    if (pathPattern) {
      base = matchPath(context.path, pathPattern);

      if (base === undefined) {
        return undefined;
      }
    }

    if (
      headerPatternDict &&
      !matchHeaders(context.headers, headerPatternDict)
    ) {
      return undefined;
    }

    return base;
  }
}

export const AbstractGatewayTarget = GatewayTarget;

export type IGatewayTarget<
  TDescriptor extends IGatewayTargetDescriptor
> = GatewayTarget<TDescriptor>;

export type GatewayTargetConstructor<
  TDescriptor extends IGatewayTargetDescriptor
> = new (descriptor: TDescriptor, log: LogFunction) => IGatewayTarget<
  TDescriptor
>;

function matchPath(
  path: string,
  pattern: string | string[] | RegExp,
): string | undefined {
  if (typeof pattern === 'string') {
    pattern = [pattern];
  }

  if (Array.isArray(pattern)) {
    for (let stringPattern of pattern) {
      // E.g. pattern '/app' matches both '/app' and '/app/workbench', not not
      // '/app-workbench'.
      let matched =
        path.startsWith(stringPattern) &&
        (path.length === stringPattern.length ||
          stringPattern[stringPattern.length - 1] === '/' ||
          path[stringPattern.length] === '/');

      if (matched) {
        return stringPattern;
      }
    }

    return undefined;
  } else {
    let groups = pattern.exec(path);
    let base = groups ? groups[1] ?? groups[0] : undefined;

    return base !== undefined && path.startsWith(base) ? base : undefined;
  }
}

function matchHeaders(
  headers: IncomingHttpHeaders,
  headerPatternDict: Dict<string | RegExp | boolean>,
): boolean {
  for (let [name, valuePattern] of Object.entries(headerPatternDict)) {
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
