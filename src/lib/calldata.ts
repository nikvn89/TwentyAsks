// Byte size of the GenLayer calldata exactly as genlayer-js 1.1.8 builds it
// in writeContract: serialize([encode(makeCalldataObject(method, args)), leaderOnly]).
// Above 255 bytes the RPC answers "RLP string ends with N superfluous bytes".

import { abi } from "genlayer-js";

export const CALLDATA_LIMIT = 255;

export function calldataBytes(method: string, args: unknown[]): number {
  const encoded = abi.calldata.encode(abi.calldata.makeCalldataObject(method, args as any, undefined));
  const serialized = abi.transactions.serialize([encoded, false] as any) as string;
  return (serialized.length - 2) / 2;
}
