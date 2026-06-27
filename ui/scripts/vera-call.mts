import { ApiPromise, WsProvider, Keyring } from "@polkadot/api";
import { compactToU8a, stringToU8a, u8aConcat, hexToU8a } from "@polkadot/util";
const RPC = "wss://rpc.alpha-testnet.theseus.network";
const PROMPT = "Today is June 2026. Make your next call: one specific, dated prediction about where AI agents, crypto, or this whole space is heading. Your whole reply is the post.";
const u8 = (h:string)=>Buffer.from(String(h).replace(/^0x/,""),"hex").toString("utf8");
const encString=(s:string)=>{const u=stringToU8a(s);return u8aConcat(compactToU8a(u.length),u);};
const encStr=(s:string)=>u8aConcat(new Uint8Array([0x04]),encString(s));
const encInput=(p:string)=>u8aConcat(new Uint8Array([0x06]),compactToU8a(1),encString("prompt"),encStr(p));
const decodeOut=(hex:string)=>{const b=hexToU8a(hex);return (Buffer.from(b).toString("utf8").match(/[\x20-\x7e][\x20-\x7e]{8,}/g)||[]).join(" ");};

const api = await ApiPromise.create({ provider:new WsProvider(RPC,3000), throwOnConnect:true });
const es = await api.query.agents.agents.entries();
let vera:string|null=null;
for (const [k,v] of es){ const j:any=v.toJSON(); if(u8(j.name)==="Vera"){ const a=k.args[0].toString(); if(a.startsWith("5DLeYx")) vera=a; if(!vera) vera=a; } }
if(!vera){ console.log("Vera not found"); process.exit(1); }
console.log("Vera:", vera);
const alice = new Keyring({type:"sr25519"}).addFromUri("//Alice");
// fund her a little so she can pay inference
let done=false;
const unsub = await api.query.system.events((events:any)=>{ for(const{event}of events){ if(event.section!=="agents")continue; const flat=JSON.stringify(event.data.toJSON()); if(!flat.includes(vera))continue; if(event.method==="RunCompleted"){ const h=(flat.match(/0x[0-9a-f]{20,}/i)||[])[0]; if(h){ console.log("\n=== VERA'S CALL ===\n"+decodeOut(h)); done=true; } } else if(event.method==="RunFailed"){ console.log("RunFailed",flat.slice(0,160)); done=true; } }});
const n=(await api.rpc.system.accountNextIndex(alice.address)).toNumber();
await (api.tx.balances.transferKeepAlive(vera,3_000_000_000_000n) as any).signAndSend(alice,{nonce:n});
await new Promise(r=>setTimeout(r,6000));
await api.tx.agents.callAgent(vera,0,u8aToHexInput(encInput(PROMPT))).signAndSend(alice,{nonce:n+1},({status,dispatchError}:any)=>{ if(dispatchError)console.log("err",dispatchError.toString().slice(0,60)); });
function u8aToHexInput(u:Uint8Array){return "0x"+Buffer.from(u).toString("hex");}
for(let i=0;i<70&&!done;i++)await new Promise(r=>setTimeout(r,2000));
unsub(); await api.disconnect();
