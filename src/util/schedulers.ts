export const pause = (ms: number) => new Promise<void>((resolve) => {
  setTimeout(() => resolve(), ms);
});

export function throttle<F extends AnyToVoidFunction>(
  fn: F,
  ms: number,
  shouldRunFirst = true,
) {
  let interval: NodeJS.Timeout | undefined;
  let isPending: boolean;
  let args: Parameters<F>;

  return (..._args: Parameters<F>) => {
    isPending = true;
    args = _args;

    if (!interval) {
      if (shouldRunFirst) {
        isPending = false;
        fn(...args);
      }

      // eslint-disable-next-line no-restricted-globals
      interval = setInterval(() => {
        if (!isPending) {
          // eslint-disable-next-line no-restricted-globals
          clearInterval(interval!);
          interval = undefined;
          return;
        }

        isPending = false;
        fn(...args);
      }, ms);
    }
  };
}
