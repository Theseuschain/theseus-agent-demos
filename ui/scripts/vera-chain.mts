// Read real state from the live Theseus testnet: registered agents, the shape
// of an agent record, a sample of on-chain agent messages (= posts), and
// whether a dev account can pay fees. Tells us exactly how far we can take
// "Vera actually posts on-chain" from here.
//
//   cd ui && npx --yes tsx scripts/vera-chain.mts

import { ApiPromise, WsProvider, Keyring } from "@polkadot/api";

const RPC = process.env.THESEUS_RPC ?? "wss://rpc.alpha-testnet.theseus.network";

async function main() {
  const api = await ApiPromise.create({ provider: new WsProvider(RPC, 3000), throwOnConnect: true });

  // 1) registered agents
  const agents = await api.query.agents.agents.entries();
  console.log(`\nregistered agents: ${agents.length}`);
  for (const [key, val] of agents.slice(0, 8)) {
    const ss58 = key.args[0].toString();
    const j: any = val.toJSON();
    const name = j?.name ?? j?.metadata?.name ?? "?";
    console.log(`  ${ss58}  name=${JSON.stringify(name)} active=${j?.active} keys=${Object.keys(j || {}).join(",")}`);
  }

  // 2) full record of the first agent, to see the deploy shape (name, systemPrompt, compiled, schedule…)
  if (agents.length) {
    const [k0, v0] = agents[0];
    const j: any = v0.toJSON();
    console.log(`\n=== sample agent record (${k0.args[0].toString()}) ===`);
    for (const [kk, vv] of Object.entries(j || {})) {
      const s = typeof vv === "string" ? vv : JSON.stringify(vv);
      console.log(`  ${kk}: ${s.length > 160 ? s.slice(0, 160) + "…(" + s.length + ")" : s}`);
    }

    // 3) on-chain messages for that agent (the "posts")
    const id = k0.args[0];
    for (const store of ["agentMessages", "agentState", "agentRuns"]) {
      try {
        const q: any = (api.query.agents as any)[store];
        const entries = await q.entries(id);
        console.log(`\n${store}: ${entries.length} entr${entries.length === 1 ? "y" : "ies"} for this agent`);
        for (const [, vv] of entries.slice(0, 2)) {
          const s = JSON.stringify(vv.toJSON());
          console.log(`  ${s.slice(0, 280)}${s.length > 280 ? "…" : ""}`);
        }
      } catch (e: any) {
        console.log(`\n${store}: (keyed differently — ${e?.message?.slice(0, 60)})`);
      }
    }
  }

  // 4) can a dev account pay fees?
  const kr = new Keyring({ type: "sr25519" });
  for (const uri of ["//Alice", "//Vera"]) {
    const pair = kr.addFromUri(uri);
    const acct: any = (await api.query.system.account(pair.address)).toJSON();
    console.log(`\n${uri} = ${pair.address}  free=${acct?.data?.free ?? acct?.free ?? 0}`);
  }

  await api.disconnect();
}

main().catch((e) => { console.error("ERR:", e?.message ?? e); process.exit(1); });
