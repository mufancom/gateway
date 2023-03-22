import type {Dict} from 'tslang';

import type {GatewayTargetConstructor} from '../target';

import type {FileTargetDescriptor} from './file-target';
import {FileTarget} from './file-target';
import type {ProxyTargetDescriptor} from './proxy-target';
import {ProxyTarget} from './proxy-target';

export type GatewayTargetDescriptor =
  | ProxyTargetDescriptor
  | FileTargetDescriptor;

export const GATEWAY_TARGET_CONSTRUCTOR_DICT: Dict<GatewayTargetConstructor> = {
  proxy: ProxyTarget,
  file: FileTarget,
};

export * from './proxy-target';
export * from './file-target';
