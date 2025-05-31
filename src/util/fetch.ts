import { DEFAULT_ERROR_PAUSE, DEFAULT_RETRIES, DEFAULT_TIMEOUT } from '../config/ton';
import { logDebug, logError } from './logger';
import { pause } from './schedulers';

export type FetchOptions = {
  retries?: number;
  timeout?: number | number[];
  conditionFn?: (message?: string, statusCode?: number) => boolean;
};

const MAX_TIMEOUT = 60000; // 60 sec

export async function fetchWithRetry(url: string | URL, init?: RequestInit, options?: FetchOptions) {
  const {
    retries = DEFAULT_RETRIES,
    timeout = DEFAULT_TIMEOUT,
    conditionFn,
  } = options ?? {};

  let message = 'Unknown error.';
  let statusCode: number | undefined;
  let lastError: Error | undefined;

  for (let i = 1; i <= retries; i++) {
    try {
      if (i > 1) {
        logDebug(`Retry request #${i - 1}:`, url.toString(), statusCode);
      }

      const currentTimeout = Array.isArray(timeout)
        ? timeout[i - 1] ?? timeout[timeout.length - 1]
        : Math.min(timeout * i, MAX_TIMEOUT);

      const response = await fetchWithTimeout(url, init, currentTimeout);
      statusCode = response.status;

      if (statusCode >= 400) {
        if (response.headers.get('content-type') !== 'application/json') {
          throw new Error(`HTTP Error ${statusCode}`);
        }
        const data = await response.json() as any;
        throw new Error(`HTTP Error ${statusCode} ${data.error ?? data.message ?? JSON.stringify(data)}`);
      }

      return response;
    } catch (err: any) {
      lastError = err;
      message = typeof err === 'string' ? err : err.message ?? message;

      if (statusCode === 400 || statusCode === 404 || conditionFn?.(message, statusCode)) {
        throw err;
      }

      if (i < retries) {
        await pause(DEFAULT_ERROR_PAUSE * i);
      }
    }
  }

  const logMessage = [message, '\n', 'Request error', init?.method ?? 'GET', url.toString()].join(' ');
  logError('fetchWithTimeout', logMessage, init?.body, lastError?.name);

  throw lastError ?? new Error(message);
}

export async function fetchWithTimeout(url: string | URL, init?: RequestInit, timeout = DEFAULT_TIMEOUT) {
  const controller = new AbortController();
  const id = setTimeout(() => {
    controller.abort();
  }, timeout);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(id);
  }
}
