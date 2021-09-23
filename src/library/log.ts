export type LogLevel = 'info' | 'warn' | 'error';

export type LogFunction = (
  level: LogLevel,
  event: string,
  data: object,
) => void;
