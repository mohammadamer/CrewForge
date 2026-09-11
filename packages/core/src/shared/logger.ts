export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export interface ConsoleLoggerOptions {
  level?: LogLevel;
}

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

/** Minimal console-backed logger. Replace via dependency injection for structured logging. */
export class ConsoleLogger implements Logger {
  private readonly level: LogLevel;

  constructor(options: ConsoleLoggerOptions = {}) {
    this.level = options.level ?? 'info';
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.log('error', message, meta);
  }

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.level]) return;
    const line = `[crewforge] [${level}] ${message}`;
    const consoleMethod = level === 'debug' ? console.log : console[level];
    if (meta) {
      consoleMethod(line, meta);
    } else {
      consoleMethod(line);
    }
  }
}
