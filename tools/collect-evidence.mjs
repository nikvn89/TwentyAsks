// Read-only collector. Preserves raw responses and errors; NEVER certifies payment.
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const [parent, recipient, outgoing] = process.argv.slice(2);
const walletRx=/^0x[0-9a-fA-F]{40}$/;
const hashRx=/^0x[0-9a-fA-F]{64}$/;
const balanceOnly=parent === '--balance';
if ((!balanceOnly && !hashRx.test(parent || '')) || !walletRx.test(recipient || '') || (outgoing && !hashRx.test(outgoing))) {
  console.error('Usage: node tools/collect-evidence.mjs PARENT_HASH RECIPIENT [OUTGOING_HASH]\nBefore withdrawing: node tools/collect-evidence.mjs --balance RECIPIENT');
  process.exit(2);
}
const rpc=process.env.RPC_URL || 'https://studio.genlayer.com/api';
async function read(method,params) {
  try {
    const res=await fetch(rpc,{method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(20000)});
    if(!res.ok) return {error:`HTTP ${res.status}`};
    return await res.json();
  } catch(e) { return {error:String(e.message || e)}; }
}
const report={
  recorded_at:new Date().toISOString(), recipient, parent:balanceOnly?null:parent, outgoing:outgoing || null,
  certification:'UNVERIFIED_RAW_EVIDENCE',
  limitations:['Parent execution is not delivery proof.', 'Outgoing hash supplied by operator: verify its parent linkage independently.',
    'Latest balance is not an isolated transfer delta. Preserve the before snapshot and account for other transactions.',
    'Missing/unsupported fields are not successful results.'],
  chain_id:await read('eth_chainId',[]), block_number:await read('eth_blockNumber',[]),
  recipient_balance:await read('eth_getBalance',[recipient,'latest'])
};
if(!balanceOnly) {
  report.parent_transaction=await read('eth_getTransactionByHash',[parent]);
  report.parent_receipt=await read('eth_getTransactionReceipt',[parent]);
}
if(outgoing) {
  report.outgoing_transaction=await read('eth_getTransactionByHash',[outgoing]);
  report.outgoing_receipt=await read('eth_getTransactionReceipt',[outgoing]);
}
const dir=resolve('docs/evidence/v2'); await mkdir(dir,{recursive:true});
const file=resolve(dir,`${balanceOnly?'balance-before':'withdrawal'}-${Date.now()}.json`);
await writeFile(file,JSON.stringify(report,null,2)+'\n');
console.log(`Saved raw evidence: ${file}\nDelivery is NOT certified. Review errors, finality, source/recipient/value, parent linkage and wallet balance.`);
