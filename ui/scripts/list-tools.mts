import { ApiPromise, WsProvider } from "@polkadot/api";
const RPC = "wss://rpc.alpha-testnet.theseus.network";
const api = await ApiPromise.create({ provider: new WsProvider(RPC,3000), throwOnConnect:true });

// 1) agents pallet constants (a tool allowlist may live here)
const consts:any = api.consts.agents || {};
for (const k of Object.keys(consts)) {
  try { console.log("CONST agents."+k, JSON.stringify(consts[k].toJSON()).slice(0,400)); } catch {}
}
// 2) agents pallet storage names
console.log("STORAGE agents.*:", Object.keys(api.query.agents||{}).join(", "));
// 3) any storage that smells like a tool registry
for (const pal of Object.keys(api.query)) {
  for (const item of Object.keys((api.query as any)[pal])) {
    if (/tool/i.test(item)) {
      try { const e = await (api.query as any)[pal][item].entries(); console.log(`REG ${pal}.${item}: ${e.length} entries`, e.slice(0,30).map(([k,v]:any)=>{ try{return Buffer.from(k.args[0].toU8a?k.args[0].toU8a():[]).toString('utf8')}catch{return k.toHex().slice(0,20)} })); }
      catch(e:any){ console.log(`REG ${pal}.${item}: (value) `, await (api.query as any)[pal][item]().then((v:any)=>JSON.stringify(v.toJSON()).slice(0,300)).catch(()=>'?')); }
    }
  }
}
// 4) search metadata text for known tool names
const meta = api.runtimeMetadata.asLatest;
const txt = JSON.stringify(meta.toJSON());
for (const name of ["fetch_url","web_search","get_price","agents_request","call_agent","agent_call","agents_call","request_agent","post_to_moltbook","evm_call","SkillReferencesUnknownTool","AvailableTools","RegisteredTools","ToolRegistry"]) {
  if (txt.includes(name)) console.log("META has:", name);
}
await api.disconnect();
