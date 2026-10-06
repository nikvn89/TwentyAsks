// Postconditions: a write is reported as done only when the reloaded state shows it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { answerVerified, askVerified, forfeitVerified, guessVerified, openVerified, revealVerified, withdrawVerified } from "../../src/lib/verify.ts";
import { A, asking, B, C, COMMITMENT, G, q, revealed } from "./fixture.ts";

test("open: my keeper, my commitment, my bond, ASKING, deadline = opened + 3", () => {
  const s = { id: G, me: A.toUpperCase().replace("0X", "0x"), commitment: COMMITMENT, bondWei: 10n ** 18n };
  assert.ok(openVerified(asking(), s));
  assert.ok(!openVerified(asking(), { ...s, bondWei: 10n ** 17n }));
  assert.ok(!openVerified(asking({ keeper: B }), s));
  assert.ok(!openVerified(asking({ reveal_deadline_day: 20736 }), s));
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

test("guess: the hidden count went up by one", () => {
  assert.ok(guessVerified(asking(), asking({ guess_count: 1 })));
  assert.ok(!guessVerified(asking(), asking()));
});

test("reveal: the on-chain game — lies [2], 0.2 GEN to C, 0.8 GEN to the keeper", () => {
  const before = { g: asking({ q_count: 3 }), credits: { wallet: A, credit_wei: "0" } };
  const check = revealVerified(before, { g: revealed(), credits: { wallet: A, credit_wei: "800000000000000000" } }, "lighthouse");
  assert.deepEqual(check, { ok: true, lies: [2], keeperCredit: 8n * 10n ** 17n });
  assert.ok(!revealVerified(before, { g: revealed(), credits: { wallet: A, credit_wei: "1000000000000000000" } }, "lighthouse").ok);
  const wrongFlag = revealed();
  wrongFlag.questions[0].lie = true;
  assert.ok(!revealVerified(before, { g: wrongFlag, credits: { wallet: A, credit_wei: "800000000000000000" } }, "lighthouse").ok);
  assert.ok(!revealVerified(before, { g: revealed(), credits: { wallet: A, credit_wei: "800000000000000000" } }, "kettle").ok);
});

test("reveal with no lie credits the whole bond to the keeper; only five positions are paid", () => {
  const before = { g: asking(), credits: null };
  const none = { ...revealed(), lies: [], keeper_credit_wei: "1000000000000000000", questions: [q(1, B, "x", "YES")] };
  assert.deepEqual(revealVerified(before, { g: none, credits: { wallet: A, credit_wei: "1000000000000000000" } }, "lighthouse"),
    { ok: true, lies: [], keeperCredit: 10n ** 18n });
  const six = Array.from({ length: 6 }, (_, i) => q(i + 1, B, `q${i}`, "YES", true, i < 5 ? "200000000000000000" : "0"));
  const all = { ...revealed(), lies: [1, 2, 3, 4, 5, 6], keeper_credit_wei: "0", questions: six };
  assert.ok(revealVerified(before, { g: all, credits: { wallet: A, credit_wei: "0" } }, "lighthouse").ok);
});

test("forfeit and withdraw", () => {
  assert.ok(forfeitVerified({ credits: null }, { g: asking({ state: "FORFEITED" }), credits: { wallet: B, credit_wei: "1" } }));
  assert.ok(!forfeitVerified({ credits: null }, { g: asking(), credits: { wallet: B, credit_wei: "1" } }));
  assert.ok(withdrawVerified({ wallet: C, credit_wei: "200000000000000000" }, { wallet: C, credit_wei: "0" }));
  assert.ok(!withdrawVerified({ wallet: C, credit_wei: "0" }, { wallet: C, credit_wei: "0" }));
  assert.ok(!withdrawVerified({ wallet: C, credit_wei: "2" }, { wallet: C, credit_wei: "1" }));
});
