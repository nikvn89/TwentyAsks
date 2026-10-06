// GEN <-> wei with bigint only (18 decimals). JS numbers lose wei above 2^53.

export const WEI_PER_GEN = 10n ** 18n;
export const NOT_AN_AMOUNT = "Enter an amount in GEN, e.g. 0.01";

export type GenCheck = { ok: true; wei: bigint } | { ok: false; reason: string };

/** "0.01" -> 10000000000000000n. At most 18 decimals; no sign, no exponent. */
export function parseGen(raw: string): GenCheck {
  const s = raw.trim().replace(/[,_\s]/g, "");
  const m = s.match(/^(\d*)(?:\.(\d*))?$/);
  if (!s || !m || (m[1] === "" && (m[2] ?? "") === "")) return { ok: false, reason: NOT_AN_AMOUNT };
  const frac = m[2] ?? "";
  if (frac.length > 18) return { ok: false, reason: "GEN has at most 18 decimals" };
  const wei = BigInt(m[1] || "0") * WEI_PER_GEN + BigInt((frac + "0".repeat(18)).slice(0, 18));
  return { ok: true, wei };
}

/** 1000000000000000n -> "0.001". Exact, trailing zeros trimmed. */
export function formatGen(wei: bigint | string): string {
  const v = typeof wei === "bigint" ? wei : BigInt(wei || "0");
  const neg = v < 0n;
  const a = neg ? -v : v;
  const whole = a / WEI_PER_GEN;
  const frac = (a % WEI_PER_GEN).toString().padStart(18, "0").replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole.toString()}${frac ? "." + frac : ""}`;
}

export const gen = (wei: bigint | string) => `${formatGen(wei)} GEN`;
