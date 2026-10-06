export const ID: string;
export const WALLET: string;
export const SALT: string;
export const CASES: Record<string, string>;
export type Row = { name: string; method: string; args: unknown[] };
export function hardBlockRows(): Row[];
export function measureOnlyRows(): Row[];
