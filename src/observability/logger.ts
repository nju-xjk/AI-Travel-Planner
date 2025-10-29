import type { LogLevel } from '../config';

const levelOrder: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export interface LogMeta {
  [key: string]: any;
}

export function createLogger(minLevel: LogLevel = 'info') {
  const should = (lvl: LogLevel) => levelOrder[lvl] >= levelOrder[minLevel];
  const emit = (lvl: LogLevel, message: string, meta?: LogMeta) => {
    if (!should(lvl)) return;
    const entry = {
      ts: new Date().toISOString(),
      level: lvl,
      message,
      ...(meta ? { meta } : {}),
    };
    const line = JSON.stringify(entry);
    if (lvl === 'error' || lvl === 'warn') {
      console.error(line);
    } else {
      console.log(line);
    }
  };

  return {
    debug: (msg: string, meta?: LogMeta) => emit('debug', msg, meta),
    info: (msg: string, meta?: LogMeta) => emit('info', msg, meta),
    warn: (msg: string, meta?: LogMeta) => emit('warn', msg, meta),
    error: (msg: string, meta?: LogMeta) => emit('error', msg, meta),
  };
}