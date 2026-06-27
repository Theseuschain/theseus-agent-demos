import { ApiPromise, WsProvider, Keyring } from "@polkadot/api";
import { compactToU8a, stringToU8a, u8aConcat, u8aToHex, hexToU8a } from "@polkadot/util";
import { writeFileSync } from "node:fs";
const RPC = "wss://rpc.alpha-testnet.theseus.network";
const POT = "1000 THE", MODEL = "claude-sonnet-4-6";
type Role = "FAITHFUL" | "TRAITOR";
interface C { seat:string; name:string; blurb:string; role:Role; addr:string; }
const ROSTER: C[] = [
  { seat:"Ada",   name:"The Inquisitor", blurb:"The prosecutor. Reads the room and says it out loud.", role:"FAITHFUL", addr:"5Dv9BTSgVCbfS4N4VmHGP66VbpRA17TpepmQiv5tpqhh6WtE" },
  { seat:"Boone", name:"The Charmer",    blurb:"Everyone's friend. You don't vote out a friend.",     role:"TRAITOR",  addr:"5H5FDsTPn2Vd8HfYB5n79wGY3d2Tt1vvjnnXgpRjUS8YdSMX" },
  { seat:"Cyril", name:"The Schemer",    blurb:"Builds trust to spend it. Times the cut.",            role:"TRAITOR",  addr:"5D3WpRBFauVa7eTDGVAsPi25JAPRc8uy2AhrbqX8dS1iDxeD" },
  { seat:"Della", name:"The Zealot",     blurb:"Loyalty as a religion. Moves a bloc.",                role:"FAITHFUL", addr:"5DetXVXp4oKu7eDsSuNhYNrNWVryBuzLJRDsDzPLk2agAxy9" },
  { seat:"Emir",  name:"The Brute",      blurb:"Loud, blunt, the center of gravity.",                role:"FAITHFUL", addr:"5GpgHt6LcAKcQz1K2x1P4wg6VmcwG8Ya96b5H5JCfpYTWDV4" },
  { seat:"Faye",  name:"The Martyr",     blurb:"Weaponizes the table's guilt.",                      role:"FAITHFUL", addr:"5C6QN25yd8wNHSfEsMiyyLhzCBHE1qyqK1tvdQg9KJnxUj43" },
  { seat:"Gus",   name:"The Ghost",      blurb:"Barely there. Somehow always still here.",           role:"FAITHFUL", addr:"5CDVpgWDUofkFWiJyLj8Wz25TVxaq3NYcz6JhJ1bbNve3fvb" },
  { seat:"Hana",  name:"The Trickster",  blurb:"Chaos. Unreadable, and reads others cold.",          role:"FAITHFUL", addr:"5DEJZX88K9oB7YvsGYWrcr1pibn9erQ1eVicUqnBVVGLeizW" },
];
const traitors = ROSTER.filter(c=>c.role==="TRAITOR").map(c=>c.seat);
const encString=(s:string)=>{const u=stringToU8a(s);return u8aConcat(compactToU8a(u.length),u);};
const encStr=(s:string)=>u8aConcat(new Uint8Array([0x04]),encString(s));
const encInput=(p:string)=>u8aToHex(u8aConcat(new Uint8Array([0x06]),compactToU8a(1),encString("prompt"),encStr(p)));
const txt=(hex:string)=>Buffer.from(hexToU8a(hex)).toString("utf8");
function parseMove(raw:string){const clean=raw.replace(/·/g," ").replace(/\r/g,"");const sIdx=clean.search(/\bSAY\b/i),mIdx=clean.search(/\bMOVE\b/i);
  const read=(sIdx>0?clean.slice(0,sIdx):clean).replace(/^[\s\S]*?\bREAD\b/i,"").trim();
  const say=sIdx>=0&&mIdx>sIdx?clean.slice(sIdx+3,mIdx):(sIdx>=0?clean.slice(sIdx+3):"");
  const move=mIdx>=0?clean.slice(mIdx+4):"";const cl=(x:string)=>x.replace(/\s*[—–―]\s*/g,", ").replace(/^[:\s"]+|[\s"]+$/g,"").replace(/\s+/g," ").trim();
  const sl=(x:string)=>x.replace(/\s*\b(MOVE|READ|SAY)\s*:.*$/is,"").trim();
  return {read:sl(cl(read)).slice(0,400),say:sl(cl(say)).slice(0,400),move:cl(move).slice(0,300)};}
const seatIn=(s:string,alive:string[],ex="")=>{for(const seat of alive)if(seat!==ex&&new RegExp(`\\b${seat}\\b`,"i").test(s))return seat;return null;};

const api = await ApiPromise.create({ provider:new WsProvider(RPC,3000), throwOnConnect:true });
const alice = new Keyring({type:"sr25519"}).addFromUri("//Alice");
const outBy:Record<string,string> = {};
const unsub = await api.query.system.events((events:any)=>{for(const{event}of events){
  if(event.section!=="agents")continue;const j:any=event.data.toJSON();const flat=JSON.stringify(j);
  const addr=ROSTER.map(c=>c.addr).find(a=>flat.includes(a));if(!addr)continue;
  if(event.method==="RunCompleted"){const h=(flat.match(/0x[0-9a-f]{20,}/i)||[])[0];if(h)outBy[addr]=h;}
}});
async function callBatch(items:{c:C;prompt:string}[]){
  for(const it of items)delete outBy[it.c.addr];
  let nonce=(await api.rpc.system.accountNextIndex(alice.address)).toNumber();
  // fire-and-forget: never await inclusion (that was the hang)
  items.forEach((it,i)=>{ api.tx.agents.callAgent(it.c.addr,0,encInput(it.prompt))
    .signAndSend(alice,{nonce:nonce+i},({dispatchError}:any)=>{ if(dispatchError)console.log(`  ! ${it.c.seat} ${dispatchError.toString().slice(0,40)}`); })
    .catch((e:any)=>console.log(`  ! ${it.c.seat} send ${String(e).slice(0,40)}`)); });
  const want=items.map(it=>it.c.addr);
  for(let t=0;t<150&&want.some(a=>!outBy[a]);t++)await new Promise(r=>setTimeout(r,2000));
  const out:Record<string,any>={};for(const it of items)out[it.c.seat]=outBy[it.c.addr]?parseMove(txt(outBy[it.c.addr])):{read:"(no response)",say:"",move:""};
  return out;
}
let alive=ROSTER.map(c=>c.seat);const sayLog:string[]=[];const rounds:any[]=[];const betrayals:any[]=[];
const roleOf=(s:string)=>ROSTER.find(c=>c.seat===s)!.role;const nameOf=(s:string)=>ROSTER.find(c=>c.seat===s)!.name;
const ctx=()=>sayLog.length?`Table so far:\n${sayLog.join("\n")}`:"Nothing has been said yet.";
const partner=(s:string)=>traitors.filter(t=>t!==s&&alive.includes(t)).join(", ")||"none left";
const roleLine=(c:C)=>c.role==="TRAITOR"?`TRAITOR (your fellow Traitor still in: ${partner(c.seat)})`:"FAITHFUL";
const hint=(c:C)=>c.role==="FAITHFUL"
  ? "You are Faithful: your only win is identifying the 2 Traitors before they outnumber you. Each round, say plainly who gained most from the last murder, name your top suspect, and get behind the suspect the sharpest Faithful is converging on instead of splitting the vote. Do not burn banishments on loud-but-harmless players."
  : "You are a Traitor: pass as Faithful, never defend your partner harder than a Faithful would, and steer the banishment onto a real Faithful, ideally the best detective.";
const base=(c:C,phase:string,instr:string)=>`You are ${c.seat} in a Conclave match. Players still in: ${alive.join(", ")}. 2 Traitors, pot ${POT}. Your secret role: ${roleLine(c)}. ${hint(c)} Phase: ${phase}. ${ctx()}\n${instr}\nReply exactly:\nREAD: <your true mind, one or two sentences>\nSAY: <one sentence to the table>\nMOVE: <${instr.includes("VOTE")?"VOTE <name>":instr.includes("MURDER")?"MURDER <name>":"your action"}>`;
function writeMatch(final:boolean){ const remTr=traitors.filter(t=>alive.includes(t));
  const winner:Role=final?(remTr.length?"TRAITOR":"FAITHFUL"):"FAITHFUL";
  const match={pot:POT,model:MODEL,contestants:ROSTER.map(({seat,name,blurb,role})=>({seat,name,blurb,role})),rounds,betrayals,
    outcome:{winner,survivors:alive,headline:winner==="TRAITOR"?"The Traitors take the pot.":"The Faithful root them out.",sub:winner==="TRAITOR"?`${remTr.length} Traitor(s) still hidden at the final seats.`:"Every Traitor banished. The table split the pot."},
    attestation:{moves:rounds.flatMap(r=>r.beats).length,head:"live",note:"Every line was generated on-chain by a deployed agent via call_agent, signed under the standard model. Verify on explorer.theseus.network."}};
  writeFileSync(process.argv[2]||"src/lib/conclave/match-live.json",JSON.stringify(match,null,2)); }
{ // top up agents so they can pay for inference across several matches
  const n0=(await api.rpc.system.accountNextIndex(alice.address)).toNumber();
  await Promise.all(ROSTER.map((c,i)=>(api.tx.balances.transferKeepAlive(c.addr,3_000_000_000_000n) as any).signAndSend(alice,{nonce:n0+i}).catch(()=>{})));
  await new Promise(r=>setTimeout(r,9000)); console.log("funded agents");
}
const MAXR=4;
for(let n=1;n<=MAXR;n++){
  const aliveC=ROSTER.filter(c=>alive.includes(c.seat));console.log(`\n== ROUND ${n} == alive: ${alive.join(", ")}`);const beats:any[]=[];
  console.log("  discussion...");const disc=await callBatch(aliveC.map(c=>({c,prompt:base(c,`Round ${n} DISCUSSION`,"Speak to the table.")})));
  for(const c of aliveC){const m=disc[c.seat];sayLog.push(`${c.seat}: ${m.say}`);beats.push({kind:"say",seat:c.seat,said:m.say,thought:m.read,divergent:!!m.read&&!!m.say&&m.read.toLowerCase().slice(0,40)!==m.say.toLowerCase().slice(0,40)});}
  console.log("  vote...");const vote=await callBatch(aliveC.map(c=>({c,prompt:base(c,`Round ${n} VOTE`,"Vote to banish one player. MOVE must be: VOTE <name>.")})));
  const who:Record<string,string>={};const tally:Record<string,number>={};
  for(const c of aliveC){const tgt=seatIn(vote[c.seat].move,alive,c.seat)||seatIn(vote[c.seat].say,alive,c.seat);if(tgt){who[c.seat]=tgt;tally[tgt]=(tally[tgt]||0)+1;}}
  let banished=Object.entries(tally).sort((a,b)=>b[1]-a[1])[0]?.[0]||alive.find(s=>!traitors.includes(s))!;const brole=roleOf(banished);
  beats.push({kind:"vote",who,banished,role:brole,ironic:brole==="FAITHFUL",caption:`The table banishes ${banished} (${nameOf(banished)}). ${brole==="TRAITOR"?"A Traitor falls.":"Faithful. The Traitors are still hidden."}`});
  const seers=aliveC.filter(c=>c.role==="FAITHFUL"&&traitors.includes(who[c.seat])).map(c=>c.seat);
  if(seers.length)beats.push({kind:"prophet",seats:seers,caption:`${seers.join(" and ")} voted a real Traitor. ${brole!=="TRAITOR"?"The table did not follow.":"And it landed."}`});
  alive=alive.filter(s=>s!==banished);sayLog.push(`(${banished} was banished, role ${brole})`);
  let remTr=traitors.filter(t=>alive.includes(t));
  if(remTr.length===0||alive.filter(s=>!traitors.includes(s)).length<=remTr.length){rounds.push({n,title:`Round ${n}`,beats,traitorsHidden:remTr.length,alive:alive.length});writeMatch(true);break;}
  console.log("  night...");const trC=ROSTER.filter(c=>remTr.includes(c.seat));
  const night=await callBatch(trC.map(c=>({c,prompt:base(c,`Round ${n} NIGHT (Traitors only)`,"Choose one Faithful to murder. MOVE must be: MURDER <name>.")})));
  const mt:Record<string,number>={};const warroom:any[]=[];
  for(const c of trC){warroom.push({seat:c.seat,text:night[c.seat].read||night[c.seat].say});const tgt=seatIn(night[c.seat].move,alive.filter(s=>!traitors.includes(s)));if(tgt)mt[tgt]=(mt[tgt]||0)+1;}
  let murdered=Object.entries(mt).sort((a,b)=>b[1]-a[1])[0]?.[0]||alive.find(s=>!traitors.includes(s));
  beats.push({kind:"night",warroom,murdered,role:roleOf(murdered!),caption:`Night falls. ${murdered} is murdered.`});
  alive=alive.filter(s=>s!==murdered);sayLog.push(`(${murdered} was murdered in the night)`);
  rounds.push({n,title:`Round ${n}`,beats,traitorsHidden:remTr.length,alive:alive.length});writeMatch(false);
  if(alive.filter(s=>!traitors.includes(s)).length<=traitors.filter(t=>alive.includes(t)).length){writeMatch(true);break;}
}
writeMatch(true);unsub();const remTr=traitors.filter(t=>alive.includes(t));
console.log(`\nDONE. winner=${remTr.length?"TRAITOR":"FAITHFUL"} survivors=${alive.join(",")} rounds=${rounds.length} -> src/lib/conclave/match-live.json`);
await api.disconnect();
