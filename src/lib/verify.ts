// Postconditions checked AFTER the receipt says SUCCESS, against reloaded
// accepted state. A write is reported as done only when the state shows it.

import { pyStrip } from "./pytext.ts";
import type { Credits, Game } from "./types.ts";

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const big = (v: string | undefined | null) => BigInt(v ?? "0");

export function openVerified(g: Game | null, s: { id: string; me: string; commitment: string; bondWei: bigint; player: string }): boolean {
  return !!g && g.game_id === s.id && same(g.keeper, s.me) && g.commitment === s.commitment && big(g.bond_wei) === s.bondWei &&
    g.state === "INVITED" && same(g.player, s.player) && g.q_count === 0 && !g.pending;
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

export function revealVerified(after: Game | null, secret: string): boolean {
  return !!after && ["JUDGING", "REVEALED"].includes(after.state) && after.secret === pyStrip(secret);
}

export function forfeitVerified(before: { credits: Credits | null }, after: { g: Game | null; credits: Credits | null }): boolean {
  return !!after.g && after.g.state === "FORFEITED" && big(after.credits?.credit_wei) > big(before.credits?.credit_wei);
}

export function withdrawalRequested(before: Credits | null, after: Credits | null): boolean {
  return !!before && !!after && big(before.credit_wei) > 0n && big(after.credit_wei) === 0n &&
    after.pending_sequence > 0 && after.last_withdrawal?.sequence === after.pending_sequence &&
    after.last_withdrawal.status === "PENDING_EXTERNAL" && big(after.last_withdrawal.amount_wei) === big(before.credit_wei);
}
