import { logError } from './logger';

type AnyFunction = (...args: any[]) => any;
type NoneToVoidFunction = () => void;

export default function safeExec<F extends AnyFunction>(
  cb: F,
  rescue?: (err: Error) => void,
  always?: NoneToVoidFunction,
  noLogs = false,
): ReturnType<F> | undefined {
  try {
    return cb();
  } catch (err: any) {
    rescue?.(err);
    if (!noLogs) logError('safeExec', err);
    return undefined;
  } finally {
    always?.();
  }
}

export async function safeExecAsync<F extends AnyFunction>(
  cb: F,
  rescue?: (err: Error) => void,
  always?: NoneToVoidFunction,
  noLogs = false,
): Promise<ReturnType<F> | undefined> {
  try {
    const result = await cb();
    return result;
  } catch (err: any) {
    rescue?.(err);
    if (!noLogs) logError('safeExecAsync', err);
    return undefined;
  } finally {
    always?.();
  }
}
