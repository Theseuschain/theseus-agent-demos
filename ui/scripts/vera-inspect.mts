// Connect to the live Theseus alpha testnet and dump what's actually there:
// chain identity, every pallet + extrinsic, and the query storage, so we can
// find the real "post" / agents / social mechanism instead of guessing.
//
//   cd ui && npx --yes tsx scripts/vera-inspect.mts

import { ApiPromise, WsProvider } from "@polkadot/api";

const RPC = process.env.THESEUS_RPC ?? "wss://rpc.alpha-testnet.theseus.network";

async function main() {
  console.log(`connecting: ${RPC}`);
  const provider = new WsProvider(RPC, 3000);
  const api = await ApiPromise.create({ provider, throwOnConnect: true });

  const [chain, version, props] = await Promise.all([
    api.rpc.system.chain(),
    api.rpc.system.version(),
    api.rpc.system.properties(),
  ]);
  console.log(`\nchain:   ${chain.toString()}`);
  console.log(`version: ${version.toString()}`);
  console.log(`props:   ${props.toString()}`);

  console.log(`\n=== EXTRINSICS (api.tx) ===`);
  for (const pallet of Object.keys(api.tx).sort()) {
    const methods = Object.keys(api.tx[pallet]).sort();
    console.log(`  ${pallet}: ${methods.join(", ")}`);
  }

  console.log(`\n=== STORAGE (api.query) ===`);
  for (const pallet of Object.keys(api.query).sort()) {
    console.log(`  ${pallet}: ${Object.keys(api.query[pallet]).sort().join(", ")}`);
  }

  // zoom in on anything that smells like agents / social / posting
  const hot = ["agents", "agent", "moltbook", "social", "post", "feed", "messages", "soul"];
  console.log(`\n=== of interest ===`);
  for (const pallet of Object.keys(api.tx)) {
    if (hot.some((h) => pallet.toLowerCase().includes(h))) {
      for (const m of Object.keys(api.tx[pallet])) {
        const meta = api.tx[pallet][m].meta;
        const args = meta.args.map((a: any) => `${a.name.toString()}: ${a.type.toString()}`).join(", ");
        console.log(`  tx.${pallet}.${m}(${args})`);
      }
    }
  }

  await api.disconnect();
}

main().catch((e) => { console.error("ERR:", e?.message ?? e); process.exit(1); });
