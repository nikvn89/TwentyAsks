// v2 requires a NEW deployment; never reuse the v1 address.
export const PROJECT_DEPLOYMENT = "";
export const CONTRACT_ADDRESS = (String(import.meta.env.VITE_CONTRACT_ADDRESS ?? "").trim() || PROJECT_DEPLOYMENT) as `0x${string}` | "";

// Same-origin proxy declared in BOTH vite.config.ts and vercel.json.
// Every read, every receipt poll and the write client use this one URL.
export const RPC_PATH = "/genlayer-rpc";

export const STUDIONET_CHAIN_ID = 61999;
export const STUDIONET_CHAIN_HEX = "0xf22f";
// Only used when MetaMask must add the network (wallet_addEthereumChain needs an absolute URL).
export const WALLET_ADD_RPC = "https://studio.genlayer.com/api";
export const EXPLORER_BASE = "https://explorer-studio.genlayer.com";

export const SOURCE_SHA256 = "06189c50d9adb5c15692389b3da8e8dac08b23665fa160578e1deae795faa22a";

export const RECEIPT_TIMEOUT_MS = 150_000;
export const RECEIPT_POLL_MS = 3_000;
