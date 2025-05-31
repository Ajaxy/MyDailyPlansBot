import { BigInteger } from 'big-integer';

export default function toNativeBigInt(bigInteger: BigInteger) {
  return BigInt(bigInteger.toString());
}
