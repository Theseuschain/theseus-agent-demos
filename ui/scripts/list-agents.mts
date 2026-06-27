import { ApiPromise, WsProvider } from "@polkadot/api";
const RPC = "wss://rpc.alpha-testnet.theseus.network";
const u8 = (h:string)=>Buffer.from(String(h).replace(/^0x/,""),"hex").toString("utf8");
const api = await ApiPromise.create({ provider: new WsProvider(RPC,3000), throwOnConnect:true });
const es = await api.query.agents.agents.entries();
for (const [k,v] of es){ const j:any=v.toJSON(); console.log(u8(j.name)+"\t"+k.args[0].toString()); }
await api.disconnect();
