import { test } from "node:test";
import assert from "node:assert/strict";
const { classifyProbe, encodedCall } = await import(new URL("../../tools/probe-calldata.mjs", import.meta.url).href);
const row = { method: "forfeit", args: ["f".repeat(64)] };
function errorReceipt(text = "Unknown game id", tag = 1) {
  return { error: { message: "execution failed", data: { receipt: {
    mode: "leader", execution_result: "ERROR",
    calldata: Buffer.from(encodedCall(row)).toString("base64"),
    result: Buffer.concat([Buffer.from([tag]), Buffer.from(text)]).toString("base64"),
  } } } };
}
test("probe reads expected user rollback inside generic execution failed", () => {
  assert.match(classifyProbe(errorReceipt(), row), /^decoded/);
});
test("probe does not accept a generic execution error as decoding proof", () => {
  assert.match(classifyProbe({ error: { message: "execution failed" } }, row), /^INCONCLUSIVE/);
});
test("probe rejects receipt for another call or validator mode", () => {
  const body = errorReceipt(); body.error.data.receipt.calldata = Buffer.from("other").toString("base64");
  assert.match(classifyProbe(body, row), /^INCONCLUSIVE/);
  const validator = errorReceipt(); validator.error.data.receipt.mode = "validator";
  assert.match(classifyProbe(validator, row), /^INCONCLUSIVE/);
});
test("probe rejects wrong errors, VM errors and messages quoted outside receipt", () => {
  assert.match(classifyProbe(errorReceipt("different rollback"), row), /^INCONCLUSIVE/);
  assert.match(classifyProbe(errorReceipt("Unknown game id", 2), row), /^INCONCLUSIVE/);
  assert.match(classifyProbe({ error: { message: "Unknown game id" } }, row), /^INCONCLUSIVE/);
});
test("probe identifies transport cliffs and rate limits", () => {
  assert.match(classifyProbe({ error: { message: "RLP string ends with 99 superfluous bytes" } }, row), /^CLIFF/);
  assert.equal(classifyProbe({ error: { message: "rate limit exceeded" } }, row), "RATE_LIMITED");
});
test("probe accepts success and rejects nonzero execution status", () => {
  assert.match(classifyProbe({ result: { data: "00", status: { code: 0 } } }, row), /^decoded/);
  assert.match(classifyProbe({ result: { data: "00", status: { code: 2 } } }, row), /^INCONCLUSIVE/);
});
