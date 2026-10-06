import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { commitmentOf, gameIdOf, idsFromInput, randomSalt } from "../../src/lib/ids.ts";
import { pyNormalize } from "../../src/lib/pytext.ts";

const v = JSON.parse(readFileSync(new URL("./id-vectors.json", import.meta.url), "utf8"));

test("commitments and game ids match the contract, including whitespace and case edge cases", () => {
  assert.ok(v.games.length >= 8);
  for (const row of v.games) {
    assert.equal(pyNormalize(row.secret).toLowerCase(), row.normalized_lower);
    const c = commitmentOf(row.secret, row.salt);
    assert.equal(c, row.commitment, JSON.stringify(row.secret));
    assert.equal(gameIdOf(v.keeper, c), row.game_id);
    assert.equal(gameIdOf(v.keeper.toLowerCase(), c.toUpperCase()), row.game_id);
  }
});

test("the on-chain game is reproduced from the keeper wallet, secret and salt", () => {
  const A = "0x6276095FAEA15108740445ff277fdA8c304657F4";
  const c = commitmentOf("lighthouse", "k3Rv8pQz1Lw6Tn0Yh5Xc2Bm9Df4Gs7Ja");
  assert.equal(c, "276c67646c7e64be52612329b188da32c42bc1cb5ea2d5772866279f028fba41");
  assert.equal(gameIdOf(A, c), "33dc9b684fbc4397db21dc1d1d3fd3f44579905554ebfcbc443d9163b60ea590");
  assert.notEqual(commitmentOf("lighthouse", "k3Rv8pQz1Lw6Tn0Yh5Xc2Bm9Df4Gs7Jb"), c);
});

test("a salt is 32 characters from the alphabet and differs every time", () => {
  const a = randomSalt(), b = randomSalt();
  assert.equal(a.length, 32);
  assert.match(a, /^[A-HJ-NP-Za-km-z2-9]{32}$/);
  assert.notEqual(a, b);
});

test("ids are found in a bare id, a 0x id, a link or a list, without duplicates", () => {
  const a = "33dc9b684fbc4397db21dc1d1d3fd3f44579905554ebfcbc443d9163b60ea590";
  const b = "276c67646c7e64be52612329b188da32c42bc1cb5ea2d5772866279f028fba41";
  assert.deepEqual(idsFromInput(a), [a]);
  assert.deepEqual(idsFromInput("0x" + a.toUpperCase()), [a]);
  assert.deepEqual(idsFromInput(`https://x.app/?g=${a},${b}`), [a, b]);
  assert.deepEqual(idsFromInput(`${a} ${a}`), [a]);
  assert.deepEqual(idsFromInput(a + "ab"), []);
});
