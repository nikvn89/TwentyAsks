// Offline calldata size table (no network, no wallet).
// Encodes exactly like genlayer-js 1.1.8 writeContract and counts bytes.
//   node tools/calldata-bytes.mjs            -> table, rc 1 if a HARD BLOCK row is over 255
import { abi } from "genlayer-js";
import { hardBlockRows, measureOnlyRows, ID } from "./calldata-rows.mjs";

const LIMIT = 255;
const bytes = (method, args) => {
  const enc = abi.calldata.encode(abi.calldata.makeCalldataObject(method, args, undefined));
  return (abi.transactions.serialize([enc, false]).length - 2) / 2;
};

let failed = 0;
console.log("HARD BLOCK (must be <= 255 bytes)");
for (const r of hardBlockRows()) {
  const n = bytes(r.method, r.args);
  if (n > LIMIT) failed += 1;
  console.log(`  ${n > LIMIT ? "OVER" : "ok  "}  ${String(n).padStart(4)}  ${r.name}`);
}
console.log("\nMEASURE ONLY (contract cap wider than the proven path)");
for (const r of measureOnlyRows()) {
  const n = bytes(r.method, r.args);
  console.log(`  ${n > LIMIT ? "over" : "ok  "}  ${String(n).padStart(4)}  ${r.name}`);
}
let maxQ = 0, maxSalt = 0;
for (let len = 1; len <= 300; len += 1) if (bytes("ask", [ID, "x".repeat(len)]) <= LIMIT) maxQ = len;
for (let len = 1; len <= 300; len += 1) if (bytes("reveal", [ID, "s".repeat(40), "x".repeat(len)]) <= LIMIT) maxSalt = len;
console.log(`\nLongest ASCII question that fits: ${maxQ} characters (contract cap 100)`);
console.log(`Longest ASCII salt that fits with a 40-character secret: ${maxSalt} characters`);
console.log(failed ? `\nFAIL: ${failed} hard-block row(s) over ${LIMIT} bytes` : "\nPASS: every hard-block row fits");
process.exit(failed ? 1 : 0);
