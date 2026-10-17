// Probe the pinned SDK's serialized calldata without a wallet or stored writes.
// An expected rollback proves decoding only when the leader receipt binds the
// exact encoded call and contains the tagged user-error result. Generic RPC
// execution failures remain INCONCLUSIVE and fail HARD BLOCK rows.
// Never print whole RPC errors: their receipts can include node configuration.
import { abi } from "genlayer-js";
import { pathToFileURL } from "node:url";
import { hardBlockRows, measureOnlyRows, WALLET } from "./calldata-rows.mjs";

export function encodedCall(row) {
  return abi.calldata.encode(abi.calldata.makeCalldataObject(row.method, row.args, undefined));
}

function expectedRollback(row) {
  if (row.method === "open_game") return "Choose a separate nonzero player wallet";
  if (row.method === "withdraw") return "Nothing to withdraw";
  if (["acknowledge_delivery", "fund_replacement"].includes(row.method)) return "Unknown pending withdrawal";
  return "Unknown game id";
}

export function classifyProbe(body, row) {
  if (!body || typeof body !== "object") return "INCONCLUSIVE: invalid RPC response";
  if (body.error) {
    const e = body.error;
    if (/superfluous bytes/i.test(String(e.message ?? ""))) return "CLIFF: RPC rejected the RLP calldata";
    if (/rate limit|too many requests/i.test(String(e.message ?? ""))) return "RATE_LIMITED";
    const receipt = e.data?.receipt;
    if (receipt?.mode === "leader" && receipt.execution_result === "ERROR"
        && typeof receipt.calldata === "string" && typeof receipt.result === "string") {
      const actualCall = Buffer.from(receipt.calldata, "base64");
      const expectedCall = Buffer.from(encodedCall(row));
      const result = Buffer.from(receipt.result, "base64");
      // GenVM result tag 1 is a contract user-error; VM/internal errors are not proof.
      if (actualCall.equals(expectedCall) && result[0] === 1
          && result.subarray(1).toString("utf8") === expectedRollback(row)) {
        return "decoded, expected contract rollback in matching leader receipt";
      }
    }
    return "INCONCLUSIVE: RPC error without a matching expected contract rollback";
  }
  const result = body.result;
  if (typeof result === "string" && /^(?:0x)?[0-9a-f]*$/i.test(result)) return "decoded (call returned)";
  if (result && typeof result === "object" && result.status?.code === 0
      && typeof result.data === "string" && /^(?:0x)?[0-9a-f]*$/i.test(result.data)) {
    return "decoded (call returned)";
  }
  return "INCONCLUSIVE: no successful execution or expected rollback";
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function simulate(row, address, rpc) {
  const data = abi.transactions.serialize([encodedCall(row), false]);
  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await fetch(rpc, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "gen_call", params: [{
          type: "write", to: address, from: WALLET, data,
          transaction_hash_variant: "latest-nonfinal",
        }] }),
        signal: AbortSignal.timeout(20_000),
      });
      const body = await response.json();
      const verdict = response.status === 429 ? "RATE_LIMITED" : classifyProbe(body, row);
      if (verdict === "RATE_LIMITED" && attempt < 3) {
        console.log("      rate limited, waiting 30s");
        await sleep(30_000);
        continue;
      }
      if (!response.ok) return "INCONCLUSIVE: RPC HTTP failure";
      return verdict;
    } catch {
      return "INCONCLUSIVE: network, timeout or invalid JSON response";
    }
  }
}

async function main() {
  const address = process.argv[2];
  const rpc = process.argv[3] || "https://studio.genlayer.com/api";
  if (!/^0x[0-9a-fA-F]{40}$/.test(address || "")) {
    console.error("usage: node tools/probe-calldata.mjs <contract_address> [rpc_url]");
    return 2;
  }
  let failed = 0;
  for (const [group, rows] of [["HARD BLOCK", hardBlockRows()], ["MEASURE ONLY", measureOnlyRows()]]) {
    console.log(group);
    for (const row of rows) {
      await sleep(2500);
      const verdict = await simulate(row, address, rpc);
      if (group === "HARD BLOCK" && !verdict.startsWith("decoded")) failed += 1;
      console.log(`  ${row.name}\n      ${verdict}`);
    }
  }
  console.log(failed ? `FAIL: ${failed} hard-block probe(s) not confirmed` : "PASS: every hard-block calldata shape decoded; not a semantic or transaction test");
  return failed ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
