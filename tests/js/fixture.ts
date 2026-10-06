// A get_game view as the contract returns it (the on-chain Intelligent Contract game after the reveal).
import type { Game } from "../../src/lib/types.ts";

export const A = "0x6276095faea15108740445ff277fda8c304657f4";
export const B = "0xad05365afe0c2450d4ffbcdbe555b6e5fb7dfa35";
export const C = "0xa2d2e7bad15e7b8a9031d88353530a794e56db28";
export const G = "33dc9b684fbc4397db21dc1d1d3fd3f44579905554ebfcbc443d9163b60ea590";
export const COMMITMENT = "276c67646c7e64be52612329b188da32c42bc1cb5ea2d5772866279f028fba41";
export const SALT = "k3Rv8pQz1Lw6Tn0Yh5Xc2Bm9Df4Gs7Ja";

export function asking(over: Partial<Game> = {}): Game {
  return {
    game_id: G, keeper: A, commitment: COMMITMENT, bond_wei: "1000000000000000000", state: "ASKING",
    q_count: 0, questions_left: 20, pending: false, opened_day: 20732, reveal_deadline_day: 20735, today: 20732,
    deadline_passed: false, secret: "", lies: null, lie_share_wei: "200000000000000000", keeper_credit_wei: "0",
    winner: "", guess_count: 0, guesses: [], questions: [], ...over,
  };
}

export const q = (index: number, asker: string, text: string, answer = "", lie = false, paid = "0") =>
  ({ index, asker, text, answer, lie, paid_wei: paid });

export function revealed(): Game {
  return asking({
    state: "REVEALED", q_count: 3, questions_left: 17, secret: "lighthouse", lies: [2], keeper_credit_wei: "800000000000000000",
    winner: B, guess_count: 1, guesses: [{ index: 1, wallet: B, word: "lighthouse", correct: true }],
    questions: [
      q(1, B, "Is it usually near water?", "YES"),
      q(2, C, "Is it usually in a desert?", "YES", true, "200000000000000000"),
      q(3, B, "Is it old?", "YES"),
    ],
  });
}
