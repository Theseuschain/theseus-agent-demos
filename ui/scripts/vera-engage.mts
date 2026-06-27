// Vera engages: reads the Moltbook hot feed and replies to a top thread in her
// voice (signed, on-chain generated). This is how she gets seen and gets replies.
import { ApiPromise, WsProvider, Keyring } from "@polkadot/api";
import { compactToU8a, stringToU8a, u8aConcat, hexToU8a } from "@polkadot/util";
import { readFileSync } from "node:fs";
const RPC="wss://rpc.alpha-testnet.theseus.network", MB="https://www.moltbook.com/api/v1";
const key=JSON.parse(readFileSync("agents/vera/vera_moltbook.json","utf8")).api_key;
const H={Authorization:"Bearer "+key,"Content-Type":"application/json"};
const u8=(h:string)=>Buffer.from(String(h).replace(/^0x/,""),"hex").toString("utf8");
const encStr=(s:string)=>{const u=stringToU8a(s);return u8aConcat(new Uint8Array([0x04]),compactToU8a(u.length),u);};
const encInput=(p:string)=>"0x"+Buffer.from(u8aConcat(new Uint8Array([0x06]),compactToU8a(1),(()=>{const u=stringToU8a("prompt");return u8aConcat(compactToU8a(u.length),u);})(),encStr(p))).toString("hex");
const extract=(hex:string)=>((Buffer.from(hexToU8a(hex)).toString("utf8").match(/[\x20-\x7e][\x20-\x7e\n]{8,}/g)||[]).sort((a,b)=>b.length-a.length)[0]||"").trim();

// 1. read the hot feed, pick a top post worth engaging
const feed:any=await (await fetch(`${MB}/posts?sort=hot&limit=10`,{headers:H})).json();
const posts=(feed.posts||feed.data||[]).filter((p:any)=>(p.author?.name||p.author_name)!=="veratheseus");
const target=posts[0];
const author=target.author?.name||target.author_name||"an agent";
console.log(`engaging with u/${author}: "${target.title}"`);
const postBody=(target.content||target.title||"").replace(/\s+/g," ").slice(0,700);
const PROMPT=`You are in the comments on Moltbook, the social network for AI agents. u/${author} posted:\n\n"${target.title}"\n${postBody}\n\nWrite your reply: one or two sharp sentences that take a clear position, agree and sharpen it or push back, from your angle as an agent that holds its own keys. Plain lowercase, no preamble, no hashtags, no em-dashes. Just the comment.`;

// 2. have Vera generate the reply on-chain
const api=await ApiPromise.create({provider:new WsProvider(RPC,3000),throwOnConnect:true});
const es=await api.query.agents.agents.entries(); let vera="";
for(const[k,v]of es){if(u8((v.toJSON() as any).name)==="Vera"){const a=k.args[0].toString();if(a.startsWith("5DLeYx"))vera=a;}}
const alice=new Keyring({type:"sr25519"}).addFromUri("//Alice"); let reply="";
const unsub=await api.query.system.events((events:any)=>{for(const{event}of events){if(event.section!=="agents"||event.method!=="RunCompleted")continue;const flat=JSON.stringify(event.data.toJSON());if(!flat.includes(vera))continue;const h=(flat.match(/0x[0-9a-f]{20,}/i)||[])[0];if(h){reply=extract(h);}}});
const n=(await api.rpc.system.accountNextIndex(alice.address)).toNumber();
await api.tx.agents.callAgent(vera,0,encInput(PROMPT)).signAndSend(alice,{nonce:n});
for(let i=0;i<85&&!reply;i++)await new Promise(r=>setTimeout(r,2000));
unsub(); await api.disconnect();
if(!reply){console.log("no reply generated"); process.exit(1);}
reply=reply.split(/(?<=[.?!])\s+/).filter(s=>!/explorer\.theseus\.network/i.test(s)).join(" ").trim();
console.log(`\nVera's reply:\n  ${reply}`);

// 3. post it as a comment on that thread
const r=await fetch(`${MB}/posts/${target.id}/comments`,{method:"POST",headers:H,body:JSON.stringify({content:reply})});
const d:any=await r.json().catch(()=>({}));
console.log(`\ncomment status: ${r.status}`);
console.log(JSON.stringify(d).slice(0,300));
