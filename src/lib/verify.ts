// Postconditions checked AFTER the receipt says SUCCESS, against reloaded
// accepted state. A write is reported as done only when the state shows it.

import { pyStrip } from "./pytext.ts";
import type { Credits, Game } from "./types.ts";

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const big = (v: string | undefined | null) => BigInt(v ?? "0");

export function openVerified(g: Game | null, s: { id: string; me: string; commitment: string; bondWei: bigint }): boolean {
  return !!g && g.game_id === s.id && same(g.keeper, s.me) && g.commitment === s.commitment && big(g.bond_wei) === s.bondWei &&
    g.state === "ASKING" && g.q_count === 0 && !g.pending && g.reveal_deadline_day === g.opened_day + 3;
}

export function askVerified(before: Game, after: Game | null, me: string, question: string): boolean {
  if (!after || after.q_count !== before.q_count + 1 || !after.pending) return false;
  const q = after.questions[after.questions.length - 1];
  return !!q && q.index === after.q_count && same(q.asker, me) && q.text === pyStrip(question) && q.answer === "";
}

export function answerVerified(before: Game, after: Game | null, yes: boolean): boolean {
  if (!after || after.pending || after.q_count !== before.q_count) return false;
  const q = after.questions[after.questions.length - 1];
  return !!q && q.answer === (yes ? "YES" : "NO");
}

export function guessVerified(before: Game, after: Game | null): boolean {
  return !!after && after.state === "ASKING" && after.guess_count === before.guess_count + 1;
}

export type RevealCheck = { ok: true; lies: number[]; keeperCredit: bigint } | { ok: false };

/**
 * REVEALED with my secret; every listed position carries lie=true and is paid
 * bond // 5 (lowest five only); the keeper is credited bond minus the payouts,
 * and the keeper's credit balance grew by exactly that (plus any share the
 * keeper did not get, i.e. none: the keeper never asks).
 */
export function revealVerified(
  before: { g: Game; credits: Credits | null },
  after: { g: Game | null; credits: Credits | null },
  secret: string,
): RevealCheck {
  const g = after.g;
  if (!g || g.state !== "REVEALED" || g.secret !== pyStrip(secret) || !Array.isArray(g.lies)) return { ok: false };
  const bond = big(g.bond_wei);
  const share = bond / 5n;
  const paidSet = new Set(g.lies.slice(0, 5));
  let paid = 0n;
  for (const q of g.questions) {
    if (q.lie !== g.lies.includes(q.index)) return { ok: false };
    const expected = paidSet.has(q.index) ? share : 0n;
    if (big(q.paid_wei) !== expected) return { ok: false };
    paid += expected;
  }
  const keeperCredit = bond - paid;
  if (big(g.keeper_credit_wei) !== keeperCredit) return { ok: false };
  if (big(after.credits?.credit_wei) !== big(before.credits?.credit_wei) + keeperCredit) return { ok: false };
  return { ok: true, lies: g.lies, keeperCredit };
}

export function forfeitVerified(before: { credits: Credits | null }, after: { g: Game | null; credits: Credits | null }): boolean {
  return !!after.g && after.g.state === "FORFEITED" && big(after.credits?.credit_wei) > big(before.credits?.credit_wei);
}

export function withdrawVerified(before: Credits | null, after: Credits | null): boolean {
  return !!before && !!after && big(before.credit_wei) > 0n && big(after.credit_wei) === 0n;
}
