// Calldata size of every write method, encoded exactly as genlayer-js 1.1.8 does.
import { test } from "node:test";
import assert from "node:assert/strict";
import { calldataBytes, CALLDATA_LIMIT } from "../../src/lib/calldata.ts";
import { CASES, hardBlockRows, ID, SALT } from "../../tools/calldata-rows.mjs";

test("every case question + every other write at its cap stays under 255 bytes", () => {
  assert.equal(Object.keys(CASES).length, 10);
  for (const row of hardBlockRows()) {
    const n = calldataBytes(row.method, row.args);
    assert.ok(n <= CALLDATA_LIMIT, `${row.name}: ${n} bytes`);
  }
});

test("a 100-character question fits (191 bytes); the salt is the only way past the cliff", () => {
  assert.equal(calldataBytes("ask", [ID, "x".repeat(100)]), 191);
  assert.ok(calldataBytes("reveal", [ID, "s".repeat(40), "x".repeat(119)]) <= CALLDATA_LIMIT);
  assert.ok(calldataBytes("reveal", [ID, "s".repeat(40), "x".repeat(120)]) > CALLDATA_LIMIT);
  assert.equal(calldataBytes("reveal", [ID, "s".repeat(40), SALT]), 168);
});
