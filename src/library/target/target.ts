import {Context, Next} from 'koa';
import {Dict} from 'tslang';

const hasOwnProperty = Object.prototype.hasOwnProperty;

const GATEWAY_TARGET_DESCRIPTOR_DEFAULT = {
  session: true,
};

export interface IGatewayTargetDescriptor {
  type: string;
  match:
    | string
    | RegExp
    | {
        path?: string | RegExp;
        headers?: Dict<string | RegExp | boolean>;
        test?(context: Context): boolean;
      };
  session?: boolean;
}

abstract class GatewayTarget<TDescriptor extends IGatewayTargetDescriptor> {
  constructor(readonly descriptor: TDescriptor) {}

  get sessionEnabled(): boolean {
    let {
      session: sessionEnabled = GATEWAY_TARGET_DESCRIPTOR_DEFAULT.session,
    } = this.descriptor;

    return sessionEnabled;
  }

  abstract handle(context: Context, next: Next, base: string): Promise<void>;

  match(context: Context): string | undefined {
    let {match} = this.descriptor;

    if (typeof match === 'string' || match instanceof RegExp) {
      match = {
        path: match,
      };
    }

    let {path: pathPattern, headers: headerPatternDict, test} = match;

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

    if (test && !test(context)) {
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
> = new (descriptor: TDescriptor) => IGatewayTarget<TDescriptor>;

function matchPath(path: string, pattern: string | RegExp): string | undefined {
  if (typeof pattern === 'string') {
    // E.g. pattern '/app' matches both '/app' and '/app/workbench', not not
    // '/app-workbench'.
    let matched =
      path.startsWith(pattern) &&
      (path.length === pattern.length ||
        pattern[pattern.length - 1] === '/' ||
        path[pattern.length] === '/');

    return matched ? pattern : undefined;
  } else {
    let groups = pattern.exec(path);
    let base = groups ? groups[1] ?? groups[0] : undefined;

    return base !== undefined && path.startsWith(base) ? base : undefined;
  }
}

function matchHeaders(
  headerDict: Dict<string | string[]>,
  headerPatternDict: Dict<string | RegExp | boolean>,
): boolean {
  for (let [name, valuePattern] of Object.entries(headerPatternDict)) {
    let value = hasOwnProperty.call(headerDict, name)
      ? headerDict[name]
      : undefined;

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
