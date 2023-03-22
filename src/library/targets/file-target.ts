import assert from 'assert';

import type {NextFunction, Request, Response} from 'express';

import type {Gateway} from '../gateway';
import type {LogFunction} from '../log';
import type {IGatewayTargetDescriptor} from '../target';
import {AbstractGatewayTarget} from '../target';

export interface FileTargetDescriptor extends IGatewayTargetDescriptor {
  type: 'file';
  target: string;
  options?: FileTargetSendOptions;
}

export class FileTarget extends AbstractGatewayTarget<FileTargetDescriptor> {
  constructor(
    descriptor: FileTargetDescriptor,
    gateway: Gateway,
    log: LogFunction,
  ) {
    super(descriptor, gateway, log);
  }

  async handle(
    _request: Request,
    response: Response,
    _next: NextFunction,
    target: string,
  ): Promise<void> {
    const {
      descriptor: {options},
    } = this;

    response.sendFile(target, options);
  }
}

export interface FileTargetSendOptions {
  /**
   * defaulting to 0 (can be string converted by `ms`)
   */
  maxAge?: number | string;
  /**
   * root directory for relative filenames
   */
  root?: string;
  /**
   * object of headers to serve with file
   */
  headers?: Record<string, string>;
  /**
   * serve dotfiles, defaulting to false; can be `"allow"` to send them
   */
  dotfiles?: 'allow' | false;
}

export function createIndexFileFallbackMatchPathRegex(prefix = ''): RegExp {
  if (prefix) {
    assert(prefix.startsWith('/'));
    assert(!prefix.endsWith('/'));
  }

  return new RegExp(`^${prefix}(?=(?:/[^.]*)?(?:\\?|$))`);
}
