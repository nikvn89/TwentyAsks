// StudioNet receipt rule. A transaction counts as executed only when the
// leader receipt (mode=leader) says execution_result=SUCCESS. A missing or
// null result is NOT success: it is "Submitted — confirmation delayed".
// A leader SUCCESS is not final either: while validators are still proposing,
// committing, revealing or rotating the leader, the accepted state has not
// changed yet, so it stays "pending" until the status reaches ACCEPTED.

import { REVERTS } from "./rules.ts";

export type ReceiptVerdict =
  | { kind: "pending"; status: string }
  | { kind: "success"; status: string }
  | { kind: "error"; status: string; reason: string };

const FAILED_STATUSES = new Set(["CANCELED", "UNDETERMINED", "LEADER_TIMEOUT", "VALIDATORS_TIMEOUT"]);

function pick(obj: any, ...keys: string[]): any {
  if (!obj || typeof obj !== "object") return undefined;
  for (const key of keys) if (obj[key] !== undefined && obj[key] !== null) return obj[key];
  return undefined;
}

export function leaderReceipt(tx: any): any {
  const consensus = pick(tx, "consensus_data", "consensusData");
  let leader = pick(consensus, "leader_receipt", "leaderReceipt");
  if (Array.isArray(leader)) {
    leader = leader.find((r: any) => String(pick(r, "mode") ?? "").toLowerCase() === "leader") ?? null;
  } else if (leader && pick(leader, "mode") !== undefined && String(pick(leader, "mode")).toLowerCase() !== "leader") {
    leader = null;
  }
  return leader ?? null;
}

const STATUS_BY_NUMBER: Record<string, string> = {
  "0": "UNINITIALIZED", "1": "PENDING", "2": "PROPOSING", "3": "COMMITTING", "4": "REVEALING", "5": "ACCEPTED",
  "6": "UNDETERMINED", "7": "FINALIZED", "8": "CANCELED", "9": "APPEAL_REVEALING", "10": "APPEAL_COMMITTING",
  "11": "READY_TO_FINALIZE", "12": "VALIDATORS_TIMEOUT", "13": "LEADER_TIMEOUT",
};
const APPLIED_STATUSES = new Set(["ACCEPTED", "READY_TO_FINALIZE", "FINALIZED"]);

function statusName(tx: any): string {
  const raw = pick(tx, "status_name", "statusName", "status");
  if (raw === undefined) return "";
  const name = String(raw).toUpperCase();
  return STATUS_BY_NUMBER[name] ?? name;
}

const KNOWN = Object.values(REVERTS) as string[];

function decodeCandidates(value: string): string[] {
  const out = [value];
  try {
    if (/^(0x)?[0-9a-fA-F]+$/.test(value) && value.replace(/^0x/, "").length % 2 === 0) {
      const hex = value.replace(/^0x/, "");
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < bytes.length; i += 1) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
      out.push(new TextDecoder().decode(bytes));
    }
  } catch { /* not hex */ }
  try {
    if (/^[A-Za-z0-9+/]+={0,2}$/.test(value) && value.length % 4 === 0 && value.length >= 8) {
      const bin = typeof atob === "function" ? atob(value) : Buffer.from(value, "base64").toString("binary");
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      out.push(new TextDecoder().decode(bytes));
    }
  } catch { /* not base64 */ }
  return out;
}

function collectStrings(value: any, out: string[], depth = 0): void {
  if (depth > 8 || value === null || value === undefined) return;
  if (typeof value === "string") {
    out.push(...decodeCandidates(value));
  } else if (Array.isArray(value)) {
    value.forEach((v) => collectStrings(v, out, depth + 1));
  } else if (typeof value === "object") {
    Object.values(value).forEach((v) => collectStrings(v, out, depth + 1));
  }
}

/** Find the contract's own revert sentence anywhere in a receipt (plain, hex or base64). */
export function revertReasonFrom(value: any): string | null {
  const strings: string[] = [];
  collectStrings(value, strings);
  for (const s of strings) {
    for (const known of KNOWN) if (s.includes(known)) return known;
  }
  for (const s of strings) {
    const m = s.match(/(?:UserError|\[rollback\])[:\s]*([^\n"]{3,200})/i);
    if (m) return m[1].trim();
  }
  return null;
}

export function classifyTransaction(tx: any): ReceiptVerdict {
  const status = statusName(tx);
  const leader = leaderReceipt(tx);
  const result = String(pick(leader, "execution_result", "executionResult") ?? "").toUpperCase();
  if (result === "SUCCESS" || result === "FINISHED_WITH_RETURN") {
    if (FAILED_STATUSES.has(status)) {
      return { kind: "error", status, reason: `Consensus ended as ${status}; the change was not applied.` };
    }
    // No status field at all: fall back to the leader receipt; the postcondition still guards it.
    if (status !== "" && !APPLIED_STATUSES.has(status)) return { kind: "pending", status };
    return { kind: "success", status };
  }
  if (result === "ERROR" || result === "FINISHED_WITH_ERROR") {
    return { kind: "error", status, reason: revertReasonFrom(leader) ?? "Contract execution rolled back." };
  }
  if (FAILED_STATUSES.has(status)) {
    return { kind: "error", status, reason: `Consensus ended as ${status}; the change was not applied.` };
  }
  return { kind: "pending", status };
}
