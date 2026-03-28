import config from '../config';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[config.logLevel];
}

function format(level: string, msg: string, data?: unknown): string {
  const ts = new Date().toISOString();
  const extra = data !== undefined ? ' ' + JSON.stringify(data) : '';
  return `[${ts}] [${level.toUpperCase()}] ${msg}${extra}`;
}

export const logger = {
  debug(msg: string, data?: unknown): void {
    if (shouldLog('debug')) console.debug(format('debug', msg, data));
  },
  info(msg: string, data?: unknown): void {
    if (shouldLog('info')) console.log(format('info', msg, data));
  },
  warn(msg: string, data?: unknown): void {
    if (shouldLog('warn')) console.warn(format('warn', msg, data));
  },
  error(msg: string, err?: unknown): void {
    if (shouldLog('error')) {
      const errStr = err instanceof Error ? err.message : String(err ?? '');
      console.error(format('error', msg, errStr || undefined));
    }
  },
};
