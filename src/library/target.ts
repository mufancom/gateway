import type {IncomingHttpHeaders} from 'http';

import type {NextFunction, Request, Response} from 'express';
import type {Dict} from 'tslang';

import type {Gateway} from './gateway';
import type {LogFunction} from './log';

const hasOwnProperty = Object.prototype.hasOwnProperty;

export type GatewayTargetMatchFunction = (
  context: MatchRequestContext,
) => GatewayTargetMatchResult | undefined;

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
  target: string;
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

  abstract handle(
    request: Request,
    response: Response,
    next: NextFunction,
    target: string,
  ): Promise<void>;

  match(request: MatchRequestContext): GatewayTargetMatchResult | undefined {
    const {match} = this.descriptor;
    return matchRequest(request, match);
  }

  buildTargetPath({base, path}: GatewayTargetMatchResult): string {
    const {target} = this.descriptor;

    return target.replace('{base}', base).replace('{path}', path);
  }
}

export const AbstractGatewayTarget = GatewayTarget;

export type IGatewayTarget<TDescriptor extends IGatewayTargetDescriptor> =
  GatewayTarget<TDescriptor>;

export interface GatewayTargetMatchResult {
  base: string;
  path: string;
}

declare class GatewayTargetBivariance<
  TTarget extends GatewayTargetGenerics,
> extends GatewayTarget<TTarget['TDescriptor']> {
  override handle(
    request: Request,
    response: Response,
    next: NextFunction,
    target: string,
  ): Promise<void>;
}

export type GatewayTargetConstructor = typeof GatewayTargetBivariance;

export interface MatchRequestContext {
  path: string;
  headers: IncomingHttpHeaders;
}

export function matchRequest(
  context: MatchRequestContext,
  match: GatewayTargetMatchPattern = '',
): GatewayTargetMatchResult | undefined {
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

  const {path, headers} = context;

  let result: GatewayTargetMatchResult | undefined;

  if (pathPattern) {
    result = matchPath(path, pathPattern);

    if (!result) {
      return undefined;
    }
  }

  if (headerPatternDict && !matchHeaders(headers, headerPatternDict)) {
    return undefined;
  }

  return result ?? {base: '', path};
}

function matchPath(
  path: string,
  pattern: GatewayTargetMatchTextPattern,
): GatewayTargetMatchResult | undefined {
  const patterns = Array.isArray(pattern) ? pattern : [pattern];

  for (const pattern of patterns) {
    if (typeof pattern === 'string') {
      // E.g. pattern '/app' matches both '/app' and '/app/workbench', but not
      // '/app-workbench'.
      const matched =
        path.startsWith(pattern) &&
        (path.length === pattern.length ||
          pattern[pattern.length - 1] === '/' ||
          path[pattern.length] === '/');

      if (matched) {
        return {
          base: pattern,
          path: path.slice(pattern.length),
        };
      }
    } else {
      const groups = pattern.exec(path);
      const base = groups ? groups[1] ?? groups[0] : undefined;

      if (typeof base === 'string' && path.startsWith(base)) {
        return {
          base,
          path: path.slice(base.length),
        };
      }
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
