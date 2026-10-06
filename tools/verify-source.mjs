// Compares the SHA-256 of contracts/HonestKeeper.py with SOURCE_SHA256.txt.
// CRLF is normalized to LF first (Studio stores source with CRLF), and one
// missing or extra trailing newline is tolerated.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const FILE = "contracts/HonestKeeper.py";
const expected = readFileSync("SOURCE_SHA256.txt", "utf8").trim().split(/\s+/)[0].toLowerCase();
const lf = readFileSync(FILE, "utf8").replace(/\r\n/g, "\n");
const variants = new Set([lf, lf.endsWith("\n") ? lf.slice(0, -1) : lf + "\n"]);
const sha = (s) => createHash("sha256").update(s, "utf8").digest("hex");
const hashes = [...variants].map(sha);
if (hashes.includes(expected)) {
  console.log(`PASS ${FILE} sha256 ${expected}`);
  process.exit(0);
}
console.error(`FAIL ${FILE}\n  expected ${expected}\n  got      ${hashes.join(" / ")}`);
process.exit(1);
