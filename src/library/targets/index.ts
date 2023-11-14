import type {Dict} from 'tslang';

import type {GatewayTargetConstructor} from '../target.js';

import type {FileTargetDescriptor} from './file-target.js';
import {FileTarget} from './file-target.js';
import type {ProxyTargetDescriptor} from './proxy-target.js';
import {ProxyTarget} from './proxy-target.js';

export type GatewayTargetDescriptor =
  | ProxyTargetDescriptor
  | FileTargetDescriptor;

export const GATEWAY_TARGET_CONSTRUCTOR_DICT: Dict<GatewayTargetConstructor> = {
  proxy: ProxyTarget,
  file: FileTarget,
};

export * from './file-target.js';
export * from './proxy-target.js';
