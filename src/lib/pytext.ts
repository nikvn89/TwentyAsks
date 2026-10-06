// Python-compatible string helpers. The contract hashes ids with Python's
// str.strip(), str.split() and len(); JavaScript's trim(), /\s/ and .length
// disagree with those on several code points, which would make a locally
// computed id differ from the on-chain id with no way to recover the record.

// Exactly the code points for which Python's str.isspace() is True.
// JS trim() differs: it strips U+FEFF but not U+001C-U+001F or U+0085.
const PY_WHITESPACE = new Set<number>([
  0x09, 0x0a, 0x0b, 0x0c, 0x0d,
  0x1c, 0x1d, 0x1e, 0x1f,
  0x20, 0x85, 0xa0, 0x1680,
  0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200a,
  0x2028, 0x2029, 0x202f, 0x205f, 0x3000,
]);

export function isPySpace(ch: string): boolean {
  const cp = ch.codePointAt(0);
  return cp !== undefined && PY_WHITESPACE.has(cp);
}

/** Python str.strip() with no arguments. */
export function pyStrip(value: string): string {
  const chars = Array.from(value);
  let start = 0;
  let end = chars.length;
  while (start < end && isPySpace(chars[start])) start += 1;
  while (end > start && isPySpace(chars[end - 1])) end -= 1;
  return chars.slice(start, end).join("");
}

/** Python str.split() with no arguments. */
export function pySplit(value: string): string[] {
  const out: string[] = [];
  let current = "";
  for (const ch of Array.from(value)) {
    if (isPySpace(ch)) {
      if (current) out.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current) out.push(current);
  return out;
}

/** Python " ".join(value.split()) — the contract's _normalize_text. */
export function pyNormalize(value: string): string {
  return pySplit(value).join(" ");
}

/** Python len(): counts code points, not UTF-16 units. */
export function pyLen(value: string): number {
  return Array.from(value).length;
}

/** Python str.upper() for the reserved-token check (ASCII tokens only). */
export function pyContainsToken(value: string, tokens: readonly string[]): boolean {
  const upper = value.toUpperCase();
  return tokens.some((token) => upper.includes(token.toUpperCase()));
}
