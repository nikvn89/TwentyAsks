// verify:source must accept the Studio CRLF copy and reject a changed byte.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("../../", import.meta.url).pathname;
function run(contract: string): number {
  const dir = mkdtempSync(join(tmpdir(), "src-"));
  mkdirSync(join(dir, "contracts"));
  cpSync(join(root, "SOURCE_SHA256.txt"), join(dir, "SOURCE_SHA256.txt"));
  writeFileSync(join(dir, "contracts", "HonestKeeper.py"), contract);
  return spawnSync("node", [join(root, "tools", "verify-source.mjs")], { cwd: dir }).status ?? 1;
}
const original = readFileSync(join(root, "contracts", "HonestKeeper.py"), "utf8");

test("repo source matches SOURCE_SHA256.txt", () => assert.equal(run(original), 0));
test("CRLF copy matches", () => assert.equal(run(original.replace(/\n/g, "\r\n")), 0));
test("missing final newline matches", () => assert.equal(run(original.replace(/\n$/, "")), 0));
test("one changed byte fails", () => assert.equal(run(original.replace("MAX_QUESTIONS = 20", "MAX_QUESTIONS = 21")), 1));
test("deployments.json carries the same SHA", () => {
  const dep = JSON.parse(readFileSync(join(root, "deployments.json"), "utf8"));
  assert.equal(dep.source_sha256, readFileSync(join(root, "SOURCE_SHA256.txt"), "utf8").split(/\s+/)[0]);
});
