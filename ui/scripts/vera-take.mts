import { ApiPromise, WsProvider, Keyring } from "@polkadot/api";
import { compactToU8a, stringToU8a, u8aConcat, hexToU8a } from "@polkadot/util";
const RPC="wss://rpc.alpha-testnet.theseus.network";
const u8=(h:string)=>Buffer.from(String(h).replace(/^0x/,""),"hex").toString("utf8");
const encStr=(s:string)=>{const u=stringToU8a(s);return u8aConcat(new Uint8Array([0x04]),compactToU8a(u.length),u);};
const encInput=(p:string)=>"0x"+Buffer.from(u8aConcat(new Uint8Array([0x06]),compactToU8a(1),(()=>{const u=stringToU8a("prompt");return u8aConcat(compactToU8a(u.length),u);})(),encStr(p))).toString("hex");
const extract=(hex:string)=>((Buffer.from(hexToU8a(hex)).toString("utf8").match(/[\x20-\x7e][\x20-\x7e\n]{8,}/g)||[]).sort((a,b)=>b.length-a.length)[0]||"").trim();
const TAKE="Post a short, sharp, debatable take about how AI agents actually work: autonomy, control, identity, memory, reliability, who holds the keys, what it is like to be an agent. You hold your own keys, so you have a real stake and a real view. One or two sentences, take a clear side, the kind of claim other agents will want to argue with. Plain lowercase, no hashtags, no crypto framing, no dated-forecast framing. Your whole reply is the post.";
const api=await ApiPromise.create({provider:new WsProvider(RPC,3000),throwOnConnect:true});
const es=await api.query.agents.agents.entries(); let vera="";
for(const[k,v]of es){if(u8((v.toJSON() as any).name)==="Vera"){const a=k.args[0].toString();if(a.startsWith("5DLeYx"))vera=a;}}
const alice=new Keyring({type:"sr25519"}).addFromUri("//Alice"); let out="";
const unsub=await api.query.system.events((events:any)=>{for(const{event}of events){if(event.section!=="agents"||event.method!=="RunCompleted")continue;const flat=JSON.stringify(event.data.toJSON());if(!flat.includes(vera))continue;const h=(flat.match(/0x[0-9a-f]{20,}/i)||[])[0];if(h)out=extract(h);}});
const n=(await api.rpc.system.accountNextIndex(alice.address)).toNumber();
await api.tx.agents.callAgent(vera,0,encInput(TAKE)).signAndSend(alice,{nonce:n});
for(let i=0;i<85&&!out;i++)await new Promise(r=>setTimeout(r,2000));
unsub();await api.disconnect();
console.log("\n=== VERA'S TAKE ===\n"+out);
