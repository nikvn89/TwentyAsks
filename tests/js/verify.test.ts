// Postconditions: a write is reported as done only when the reloaded state shows it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { answerVerified, askVerified, forfeitVerified, guessVerified, openVerified, revealVerified, withdrawalRequested } from "../../src/lib/verify.ts";
import { A, asking, B, C, COMMITMENT, G, q, revealed } from "./fixture.ts";

test("open: keeper, commitment, bond and invited player match", () => {
  const s = { id: G, me: A.toUpperCase().replace("0X", "0x"), commitment: COMMITMENT, bondWei: 10n ** 18n, player:B };
  assert.ok(openVerified(asking({state:"INVITED"}), s));
  assert.ok(!openVerified(asking({state:"INVITED"}), { ...s, bondWei: 10n ** 17n }));
  assert.ok(!openVerified(asking({ keeper: B }), s));
  assert.ok(!openVerified(asking({state:"INVITED",player:C}), s));
  assert.ok(!openVerified(null, s));
});

test("ask: one more question, mine, my stripped text, pending", () => {
  const before = asking();
  const after = asking({ q_count: 1, pending: true, questions: [q(1, B, "Is it usually near water?")] });
  assert.ok(askVerified(before, after, B, "  Is it usually near water?  "));
  assert.ok(!askVerified(before, after, C, "Is it usually near water?"));
  assert.ok(!askVerified(before, after, B, "Is it usually in a desert?"));
  assert.ok(!askVerified(before, asking(), B, "Is it usually near water?"));
});

test("answer: nothing pending and the last reply is mine", () => {
  const before = asking({ q_count: 1, pending: true, questions: [q(1, B, "x")] });
  const yes = asking({ q_count: 1, questions: [q(1, B, "x", "YES")] });
  assert.ok(answerVerified(before, yes, true));
  assert.ok(!answerVerified(before, yes, false));
  assert.ok(!answerVerified(before, before, true));
});

test("guess: the view count went up by one; calldata is public", () => {
  assert.ok(guessVerified(asking(), asking({ guess_count: 1 })));
  assert.ok(!guessVerified(asking(), asking()));
});

test("reveal only proves publication, not judgement or money", () => {
  assert.ok(revealVerified(asking({state:"JUDGING",secret:"lighthouse"}), "lighthouse"));
  assert.ok(!revealVerified(asking(), "lighthouse"));
  assert.ok(!revealVerified(asking({state:"INCONCLUSIVE",secret:"lighthouse"}), "lighthouse"));
});

test("credit zero alone never proves a withdrawal request or delivery", () => {
  const before = {wallet:A, credit_wei:"100", pending_sequence:0, last_withdrawal:null};
  const zero = {...before, credit_wei:"0"};
  assert.ok(!withdrawalRequested(before,zero));
  const last = {wallet:A,sequence:1,amount_wei:"100",status:"PENDING_EXTERNAL",requested_at:1000,replacement_funder:""};
  assert.ok(withdrawalRequested(before,{...zero,pending_sequence:1,last_withdrawal:last}));
  assert.ok(!withdrawalRequested(before,{...zero,pending_sequence:1,last_withdrawal:{...last,amount_wei:"99"}}));
});
