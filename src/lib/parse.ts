// Contract views return JSON strings. Amounts stay decimal strings: wei above
// 2^53 must never pass through a JS number.
import type { Credits, Game } from "./types.ts";

function parseObject(raw: string): Record<string, unknown> | null {
  try {
    let value: unknown = JSON.parse(raw);
    if (typeof value === "string") value = JSON.parse(value);
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length === 0) return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

const digits = (v: unknown) => typeof v === "string" && /^\d+$/.test(v);

export function parseGame(raw: string): Game | null {
  const o = parseObject(raw);
  if (!o || typeof o.game_id !== "string" || !Array.isArray(o.questions) || !Array.isArray(o.guesses) ||
      typeof o.q_count !== "number" || !digits(o.bond_wei) || typeof o.today !== "number") return null;
  return o as unknown as Game;
}

export function parseCredits(raw: string): Credits | null {
  const o = parseObject(raw);
  if (!o || typeof o.wallet !== "string" || !digits(o.credit_wei)) return null;
  return o as unknown as Credits;
}

export type Limits = {
  rubric_hash?: string; contract_name?: string; version?: string; max_questions?: number;
  min_bond_wei?: string; max_bond_wei?: string; reveal_days?: number; lie_share_divisor?: number;
};

export function parseLimits(raw: string): Limits | null {
  return parseObject(raw) as Limits | null;
}
