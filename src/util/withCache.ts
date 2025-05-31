const cache = new WeakMap<AnyFunction, Map<string, any>>();

export default function withCache<T extends AnyFunction>(fn: T) {
  return (...args: Parameters<T>): ReturnType<T> => {
    let fnCache = cache.get(fn);
    const cacheKey = buildCacheKey(args);

    if (fnCache) {
      const cached = fnCache.get(cacheKey);
      if (cached) {
        return cached;
      }
    } else {
      fnCache = new Map();
      cache.set(fn, fnCache);
    }

    const newValue = fn(...args);

    fnCache.set(cacheKey, newValue);

    return newValue;
  };
}

export function buildCacheKey(args: any[]) {
  return args.reduce((cacheKey, arg) => {
    return `${cacheKey}_${typeof arg === 'object' ? JSON.stringify(args) : arg}`;
  }, '');
}
