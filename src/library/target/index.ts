import type {Dict} from 'tslang';

import type {FileTargetDescriptor} from './file-target';
import {FileTarget} from './file-target';
import type {ProxyTargetDescriptor} from './proxy-target';
import {ProxyTarget} from './proxy-target';
import type {StaticTargetDescriptor} from './static-target';
import {StaticTarget} from './static-target';
import type {GatewayTargetConstructor} from './target';

export type GatewayTargetDescriptor =
  | ProxyTargetDescriptor
  | StaticTargetDescriptor
  | FileTargetDescriptor;

export const GATEWAY_TARGET_CONSTRUCTOR_DICT: Dict<GatewayTargetConstructor> = {
  proxy: ProxyTarget,
  static: StaticTarget,
  file: FileTarget,
};

export * from './target';
export * from './proxy-target';
export * from './static-target';
export * from './file-target';
