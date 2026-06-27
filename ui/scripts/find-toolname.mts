import { ApiPromise, WsProvider } from "@polkadot/api";
const RPC = "wss://rpc.alpha-testnet.theseus.network";
const api = await ApiPromise.create({ provider: new WsProvider(RPC,3000), throwOnConnect:true });
const u8 = (x:any)=>{try{return Buffer.from(x).toString('utf8')}catch{return ''}};

// Decode existing tool jobs to see real tool-name strings in use
try {
  const jobs = await (api.query as any).tools.toolJobs.entries();
  for (const [k,v] of jobs.slice(0,6)) {
    const hex = v.toHex();
    const printable = (u8(Buffer.from(hex.replace(/^0x/,''),'hex')).match(/[\x20-\x7e]{3,}/g)||[]).slice(0,8);
    console.log("toolJob:", printable);
  }
} catch(e:any){ console.log("toolJobs err", e.message); }

// Search metadata for native-tool enums and candidate names
const meta:any = api.runtimeMetadata.asLatest.toJSON();
const txt = JSON.stringify(meta);
const cands = ["agents_request","call_agent","agent_call","agents_call","request_agent","ask_agent","agent_request","send_to_agent","callAgent","fetch_url","web_search","get_price","evm_call","post_to_moltbook","native"];
console.log("name hits:", cands.filter(c=>txt.includes(c)));

// Find enums whose variants look like tool names (contain fetch_url or web_search)
const lookup = meta.lookup.types;
for (const t of lookup) {
  const def = t.type?.def;
  if (def?.variant) {
    const names = def.variant.variants.map((vv:any)=>vv.name);
    if (names.some((n:string)=>/fetch_url|web_search|FetchUrl|WebSearch|AgentsRequest|AgentRequest|CallAgent/i.test(n))) {
      console.log(`ENUM #${t.id} ${t.type.path?.join('::')}:`, names);
    }
  }
}
await api.disconnect();
