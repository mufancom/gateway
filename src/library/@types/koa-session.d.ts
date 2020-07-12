import 'koa-session';

declare module 'koa-session' {
  interface Session {
    manuallyCommit(): Promise<void>;
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  interface opts {
    autoCommit: boolean;
  }
}
