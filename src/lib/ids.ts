import { keccak256, stringToBytes } from "viem";
import { pyNormalize } from "./pytext.ts";

// Keccak-256 (Ethereum), not NIST SHA3-256. Same payloads as the contract:
//   commitment = keccak256("TWENTY_ASKS:SECRET:V1|" + normalize(secret).lower() + "|" + salt)
//   game id    = keccak256("TWENTY_ASKS:GAME:V1|" + keeper_lower + "|" + commitment)
// normalize is Python " ".join(text.split()); the salt is used exactly as typed.
export function commitmentOf(secret: string, salt: string): string {
  const payload = "TWENTY_ASKS:SECRET:V1|" + pyNormalize(secret).toLowerCase() + "|" + salt;
  return keccak256(stringToBytes(payload)).slice(2);
}

export function gameIdOf(keeper: string, commitment: string): string {
  const payload = "TWENTY_ASKS:GAME:V1|" + keeper.toLowerCase() + "|" + commitment.toLowerCase();
  return keccak256(stringToBytes(payload)).slice(2);
}

const SALT_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/** A fresh 32-character salt from the browser's CSPRNG (rejection sampling, no modulo bias). */
export function randomSalt(length = 32): string {
  const out: string[] = [];
  const limit = 256 - (256 % SALT_ALPHABET.length);
  while (out.length < length) {
    const bytes = new Uint8Array(length * 2);
    globalThis.crypto.getRandomValues(bytes);
    for (const b of bytes) {
      if (b < limit && out.length < length) out.push(SALT_ALPHABET[b % SALT_ALPHABET.length]);
    }
  }
  return out.join("");
}

/** Every 64-hex id found in a bare id, a 0x id, a link or a comma list. */
export function idsFromInput(value: string): string[] {
  const out: string[] = [];
  for (const m of value.matchAll(/(?<![0-9a-fA-F])([0-9a-fA-F]{64})(?![0-9a-fA-F])/g)) {
    const id = m[1].toLowerCase();
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

export function short(value: string, head = 6, tail = 4): string {
  if (!value || value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}
