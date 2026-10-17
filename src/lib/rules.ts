// Mirrors every revert of contracts/HonestKeeper.py that can be predicted from
// state already read, in the SAME order the contract checks them. Whether a
// reply is plainly false is NEVER decided here: only validators decide that,
// inside reveal(). The list of lies is read back from the view.

import { commitmentOf } from "./ids.ts";
import { pyContainsToken, pyLen, pyStrip } from "./pytext.ts";
import type { Credits, Game } from "./types.ts";

export const MAX_QUESTIONS = 20;
export const MAX_QUESTION_LENGTH = 100;
export const MAX_SECRET_LENGTH = 40;
export const MIN_BOND_WEI = 10n ** 15n;
export const MAX_BOND_WEI = 10n ** 18n;
export const LIE_SHARE_DIVISOR = 5n;
export const REVEAL_DAYS = 3;

export const RESERVED_TOKENS = [
  "<UNTRUSTED_SECRET>",
  "</UNTRUSTED_SECRET>",
  "<UNTRUSTED_LOG>",
  "</UNTRUSTED_LOG>",
  '"LIES":',
] as const;

export const REVERTS = {
  invalidCommitment: "Invalid commitment",
  bondRange: "The bond is out of range",
  exists: "This game already exists",
  unknown: "Unknown game id",
  over: "This game is over",
  keeperAsk: "Only the invited player may ask",
  waitAnswer: "Wait for the keeper to answer the last question",
  allAsked: "All twenty questions have been asked",
  questionEmpty: "Question must contain 1 to 100 characters",
  questionTooLong: "Question must contain 1 to 100 characters",
  reserved: "Text contains a reserved token",
  onlyKeeperAnswer: "Only the keeper may answer",
  noQuestion: "There is no question to answer",
  keeperGuess: "Only the invited player may guess",
  guessed: "You have already guessed",
  guessEmpty: "Guess must contain 1 to 40 characters",
  guessTooLong: "Guess must contain 1 to 40 characters",
  onlyKeeperReveal: "Only the keeper may reveal",
  answerFirst: "Answer the last question before revealing",
  mismatch: "The revealed secret does not match the commitment",
  secretEmpty: "Secret must contain 1 to 40 characters",
  secretTooLong: "Secret must contain 1 to 40 characters",
  onlyAsker: "Only the joined player may claim forfeiture",
  stillTime: "The keeper still has time to reveal",
  nothing: "Nothing to withdraw",
} as const;

/** UI-only reasons (the contract never sees these calls). */
export const UI = {
  noWallet: "Connect a wallet first",
  tooManyBytes: "This text is over the 255-byte calldata limit; shorten it",
  noSalt: "Enter the salt the commitment was made with",
} as const;

const same = (a: string, b: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

export function isKeeper(g: Game, me: string): boolean {
  return same(g.keeper, me);
}

export function isPlayer(g: Game, me: string): boolean { return same(g.player, me); }

export function hasAsked(g: Game, me: string): boolean {
  return g.questions.some((q) => same(q.asker, me));
}

export type OpenInput = { me: string; secret: string; salt: string; bondWei: bigint | null; exists: boolean; player: string };

/**
 * open_game order: commitment -> bond range -> not opened before. The secret is
 * checked here too (UI): reveal() later refuses an empty or over-long secret or
 * a reserved token, and a game opened on such a secret could never be revealed.
 */
export function openBlock(i: OpenInput): string | null {
  if (!i.me) return UI.noWallet;
  if (!/^0x[0-9a-fA-F]{40}$/.test(i.player) || /^0x0{40}$/i.test(i.player) || same(i.me, i.player)) return "Choose a separate nonzero player wallet";
  const s = pyStrip(i.secret);
  if (pyLen(s) === 0) return REVERTS.secretEmpty;
  if (pyLen(s) > MAX_SECRET_LENGTH) return REVERTS.secretTooLong;
  if (pyContainsToken(s, RESERVED_TOKENS)) return REVERTS.reserved;
  if (!i.salt) return UI.noSalt;
  if (i.bondWei === null || i.bondWei < MIN_BOND_WEI || i.bondWei > MAX_BOND_WEI) return REVERTS.bondRange;
  if (i.exists) return REVERTS.exists;
  return null;
}

/** ask order: ASKING -> not keeper -> nothing pending -> under 20 -> text -> reserved. */
export function askBlock(g: Game, me: string, question: string, bytes: number): string | null {
  if (!me) return UI.noWallet;
  if (g.state !== "ASKING") return REVERTS.over;
  if (!isPlayer(g, me)) return "Only the invited player may ask";
  if (g.now >= g.play_deadline) return "Question window closed";
  if (g.pending) return REVERTS.waitAnswer;
  if (g.q_count >= MAX_QUESTIONS) return REVERTS.allAsked;
  const q = pyStrip(question);
  if (pyLen(q) === 0) return REVERTS.questionEmpty;
  if (pyLen(q) > MAX_QUESTION_LENGTH) return REVERTS.questionTooLong;
  if (pyContainsToken(q, RESERVED_TOKENS)) return REVERTS.reserved;
  if (bytes > 255) return UI.tooManyBytes;
  return null;
}

/** answer order: ASKING -> keeper -> a question is pending. */
export function answerBlock(g: Game, me: string): string | null {
  if (!me) return UI.noWallet;
  if (g.state !== "ASKING") return REVERTS.over;
  if (!isKeeper(g, me)) return REVERTS.onlyKeeperAnswer;
  if (g.now >= g.reveal_deadline) return "Reveal deadline passed";
  if (!g.pending) return REVERTS.noQuestion;
  return null;
}

/** guess order: ASKING -> not keeper -> not guessed before -> text. Guess calldata is public, so "guessed" is what this browser knows. */
export function guessBlock(g: Game, me: string, word: string, guessedHere: boolean): string | null {
  if (!me) return UI.noWallet;
  if (g.state !== "ASKING") return REVERTS.over;
  if (!isPlayer(g, me)) return "Only the invited player may guess";
  if (g.now >= g.play_deadline) return "Guess window closed";
  if (guessedHere || g.guess_count > 0) return REVERTS.guessed;
  const w = pyStrip(word);
  if (pyLen(w) === 0) return REVERTS.guessEmpty;
  if (pyLen(w) > MAX_SECRET_LENGTH) return REVERTS.guessTooLong;
  return null;
}

/** reveal order: ASKING -> keeper -> nothing pending -> commitment -> secret -> reserved. */
export function revealBlock(g: Game, me: string, secret: string, salt: string, bytes: number): string | null {
  if (!me) return UI.noWallet;
  if (g.state !== "ASKING") return REVERTS.over;
  if (!isKeeper(g, me)) return REVERTS.onlyKeeperReveal;
  if (g.now < g.play_deadline) return "One-hour participation window is still open";
  if (g.now >= g.reveal_deadline) return "Reveal deadline passed";
  if (g.pending) return REVERTS.answerFirst;
  if (commitmentOf(secret, salt) !== g.commitment) return REVERTS.mismatch;
  const s = pyStrip(secret);
  if (pyLen(s) === 0) return REVERTS.secretEmpty;
  if (pyLen(s) > MAX_SECRET_LENGTH) return REVERTS.secretTooLong;
  if (pyContainsToken(s, RESERVED_TOKENS)) return REVERTS.reserved;
  if (bytes > 255) return UI.tooManyBytes;
  return null;
}

/** forfeit order: ASKING -> the caller asked -> deadline reached (today from the view). */
export function forfeitBlock(g: Game, me: string): string | null {
  if (!me) return UI.noWallet;
  if (g.state !== "ASKING") return REVERTS.over;
  if (!isPlayer(g, me)) return "Only the joined player may claim forfeiture";
  if (g.now < g.reveal_deadline) return REVERTS.stillTime;
  return null;
}

export function withdrawBlock(me: string, c: Credits | null): string | null {
  if (!me) return UI.noWallet;
  if (c?.pending_sequence) return "Previous withdrawal needs reconciliation";
  if (BigInt(c?.credit_wei ?? "0") <= 0n) return REVERTS.nothing;
  return null;
}

export type Stamp = { label: string; tone: "asking" | "revealed" | "forfeited" };

export function stampOf(g: Game): Stamp {
  return {label: g.state, tone: g.state === "REVEALED" ? "revealed" : ["FORFEITED", "UNRESOLVED", "CANCELLED"].includes(g.state) ? "forfeited" : "asking"};
}
const utc = (t: number) => t ? new Date(t * 1000).toISOString().replace("T", " ").replace(".000Z", " UTC") : "not started";
export function deadlineLine(g: Game): string {
  if (g.state === "INVITED") return `Accept invitation before ${utc(g.join_deadline)}`;
  if (["JUDGING", "INCONCLUSIVE"].includes(g.state)) return `Audit recovery after ${utc(g.audit_deadline)} or 3 recorded attempts`;
  return `Questions/guesses until ${utc(g.play_deadline)} · reveal before ${utc(g.reveal_deadline)}`;
}
export function turnLine(g: Game, me: string): string {
  if (g.state === "INVITED") return "Waiting for the designated player to accept the rules.";
  if (g.state === "INCONCLUSIVE") return "Audit inconclusive. No honesty verdict and no settlement yet.";
  if (g.state === "JUDGING") return "Secret revealed. A participant must request the audit.";
  if (g.state === "UNRESOLVED") return "Audit unresolved: pre-agreed 50/50 allocation; no clean audit is claimed.";
  if (g.state === "REVEALED") return g.q_count ? "Audit completed. Review the recorded result below." : "Empty game settled without a model audit.";
  if (g.state === "FORFEITED") return "The entire bond was credited to the joined player.";
  if (g.state === "CANCELLED") return "Invitation expired. Bond credited to keeper.";
  if (g.pending) return isKeeper(g, me) ? "Answer the pending question before the reveal deadline." : "Waiting for the keeper's answer.";
  return g.now < g.play_deadline ? "Participation window open. Keeper cannot reveal yet." : "Question window closed. Keeper may reveal before the deadline.";
}
