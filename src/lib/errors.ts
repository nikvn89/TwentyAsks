import { revertReasonFrom } from "./receipt.ts";

const SEEN_KEYS = ["shortMessage", "details", "reason", "message"];
const NEST_KEYS = ["cause", "error", "data", "body"];

function walk(value: unknown, out: string[], depth = 0): void {
  if (!value || depth > 10) return;
  if (typeof value === "string") {
    out.push(value);
    return;
  }
  if (typeof value !== "object") return;
  const rec = value as Record<string, unknown>;
  for (const key of SEEN_KEYS) if (typeof rec[key] === "string") out.push(rec[key] as string);
  for (const key of NEST_KEYS) walk(rec[key], out, depth + 1);
}

/** Pull the contract's real revert sentence out of a viem / genlayer-js error, through every `cause`. */
export function errorMessage(error: unknown): string {
  const parts: string[] = [];
  walk(error, parts);
  const known = revertReasonFrom(parts);
  if (known) return known;
  const joined = parts.join(" | ");
  if (/user rejected|denied transaction|code 4001/i.test(joined)) return "The wallet request was rejected.";
  if (/superfluous bytes/i.test(joined)) return "The RPC rejected the calldata as too long (over 255 bytes). Shorten the text.";
  const first = parts.find((p) => p.trim()) ?? String(error ?? "Unknown error");
  return first.replace(/^Error:\s*/i, "").slice(0, 300);
}
