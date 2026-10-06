import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCredits, parseGame, parseLimits } from "../../src/lib/parse.ts";
import { revealed } from "./fixture.ts";

const RAW = JSON.stringify(revealed());

test("views are parsed as JSON once, or twice when the RPC double-encodes them", () => {
  assert.deepEqual(parseGame(RAW)?.lies, [2]);
  assert.equal(parseGame(JSON.stringify(RAW))?.questions[1].paid_wei, "200000000000000000");
  assert.equal(parseCredits('{"wallet": "0xa", "credit_wei": "800000000000000000"}')?.credit_wei, "800000000000000000");
  assert.equal(parseLimits('{"rubric_hash": "ab", "reveal_days": 3}')?.reveal_days, 3);
});

test("amounts stay exact decimal strings above 2^53", () => {
  const g = parseGame(RAW)!;
  assert.equal(BigInt(g.bond_wei), 10n ** 18n);
  assert.ok(BigInt(g.bond_wei) > BigInt(Number.MAX_SAFE_INTEGER));
});

test("unknown id, broken JSON or a wrong shape read as nothing", () => {
  assert.equal(parseGame("{}"), null);
  assert.equal(parseGame("not json"), null);
  assert.equal(parseGame(RAW.replace('"questions":', '"log":')), null);
  assert.equal(parseGame(RAW.replace('"bond_wei":"1000000000000000000"', '"bond_wei":1e18')), null);
  assert.equal(parseCredits('{"wallet": "0xa", "credit_wei": 5}'), null);
  assert.equal(parseCredits("{}"), null);
});
