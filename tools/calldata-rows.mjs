// Shared rows for tools/calldata-bytes.mjs, tools/probe-calldata.mjs and tests.
export const ID = "f".repeat(64);
export const WALLET = "0x" + "1".repeat(40);
export const SALT = "k3Rv8pQz1Lw6Tn0Yh5Xc2Bm9Df4Gs7Ja";

// Every question of the test cases (HONEST / LIE pairs share one question or differ by one word).
export const CASES = {
  H1: "Is it found in nature?",
  H2: "Does it need electricity to work?",
  H3: "Can it fly?",
  H4: "Is it usually near water?",
  H5: "Does it get smaller when used?",
  L3: "Can it swim?",
  L4: "Is it usually in a desert?",
  L5: "Does it get bigger when used?",
  U1: "Is it bigger than a breadbox?",
  U2: "Is it old?",
};

/** HARD BLOCK: any of these over 255 bytes stops the release. */
export function hardBlockRows() {
  const rows = Object.entries(CASES).map(([name, text]) => ({ name: `ask ${name}`, method: "ask", args: [ID, text] }));
  rows.push({ name: "ask (100-character question, the contract cap)", method: "ask", args: [ID, "q".repeat(100)] });
  rows.push({ name: "open_game (commitment)", method: "open_game", args: [ID] });
  rows.push({ name: "answer (id, true)", method: "answer", args: [ID, true] });
  rows.push({ name: "guess (40-character guess, the cap)", method: "guess", args: [ID, "g".repeat(40)] });
  rows.push({ name: "reveal (40-character secret + 32-character salt)", method: "reveal", args: [ID, "s".repeat(40), SALT] });
  rows.push({ name: "forfeit (id)", method: "forfeit", args: [ID] });
  rows.push({ name: "withdraw ()", method: "withdraw", args: [] });
  return rows;
}

/** MEASURE ONLY: the salt has no cap in the contract; a long salt is the one way past the cliff. */
export function measureOnlyRows() {
  return [{ name: "reveal with a 40-character secret and a 128-character salt", method: "reveal", args: [ID, "s".repeat(40), "x".repeat(128)] }];
}
