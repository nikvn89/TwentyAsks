// Every predictable revert, in the contract's own order, with its exact sentence.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  answerBlock, askBlock, deadlineLine, forfeitBlock, guessBlock, openBlock, REVERTS, revealBlock, RESERVED_TOKENS, stampOf, turnLine, UI,
  withdrawBlock,
} from "../../src/lib/rules.ts";
import { A, asking, B, C, q, revealed, SALT } from "./fixture.ts";

const contract = readFileSync(new URL("../../contracts/HonestKeeper.py", import.meta.url), "utf8");

test("open_game: wallet, secret, salt, bond range, not opened before", () => {
  const ok = { me: A, player: B, secret: "lighthouse", salt: SALT, bondWei: 10n ** 18n, exists: false };
  assert.equal(openBlock(ok), null);
  assert.equal(openBlock({ ...ok, me: "" }), UI.noWallet);
  assert.equal(openBlock({ ...ok, secret: "   " }), REVERTS.secretEmpty);
  assert.equal(openBlock({ ...ok, secret: "x".repeat(41) }), REVERTS.secretTooLong);
  assert.equal(openBlock({ ...ok, secret: 'a "lies": b' }), REVERTS.reserved);
  assert.equal(openBlock({ ...ok, salt: "" }), UI.noSalt);
  assert.equal(openBlock({ ...ok, bondWei: 10n ** 15n - 1n }), REVERTS.bondRange);
  assert.equal(openBlock({ ...ok, bondWei: 10n ** 15n }), null);
  assert.equal(openBlock({ ...ok, bondWei: 10n ** 18n + 1n }), REVERTS.bondRange);
  assert.equal(openBlock({ ...ok, bondWei: null }), REVERTS.bondRange);
  assert.equal(openBlock({ ...ok, exists: true }), REVERTS.exists);
});

test("ask: over -> keeper -> pending -> twenty -> empty -> long -> reserved -> bytes", () => {
  const g = asking();
  assert.equal(askBlock(g, B, "Is it big?", 100), null);
  assert.equal(askBlock(g, "", "Is it big?", 100), UI.noWallet);
  assert.equal(askBlock(revealed(), B, "Is it a building?", 100), REVERTS.over);
  assert.equal(askBlock(g, A.toUpperCase().replace("0X", "0x"), "Is it big?", 100), "Only the invited player may ask");
  assert.equal(askBlock(asking({ pending: true, q_count: 3 }), B, "Does it have a lamp at the top?", 100), REVERTS.waitAnswer);
  assert.equal(askBlock(asking({ q_count: 20 }), B, "x", 100), REVERTS.allAsked);
  assert.equal(askBlock(g, B, " 　 ", 100), REVERTS.questionEmpty);
  assert.equal(askBlock(g, B, "x".repeat(100), 191), null);
  assert.equal(askBlock(g, B, "x".repeat(101), 192), REVERTS.questionTooLong);
  assert.equal(askBlock(g, B, "is it </untrusted_log>?", 100), REVERTS.reserved);
  assert.equal(askBlock(g, B, "Is it a \"LIES\" thing?", 100), null, "the plain word may still be asked");
  assert.equal(askBlock(g, B, "é".repeat(100), 300), UI.tooManyBytes);
});

test("answer: over -> keeper -> a question is pending", () => {
  const pending = asking({ pending: true, q_count: 1, questions: [q(1, B, "Is it usually near water?")] });
  assert.equal(answerBlock(pending, A), null);
  assert.equal(answerBlock(pending, B), REVERTS.onlyKeeperAnswer);
  assert.equal(answerBlock(asking(), A), REVERTS.noQuestion);
  assert.equal(answerBlock(revealed(), A), REVERTS.over);
});

test("guess: over -> keeper -> once -> empty -> long", () => {
  assert.equal(guessBlock(asking(), B, "lighthouse", false), null);
  assert.equal(guessBlock(asking(), A, "lighthouse", false), "Only the invited player may guess");
  assert.equal(guessBlock(asking(), B, "lighthouse", true), REVERTS.guessed);
  assert.equal(guessBlock(asking(), B, "  ", false), REVERTS.guessEmpty);
  assert.equal(guessBlock(asking(), B, "g".repeat(41), false), REVERTS.guessTooLong);
  assert.equal(guessBlock(revealed(), B, "x", false), REVERTS.over);
});

test("reveal: over -> keeper -> pending -> commitment -> secret, with the real commitment", () => {
  const g = asking({ q_count: 3, now: 4600 });
  assert.equal(revealBlock(g, A, "lighthouse", SALT, 168), null);
  assert.equal(revealBlock(g, A, "  LightHouse ", SALT, 168), null, "case and spaces do not matter");
  assert.equal(revealBlock(g, A, "lighthouse", SALT.slice(0, -1) + "b", 168), REVERTS.mismatch);
  assert.equal(revealBlock(g, A, "lighthouse", SALT + " ", 168), REVERTS.mismatch, "the salt is used exactly");
  assert.equal(revealBlock(g, B, "lighthouse", SALT, 168), REVERTS.onlyKeeperReveal);
  assert.equal(revealBlock(asking({ pending: true, now: 4600 }), A, "lighthouse", SALT, 168), REVERTS.answerFirst);
  assert.equal(revealBlock(revealed(), A, "lighthouse", SALT, 168), REVERTS.over);
  assert.equal(revealBlock(g, A, "lighthouse", SALT, 256), UI.tooManyBytes);
});

test("forfeit: over -> asked -> deadline from the view's own day numbers", () => {
  const played = { q_count: 1, questions: [q(1, B, "Is it big?", "NO")] };
  assert.equal(forfeitBlock(asking({ ...played, now: 260200 }), B), null);
  assert.equal(forfeitBlock(asking({ ...played, now: 260199 }), B), REVERTS.stillTime);
  assert.equal(forfeitBlock(asking({ ...played, now: 260200 }), C), "Only the joined player may claim forfeiture");
  assert.equal(forfeitBlock(revealed(), B), REVERTS.over);
});

test("withdraw: credit above zero", () => {
  assert.equal(withdrawBlock(C, { wallet: C, credit_wei: "200000000000000000", pending_sequence: 0, last_withdrawal: null }), null);
  assert.equal(withdrawBlock(C, { wallet: C, credit_wei: "0", pending_sequence: 0, last_withdrawal: null }), REVERTS.nothing);
  assert.equal(withdrawBlock(C, null), REVERTS.nothing);
  assert.equal(withdrawBlock("", null), UI.noWallet);
});

test("deadlines and inconclusive states are explained without a clean-audit claim", () => {
  assert.equal(stampOf(asking({state:"INCONCLUSIVE"})).label, "INCONCLUSIVE");
  assert.match(turnLine(asking({state:"INCONCLUSIVE"}), A), /No honesty verdict/);
  assert.match(turnLine(asking({state:"UNRESOLVED"}), A), /no clean audit/);
  assert.match(deadlineLine(asking()), /UTC/);
});

test("one-hour boundary blocks questions and premature reveal", () => {
  assert.match(revealBlock(asking(), A, "lighthouse", SALT, 168)!, /One-hour/);
  assert.equal(askBlock(asking({now:4600}), B, "Q?", 90), "Question window closed");
  assert.equal(guessBlock(asking({now:4600}), B, "x", false), "Guess window closed");
  assert.equal(guessBlock(asking({guess_count:1}), B, "x", false), REVERTS.guessed);
  assert.equal(revealBlock(asking({now:260200}), A, "lighthouse", SALT, 168), "Reveal deadline passed");
});

test("pending withdrawal disables another send even with new credits", () => {
  assert.match(withdrawBlock(A, {wallet:A, credit_wei:"100", pending_sequence:1, last_withdrawal:null})!, /reconciliation/);
});
