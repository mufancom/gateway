import {Dict} from 'tslang';

import {FileTarget, FileTargetDescriptor} from './file-target';
import {ProxyTarget, ProxyTargetDescriptor} from './proxy-target';
import {StaticTarget, StaticTargetDescriptor} from './static-target';
import {GatewayTargetConstructor, IGatewayTargetDescriptor} from './target';

export type GatewayTargetDescriptor =
  | ProxyTargetDescriptor
  | StaticTargetDescriptor
  | FileTargetDescriptor;

export const GATEWAY_TARGET_CONSTRUCTOR_DICT: Dict<
  GatewayTargetConstructor<IGatewayTargetDescriptor>
> = {
  proxy: ProxyTarget,
  static: StaticTarget,
  file: FileTarget,
};

export * from './target';
export * from './proxy-target';
export * from './static-target';
export * from './file-target';
