// tools/ids.html (offline helper) must give the contract's commitment and game id.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../../tools/ids.html", import.meta.url), "utf8");
const core = html.match(/<script id="core">([\s\S]*?)<\/script>/)![1];
const api = new Function(core + "; return { commitmentOf, gameIdOf, keccak256Hex };")() as {
  commitmentOf: (s: string, salt: string) => string; gameIdOf: (k: string, c: string) => string; keccak256Hex: (b: Uint8Array) => string;
};
const v = JSON.parse(readFileSync(new URL("./id-vectors.json", import.meta.url), "utf8"));

test("keccak256 known answer", () => {
  assert.equal(api.keccak256Hex(new Uint8Array()), "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470");
});

test("ids.html matches the contract vectors", () => {
  for (const row of v.games) {
    assert.equal(api.commitmentOf(row.secret, row.salt), row.commitment, JSON.stringify(row.secret));
    assert.equal(api.gameIdOf(v.keeper, row.commitment), row.game_id);
  }
});
