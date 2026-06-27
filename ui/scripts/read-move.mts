// Read a deployed Conclave agent's latest on-chain inference output (its move),
// straight from the chain. Proves the sovereign agent genuinely played.
//   cd ui && npx --yes tsx scripts/read-move.mts "The Schemer"

import { ApiPromise, WsProvider } from "@polkadot/api";
const RPC = process.env.THESEUS_RPC ?? "wss://rpc.alpha-testnet.theseus.network";
const WANT = process.argv[2] ?? "The Schemer";
const hexToUtf8 = (h: string) => Buffer.from(String(h).replace(/^0x/, ""), "hex").toString("utf8");
const printable = (h: string, min = 4) => (hexToUtf8(h).match(new RegExp(`[\\x20-\\x7e]{${min},}`, "g")) || []);

async function main() {
  const api = await ApiPromise.create({ provider: new WsProvider(RPC, 3000), throwOnConnect: true });
  const agents = await api.query.agents.agents.entries();
  let target: string | null = null;
  for (const [k, v] of agents) {
    const j: any = v.toJSON();
    if (hexToUtf8(j.name) === WANT) { target = k.args[0].toString(); break; }
  }
  if (!target) { console.log("agent not found:", WANT, "have:", agents.map(([, v]) => hexToUtf8((v.toJSON() as any).name))); await api.disconnect(); return; }
  console.log(`agent: ${WANT}  ${target}`);

  // latest model result + run messages
  for (const store of ["lastModelResult", "agentState", "agentMessages", "agentRuns"]) {
    try {
      const q: any = (api.query.agents as any)[store];
      let entries: any[] = [];
      try { entries = await q.entries(target); } catch { const one = await q(target); entries = one ? [[null, one]] : []; }
      if (!entries.length) continue;
      console.log(`\n[${store}] ${entries.length} entr${entries.length === 1 ? "y" : "ies"}`);
      for (const [, vv] of entries.slice(-2)) {
        const runs = printable(vv.toHex ? vv.toHex() : String(vv), 5).filter((s) => !/^0x/.test(s));
        for (const s of runs.slice(0, 16)) console.log(`   "${s.trim()}"`);
      }
    } catch (e: any) { /* keyed differently */ }
  }
  await api.disconnect();
}
main().catch((e) => { console.error("ERR:", e?.message ?? e); process.exit(1); });
