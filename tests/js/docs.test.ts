// Documentation must not drift: every cited test and path must exist, and the
// documented counts must match the test files.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../../", import.meta.url).pathname;
const DOCS = ["README.md", "LOCKED_SPEC.md", "TEST_PLAN.md", "TESTING.md", "RUNTIME_EVIDENCE.md", "SECURITY.md", "CHANGELOG.md"];
const read = (p: string) => readFileSync(join(root, p), "utf8");

test("every Python test cited in the docs exists", () => {
  const defined = new Set<string>();
  for (const f of readdirSync(join(root, "tests/contract"))) {
    if (f.endsWith(".py")) for (const m of read(join("tests/contract", f)).matchAll(/^def (test_\w+)/gm)) defined.add(m[1]);
  }
  for (const doc of DOCS) {
    for (const m of read(doc).matchAll(/`(test_\w+)`/g)) assert.ok(defined.has(m[1]), `${doc}: ${m[1]}`);
  }
});

test("every repo path cited in the docs exists", () => {
  for (const doc of DOCS) {
    for (const m of read(doc).matchAll(/`((?:contracts|tests|tools|src|docs|\.github)\/[\w./-]+|[\w-]+\.(?:md|txt|json|py))`/g)) {
      const p = m[1];
      if (p.includes("<") || /^\d/.test(p)) continue;
      assert.ok(existsSync(join(root, p)), `${doc}: ${p}`);
    }
  }
});

test("test counts quoted in TESTING.md are current", () => {
  const t = read("TESTING.md");
  const jsCount = readdirSync(join(root, "tests/js")).filter((f) => f.endsWith(".test.ts"))
    .map((f) => [...read(join("tests/js", f)).matchAll(/^test\(/gm)].length).reduce((a, b) => a + b, 0);
  assert.ok(t.includes(`| ${jsCount} passed |`), `TESTING.md should say ${jsCount} passed for npm test`);
});
