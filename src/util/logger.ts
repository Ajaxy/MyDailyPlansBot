/* eslint-disable no-console */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private prefix: string;

  constructor(prefix?: string) {
    this.prefix = prefix || '';
  }

  private formatMessage(level: LogLevel, message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    const prefixStr = this.prefix ? `[${this.prefix}] ` : '';
    const levelStr = `[${level.toUpperCase()}]`;

    const logMessage = `${timestamp} ${levelStr} ${prefixStr}${message}`;

    switch (level) {
      case 'debug':
        console.log(logMessage, ...args);
        break;
      case 'info':
        console.log(logMessage, ...args);
        break;
      case 'warn':
        console.warn(logMessage, ...args);
        break;
      case 'error':
        console.error(logMessage, ...args);
        break;
    }
  }

  debug(message: string, ...args: any[]): void {
    this.formatMessage('debug', message, ...args);
  }

  info(message: string, ...args: any[]): void {
    this.formatMessage('info', message, ...args);
  }

  log(message: string, ...args: any[]): void {
    this.info(message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.formatMessage('warn', message, ...args);
  }

  error(message: string, ...args: any[]): void {
    this.formatMessage('error', message, ...args);
  }

  createLogger(prefix: string): Logger {
    const fullPrefix = this.prefix ? `${this.prefix}:${prefix}` : prefix;
    return new Logger(fullPrefix);
  }
}

export const logger = new Logger();

export function createLogger(prefix: string): Logger {
  return new Logger(prefix);
}
