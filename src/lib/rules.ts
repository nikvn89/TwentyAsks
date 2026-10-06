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
  keeperAsk: "The keeper cannot ask",
  waitAnswer: "Wait for the keeper to answer the last question",
  allAsked: "All twenty questions have been asked",
  questionEmpty: "Question is empty",
  questionTooLong: "Question is too long",
  reserved: "Text contains a reserved token",
  onlyKeeperAnswer: "Only the keeper may answer",
  noQuestion: "There is no question to answer",
  keeperGuess: "The keeper cannot guess",
  guessed: "You have already guessed",
  guessEmpty: "Guess is empty",
  guessTooLong: "Guess is too long",
  onlyKeeperReveal: "Only the keeper may reveal",
  answerFirst: "Answer the last question before revealing",
  mismatch: "The revealed secret does not match the commitment",
  secretEmpty: "Secret is empty",
  secretTooLong: "Secret is too long",
  onlyAsker: "Only a player who asked may claim the bond",
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

export function hasAsked(g: Game, me: string): boolean {
  return g.questions.some((q) => same(q.asker, me));
}

export type OpenInput = { me: string; secret: string; salt: string; bondWei: bigint | null; exists: boolean };

/**
 * open_game order: commitment -> bond range -> not opened before. The secret is
 * checked here too (UI): reveal() later refuses an empty or over-long secret or
 * a reserved token, and a game opened on such a secret could never be revealed.
 */
export function openBlock(i: OpenInput): string | null {
  if (!i.me) return UI.noWallet;
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
  if (isKeeper(g, me)) return REVERTS.keeperAsk;
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
  if (!g.pending) return REVERTS.noQuestion;
  return null;
}

/** guess order: ASKING -> not keeper -> not guessed before -> text. Guesses are hidden, so "guessed" is what this browser knows. */
export function guessBlock(g: Game, me: string, word: string, guessedHere: boolean): string | null {
  if (!me) return UI.noWallet;
  if (g.state !== "ASKING") return REVERTS.over;
  if (isKeeper(g, me)) return REVERTS.keeperGuess;
  if (guessedHere) return REVERTS.guessed;
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
  if (!hasAsked(g, me)) return REVERTS.onlyAsker;
  if (g.today < g.opened_day + REVEAL_DAYS) return REVERTS.stillTime;
  return null;
}

export function withdrawBlock(me: string, c: Credits | null): string | null {
  if (!me) return UI.noWallet;
  if (BigInt(c?.credit_wei ?? "0") <= 0n) return REVERTS.nothing;
  return null;
}

export type Stamp = { label: string; tone: "asking" | "revealed" | "forfeited" };

export function stampOf(g: Game): Stamp {
  if (g.state === "REVEALED") return { label: "REVEALED", tone: "revealed" };
  if (g.state === "FORFEITED") return { label: "FORFEITED", tone: "forfeited" };
  return { label: "ASKING", tone: "asking" };
}

/** Days left before forfeit opens, from the view's own day numbers. */
export function deadlineLine(g: Game): string {
  if (g.state !== "ASKING") return `Opened on day ${g.opened_day}`;
  const left = g.reveal_deadline_day - g.today;
  if (left <= 0) return "Reveal deadline passed — a player who asked may forfeit the game";
  return `Reveal due within ${left} day${left === 1 ? "" : "s"} (day ${g.reveal_deadline_day})`;
}

/** What the next move is, in one line, for whoever is looking. */
export function turnLine(g: Game, me: string): string {
  if (g.state === "REVEALED") return g.winner ? "Revealed. The earliest correct guess won." : "Revealed. Nobody guessed it.";
  if (g.state === "FORFEITED") return "Forfeited: the bond was split among everyone who asked.";
  if (g.pending) return isKeeper(g, me) ? "Your turn: answer the last question." : "Waiting for the keeper to answer.";
  if (g.q_count >= MAX_QUESTIONS) return isKeeper(g, me) ? "All twenty asked. Reveal the secret." : "All twenty asked. Waiting for the reveal.";
  return isKeeper(g, me) ? "Waiting for a question — or reveal whenever you like." : "Your turn: ask a yes/no question, or guess.";
}
