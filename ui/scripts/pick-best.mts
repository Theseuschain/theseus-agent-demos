import { readFileSync, writeFileSync, existsSync } from "node:fs";
const cands = ["/tmp/cand-1.json","/tmp/cand-2.json","/tmp/cand-3.json"].filter(existsSync);
let best:any=null, bestScore=-1, bestPath="";
for (const p of cands){
  let m:any; try { m = JSON.parse(readFileSync(p,"utf8")); } catch { continue; }
  let sayN=0,div=0,proph=0,trCaught=0,noResp=0;
  for (const r of m.rounds) for (const b of r.beats){
    if (b.kind==="say"){ sayN++; if (b.divergent) div++; if (/no response/i.test(b.thought||"")) noResp++; }
    if (b.kind==="prophet") proph++;
    if (b.kind==="vote" && b.role==="TRAITOR") trCaught++;
  }
  // drama: more rounds, a Traitor actually banished, prophet tension, divergence; penalize dead beats
  const score = m.rounds.length*10 + trCaught*25 + proph*6 + div*1 - noResp*8;
  console.log(`${p}: rounds=${m.rounds.length} trCaught=${trCaught} proph=${proph} div=${div}/${sayN} noResp=${noResp} winner=${m.outcome.winner} score=${score}`);
  if (score>bestScore){ bestScore=score; best=m; bestPath=p; }
}
if (best){ writeFileSync("src/lib/conclave/match-live.json", JSON.stringify(best,null,2)); console.log(`\nBEST: ${bestPath} (score ${bestScore}) -> src/lib/conclave/match-live.json`); }
else console.log("no candidates");
