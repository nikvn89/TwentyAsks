import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import {
  CONTRACT_ADDRESS,
  RECEIPT_POLL_MS,
  RECEIPT_TIMEOUT_MS,
  RPC_PATH,
  STUDIONET_CHAIN_HEX,
  STUDIONET_CHAIN_ID,
  WALLET_ADD_RPC,
} from "./config";
import { classifyTransaction, type ReceiptVerdict } from "./receipt";
import { parseCredits, parseGame, parseLimits, type Limits } from "./parse";
import type { Credits, Game } from "./types";

declare global {
  interface Window {
    ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown>; on?: (e: string, f: (...a: any[]) => void) => void };
  }
}

function rpcUrl(): string {
  return `${window.location.origin}${RPC_PATH}`;
}

/** One proxied chain for reads AND writes. Only the six signing methods go through window.ethereum. */
function proxiedChain(): any {
  const chain: any = studionet as any;
  return {
    ...chain,
    rpcUrls: { ...(chain.rpcUrls ?? {}), default: { http: [rpcUrl()] }, public: { http: [rpcUrl()] } },
  };
}

let readClientCache: any = null;
function readClient(): any {
  if (!readClientCache) readClientCache = createClient({ chain: proxiedChain() } as any);
  return readClientCache;
}

function ethereum() {
  if (!window.ethereum) throw new Error("MetaMask was not found in this browser.");
  return window.ethereum;
}

function requireAddress(): `0x${string}` {
  if (!CONTRACT_ADDRESS) throw new Error("This deployment has no contract address configured.");
  return CONTRACT_ADDRESS as `0x${string}`;
}

export async function connectedWallet(): Promise<string> {
  if (!window.ethereum) return "";
  const accounts = (await window.ethereum.request({ method: "eth_accounts" })) as string[];
  return (accounts?.[0] ?? "").toLowerCase();
}

export async function requestWallet(): Promise<string> {
  const accounts = (await ethereum().request({ method: "eth_requestAccounts" })) as string[];
  if (!accounts?.[0]) throw new Error("No wallet account was returned.");
  return accounts[0].toLowerCase();
}

/** Switch MetaMask to StudioNet with wallet_switchEthereumChain (4902 -> add). No Snap is requested. */
export async function ensureStudioNet(): Promise<void> {
  const eth = ethereum();
  const current = (await eth.request({ method: "eth_chainId" })) as string;
  if (Number.parseInt(current, 16) === STUDIONET_CHAIN_ID) return;
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: STUDIONET_CHAIN_HEX }] });
    return;
  } catch (error: any) {
    if (Number(error?.code) === 4001) throw new Error("Network switch was rejected.");
    if (Number(error?.code) !== 4902) throw error;
  }
  await eth.request({
    method: "wallet_addEthereumChain",
    params: [{
      chainId: STUDIONET_CHAIN_HEX,
      chainName: "GenLayer Studio Network",
      rpcUrls: [WALLET_ADD_RPC],
      nativeCurrency: { name: "GEN Token", symbol: "GEN", decimals: 18 },
    }],
  });
  await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: STUDIONET_CHAIN_HEX }] });
}

async function view(functionName: string, args: unknown[]): Promise<string> {
  const raw = await readClient().readContract({ address: requireAddress(), functionName, args });
  return typeof raw === "string" ? raw : JSON.stringify(raw ?? "");
}

export async function getGame(id: string): Promise<Game | null> {
  return parseGame(await view("get_game", [id]));
}

export async function getCredits(wallet: string): Promise<Credits | null> {
  return parseCredits(await view("get_credits", [wallet]));
}

export async function getLimits(): Promise<Limits | null> {
  return parseLimits(await view("get_limits", []));
}

/** open_game is the only payable write; every other write sends value 0. */
export async function sendWrite(account: string, functionName: string, args: unknown[], value: bigint = 0n): Promise<string> {
  await ensureStudioNet();
  const client: any = createClient({
    chain: proxiedChain(),
    account: account as `0x${string}`,
    provider: window.ethereum as any,
  } as any);
  return (await client.writeContract({ address: requireAddress(), functionName, args, value })) as string;
}

async function rawTransaction(hash: string): Promise<any> {
  const response = await fetch(rpcUrl(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "eth_getTransactionByHash", params: [hash] }),
  });
  const body = await response.json();
  return body?.result ?? null;
}

/** Poll ~150 s. "pending" at the end means: submitted, confirmation delayed. */
export async function waitForVerdict(hash: string): Promise<ReceiptVerdict> {
  const deadline = Date.now() + RECEIPT_TIMEOUT_MS;
  let last: ReceiptVerdict = { kind: "pending", status: "" };
  while (Date.now() < deadline) {
    try {
      const tx = await rawTransaction(hash);
      if (tx) {
        last = classifyTransaction(tx);
        if (last.kind !== "pending") return last;
      }
    } catch {
      /* keep polling */
    }
    await new Promise((r) => setTimeout(r, RECEIPT_POLL_MS));
  }
  return last;
}
