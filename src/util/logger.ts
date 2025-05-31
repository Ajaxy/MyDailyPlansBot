import { DEBUG } from '../config';

export function logDebug(message: string, ...args: any[]) {
  if (!DEBUG) return;
  // eslint-disable-next-line no-console
  console.debug('[DEBUG]', message, ...args);
}

export function logDebugError(scope: string, ...args: any[]) {
  if (!DEBUG) return;
  // eslint-disable-next-line no-console
  console.error('[DEBUG]', `[${scope}]`, ...args);
}

export function logError(scope: string, error: Error | string | any, ...args: any[]) {
  // eslint-disable-next-line no-console
  console.error(`[ERROR] [${scope}]`, error, ...args);
}

export function logInfo(message: string, ...args: any[]) {
  // eslint-disable-next-line no-console
  console.info(`[INFO] ${message}`, ...args);
}

export function logWarning(message: string, ...args: any[]) {
  // eslint-disable-next-line no-console
  console.warn(`[WARNING] ${message}`, ...args);
}
