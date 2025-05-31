type CollectionByKey<Member> = Record<number | string, Member>;

export function buildCollectionByKey<T extends AnyLiteral>(collection: T[], key: keyof T) {
  return collection.reduce((byKey: CollectionByKey<T>, member: T) => {
    byKey[member[key]] = member;

    return byKey;
  }, {});
}

export function mapValues<R extends any, M extends any>(
  byKey: CollectionByKey<M>,
  callback: (member: M, key: string, index: number, originalByKey: CollectionByKey<M>) => R,
): CollectionByKey<R> {
  return Object.keys(byKey).reduce((newByKey: CollectionByKey<R>, key, index) => {
    newByKey[key] = callback(byKey[key], key, index, byKey);
    return newByKey;
  }, {});
}

export function pick<T, K extends keyof T>(object: T, keys: K[]) {
  return keys.reduce((result, key) => {
    result[key] = object[key];
    return result;
  }, {} as Pick<T, K>);
}

export function omitUndefined<T extends object>(object: T): T {
  return Object.keys(object).reduce((result, stringKey) => {
    const key = stringKey as keyof T;
    if (object[key] !== undefined) {
      result[key as keyof T] = object[key];
    }
    return result;
  }, {} as T);
}
