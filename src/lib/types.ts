// Shapes of the contract's JSON views. Amounts in wei are decimal strings.

export type Question = {
  index: number;
  asker: string;
  text: string;
  answer: "YES" | "NO" | "" | string;
  lie: boolean;
  paid_wei: string;
};

export type Guess = { index: number; wallet: string; word: string; correct: boolean };

export type Game = {
  game_id: string;
  keeper: string;
  player: string;
  now: number;
  join_deadline: number;
  play_deadline: number;
  reveal_deadline: number;
  audit_deadline: number;
  audit_attempts: number;
  audits: {status: string; lies: number[]}[];
  player_credit_wei: string;
  commitment: string;
  bond_wei: string;
  state: "ASKING" | "REVEALED" | "FORFEITED" | string;
  q_count: number;
  questions_left: number;
  pending: boolean;
  opened_day: number;
  reveal_deadline_day: number;
  today: number;
  deadline_passed: boolean;
  secret: string;
  lies: number[] | null;
  lie_share_wei: string;
  keeper_credit_wei: string;
  winner: string;
  guess_count: number;
  guesses: Guess[];
  questions: Question[];
};

export type Withdrawal = {wallet: string; sequence: number; amount_wei: string; status: string; requested_at: number; replacement_funder: string};
export type Credits = { wallet: string; credit_wei: string; pending_sequence: number; last_withdrawal: Withdrawal | null };

export type TxPhase = "idle" | "checking" | "signing" | "submitted" | "delayed" | "success" | "error";

export type TxStatus = {
  phase: TxPhase;
  message: string;
  hash?: string;
  action?: string;
};
