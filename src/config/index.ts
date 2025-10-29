export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface AppConfig {
  env: string;
  port: number;
  jwtSecret: string;
  logLevel: LogLevel;
  requestLog: boolean;
}

export function loadConfig(): AppConfig {
  const env = process.env.NODE_ENV || 'development';
  const port = Number(process.env.PORT || 3000);
  const jwtSecret = process.env.JWT_SECRET || 'dev-secret';
  const logLevel = (process.env.LOG_LEVEL || (env === 'development' ? 'debug' : 'info')) as LogLevel;
  const requestLogEnv = process.env.REQUEST_LOG;
  const requestLog = typeof requestLogEnv === 'string'
    ? requestLogEnv.toLowerCase() !== 'false'
    : env !== 'test';

  return { env, port, jwtSecret, logLevel, requestLog };
}