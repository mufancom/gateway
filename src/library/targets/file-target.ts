import assert from 'assert';

import type {NextFunction, Request, Response} from 'express';

import type {IGatewayTargetDescriptor} from '../target.js';
import {AbstractGatewayTarget} from '../target.js';

export type FileTargetDescriptor = {
  type: 'file';
  target: string;
  options?: FileTargetSendOptions;
} & IGatewayTargetDescriptor;

export class FileTarget extends AbstractGatewayTarget<FileTargetDescriptor> {
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

export type FileTargetSendOptions = {
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
};

export function createIndexFileFallbackMatchPathRegex(prefix = ''): RegExp {
  if (prefix) {
    assert(prefix.startsWith('/'));
    assert(!prefix.endsWith('/'));
  }

  return new RegExp(`^${prefix}(?=(?:/[^.]*)?(?:\\?|$))`);
}
