// Parity of pyStrip / pySplit-normalize / pyLen against real Python.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { pyLen, pyNormalize, pyStrip } from "../../src/lib/pytext.ts";

const CASES: string[] = [
  "plain text",
  "  leading and trailing  ",
  "\tTabs\tand\nnewlines\r\n",
  "\u001cFS at start",
  "GS at end\u001d",
  "\u001eRS and US\u001f",
  "NEL\u0085inside and at end\u0085",
  " no-break space ",
  "﻿BOM is not Python whitespace",
  "ideographic　space",
  "en quad thin",
  "line sep and para sep",
  "emoji 🔒 counts once 👍🏽",
  "é composed vs é decomposed",
  "​zero width space is not whitespace​",
  "",
  "   ",
];

function python(cases: string[]) {
  const code = [
    "import json,sys",
    "cases=json.loads(sys.stdin.read())",
    "out=[{'strip':c.strip(),'norm':' '.join(c.strip().split()),'len':len(c.strip())} for c in cases]",
    "sys.stdout.write(json.dumps(out))",
  ].join("\n");
  const r = spawnSync("python3", ["-c", code], { input: JSON.stringify(cases), encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr);
  return JSON.parse(r.stdout) as { strip: string; norm: string; len: number }[];
}

test("at least 12 parity cases, including U+001C-U+001F, U+0085 and U+FEFF", () => {
  assert.ok(CASES.length >= 12);
  for (const cp of [0x1c, 0x1d, 0x1e, 0x1f, 0x85, 0xfeff]) {
    assert.ok(CASES.some((c) => c.includes(String.fromCodePoint(cp))), cp.toString(16));
  }
});

test("pyStrip / pyNormalize / pyLen match Python on every case", () => {
  const expected = python(CASES);
  CASES.forEach((c, i) => {
    assert.equal(pyStrip(c), expected[i].strip, `strip #${i}`);
    assert.equal(pyNormalize(pyStrip(c)), expected[i].norm, `normalize #${i}`);
    assert.equal(pyLen(pyStrip(c)), expected[i].len, `len #${i}`);
  });
});

test("JS trim() really differs from Python strip() on these code points", () => {
  assert.notEqual("\u001cX".trim(), pyStrip("\u001cX"));
  assert.notEqual("\u0085X".trim(), pyStrip("\u0085X"));
  assert.notEqual("﻿X".trim(), pyStrip("﻿X"));
  assert.notEqual("🔒".length, pyLen("🔒"));
});
