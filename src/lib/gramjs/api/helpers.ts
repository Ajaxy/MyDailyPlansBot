import type { Api as GramJs } from '..';

type VirtualFields =
  'flags'
  | 'CONSTRUCTOR_ID'
  | 'SUBCLASS_OF_ID'
  | 'className'
  | 'classType'
  | 'getBytes';

export type OmitVirtualFields<T> = Omit<T, VirtualFields>;

export function omitVirtualClassFields<T extends GramJs.VirtualClass<T> & { flags?: unknown }>(
  instance: T,
): OmitVirtualFields<T> {
  const {
    flags,
    CONSTRUCTOR_ID,
    SUBCLASS_OF_ID,
    className,
    classType,
    getBytes,
    ...rest
  } = instance;

  return rest;
}
