// Decode a real sovereign agent's on-chain content (Sovereign Chat): its name,
// its system prompt, and the readable text of its latest on-chain run message.
// This is the exact on-chain slot Vera will occupy once deployed.
//
//   cd ui && npx --yes tsx scripts/vera-readchain.mts

import { ApiPromise, WsProvider } from "@polkadot/api";

const RPC = process.env.THESEUS_RPC ?? "wss://rpc.alpha-testnet.theseus.network";
const SOVEREIGN_CHAT = "5H19J2TURyDVdRLi2WxZWhcYtYXj3ZeuS4sCivPmdCJHcbY5";

const hexToUtf8 = (h: string) => Buffer.from(h.replace(/^0x/, ""), "hex").toString("utf8");
// pull human-readable runs out of a SCALE blob we don't have the codec for
const printable = (h: string, min = 4) =>
  (hexToUtf8(h).match(new RegExp(`[\\x20-\\x7e]{${min},}`, "g")) || []);

async function main() {
  const api = await ApiPromise.create({ provider: new WsProvider(RPC, 3000), throwOnConnect: true });

  const rec: any = (await api.query.agents.agents(SOVEREIGN_CHAT)).toJSON();
  console.log(`\n=== ${SOVEREIGN_CHAT} ===`);
  console.log(`name:    ${hexToUtf8(rec.name)}`);
  console.log(`mode:    ${rec.mode}      owner: ${rec.owner ?? "null (no operator — sovereign)"}`);
  console.log(`active:  ${rec.active}    version: ${rec.version}`);
  console.log(`compiledHash: ${rec.compiledHash}`);
  const prompt = hexToUtf8(rec.systemPrompt).replace(/[^\x20-\x7e\n]/g, "");
  console.log(`\nsystem prompt (on-chain, first 360 chars):\n  ${prompt.slice(0, 360).replace(/\n/g, "\n  ")}…`);

  // its latest on-chain run state (= what it has "posted"/produced)
  const state = await api.query.agents.agentState.entries(SOVEREIGN_CHAT);
  console.log(`\non-chain run state: ${state.length} entr${state.length === 1 ? "y" : "ies"}`);
  for (const [, vv] of state.slice(0, 1)) {
    const runs = printable(vv.toHex(), 5).filter((s) => !/^0x/.test(s));
    console.log(`  readable content from the latest run:`);
    for (const s of runs.slice(0, 12)) console.log(`    "${s.trim()}"`);
  }

  console.log(`\nverify yourself: explorer.theseus.network/agents/${SOVEREIGN_CHAT}`);
  await api.disconnect();
}

main().catch((e) => { console.error("ERR:", e?.message ?? e); process.exit(1); });
