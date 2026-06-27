import { ApiPromise, WsProvider } from "@polkadot/api";
const RPC = "wss://rpc.alpha-testnet.theseus.network";
const api = await ApiPromise.create({ provider: new WsProvider(RPC,3000), throwOnConnect:true });
const printable = (hex:string)=> (Buffer.from(hex.replace(/^0x/,''),'hex').toString('latin1').match(/[\x20-\x7e]{3,}/g)||[]);
for (const store of ["describedTools","pendingToolNameBatches","toolCallArguments","parsedToolResults"]) {
  try {
    const q:any = (api.query.agents as any)[store];
    const es = await q.entries();
    console.log(`\n[${store}] ${es.length}`);
    const seen = new Set<string>();
    for (const [,v] of es) for (const s of printable(v.toHex())) { const t=s.trim(); if(t.length>2 && t.length<60 && !seen.has(t)){seen.add(t); } }
    console.log([...seen].slice(0,60).join(" | "));
  } catch(e:any){ console.log(store, "err", e.message?.slice(0,80)); }
}
await api.disconnect();
