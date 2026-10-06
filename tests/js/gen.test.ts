import { test } from "node:test";
import assert from "node:assert/strict";
import { formatGen, gen, NOT_AN_AMOUNT, parseGen } from "../../src/lib/gen.ts";

test("GEN to wei is exact with bigint, including amounts above 2^53", () => {
  assert.deepEqual(parseGen("0.001"), { ok: true, wei: 10n ** 15n });
  assert.deepEqual(parseGen("0.998"), { ok: true, wei: 998000000000000000n });
  assert.deepEqual(parseGen("1"), { ok: true, wei: 10n ** 18n });
  assert.deepEqual(parseGen(".5"), { ok: true, wei: 5n * 10n ** 17n });
  assert.deepEqual(parseGen("1,000.000000000000000001"), { ok: true, wei: 1000n * 10n ** 18n + 1n });
  assert.ok(998000000000000000n > BigInt(Number.MAX_SAFE_INTEGER));
});

test("bad input never becomes a number", () => {
  for (const bad of ["", ".", "abc", "1e3", "-1", "0x10", "1.2.3"]) assert.deepEqual(parseGen(bad), { ok: false, reason: NOT_AN_AMOUNT }, bad);
  assert.equal(parseGen("0.0000000000000000001").ok, false);
});

test("wei to GEN keeps every digit and trims zeros", () => {
  assert.equal(formatGen("1000000000000000"), "0.001");
  assert.equal(formatGen("990000000000000000"), "0.99");
  assert.equal(formatGen("1000000000000000000"), "1");
  assert.equal(formatGen("9999999999999999999000000000000000"), "9999999999999999.999");
  assert.equal(formatGen(0n), "0");
  assert.equal(gen("3000000000000000"), "0.003 GEN");
  for (const s of ["1", "0.000000000000000001", "123.456"]) {
    const p = parseGen(s);
    assert.ok(p.ok && formatGen(p.wei) === s, s);
  }
});
