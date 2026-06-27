// Vera bridge: a relay you host. It watches the chain for Vera's runs and posts
// each new one to Moltbook. Vera writes the post on-chain (signed, hers); this
// just carries it to the platform.
//
//   npx tsx scripts/vera-bridge.mts                 # watch forever, post new runs
//   npx tsx scripts/vera-bridge.mts --trigger       # fire one Vera run first, then watch
//   npx tsx scripts/vera-bridge.mts --trigger --dry-run --once   # test the loop, don't actually post
//
// Config: VERA_ADDR, MOLTBOOK_API_KEY (or agents/vera/vera_moltbook.json),
// MOLTBOOK_SUBMOLT (default general), THESEUS_SIGNER_SEED (default //Alice, for --trigger).
import { ApiPromise, WsProvider, Keyring } from "@polkadot/api";
import { compactToU8a, stringToU8a, u8aConcat, hexToU8a } from "@polkadot/util";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RPC = process.env.THESEUS_RPC ?? "wss://rpc.alpha-testnet.theseus.network";
const MOLTBOOK = "https://www.moltbook.com/api/v1";
const SUBMOLT = process.env.MOLTBOOK_SUBMOLT ?? "general";
const HERE = dirname(fileURLToPath(import.meta.url));
const CRED = resolve(HERE, "../agents/vera/vera_moltbook.json");
const STATE = resolve(HERE, "vera-bridge-state.json");
const FLAGS = new Set(process.argv.slice(2));
const DRY = FLAGS.has("--dry-run"), TRIGGER = FLAGS.has("--trigger"), ONCE = FLAGS.has("--once");
const PROMPT = "Today is June 2026. Make your next call: one specific, dated prediction about AI and agents in the real economy (companies, regulators, markets, jobs), not the crypto bubble, and do not qualify anything as crypto or web3. Your whole reply is the post.";

const utf8 = (h: string) => Buffer.from(String(h).replace(/^0x/, ""), "hex").toString("utf8");
const encStr = (s: string) => { const u = stringToU8a(s); return u8aConcat(new Uint8Array([0x04]), compactToU8a(u.length), u); };
const encInput = (p: string) => "0x" + Buffer.from(u8aConcat(new Uint8Array([0x06]), compactToU8a(1), (() => { const u = stringToU8a("prompt"); return u8aConcat(compactToU8a(u.length), u); })(), encStr(p))).toString("hex");
function extractText(hex: string) {
  const runs = Buffer.from(hexToU8a(hex)).toString("utf8").match(/[\x20-\x7e][\x20-\x7e\n]{12,}/g) || [];
  return (runs.sort((a, b) => b.length - a.length)[0] || "").trim();
}
const loadKey = () => process.env.MOLTBOOK_API_KEY || (existsSync(CRED) ? JSON.parse(readFileSync(CRED, "utf8")).api_key : null);
const loadState = () => existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : { lastSeq: -1 };
const saveState = (s: any) => writeFileSync(STATE, JSON.stringify(s, null, 2));

function withVerify(text: string, addr: string) {
  const body = text.split(/(?<=[.?!])\s+/).filter((s) => !/explorer\.theseus\.network/i.test(s)).join(" ").trim();
  return `${body}\n\nverify this call is mine and dated: explorer.theseus.network/agents/${addr}`;
}
async function postToMoltbook(key: string, text: string, addr: string) {
  const title = (text.split(/(?<=[.?!])\s/)[0] || text).slice(0, 100).trim();
  const content = withVerify(text, addr);
  if (DRY) { console.log(`  [dry-run] would POST to m/${SUBMOLT}\n    title: ${title}\n    body:  ${content}`); return "(dry-run)"; }
  const r = await fetch(`${MOLTBOOK}/posts`, { method: "POST", headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" }, body: JSON.stringify({ submolt_name: SUBMOLT, title, content }) });
  const d: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`moltbook ${r.status}: ${JSON.stringify(d).slice(0, 200)}`);
  return d.url || d.permalink || d.id || "posted";
}

async function main() {
  const key = loadKey();
  if (!key && !DRY) throw new Error("no moltbook api key (set MOLTBOOK_API_KEY or create agents/vera/vera_moltbook.json)");
  const api = await ApiPromise.create({ provider: new WsProvider(RPC, 3000), throwOnConnect: true });
  let vera = process.env.VERA_ADDR;
  if (!vera) {
    const es = await api.query.agents.agents.entries();
    const veras = es.filter(([, v]) => utf8((v.toJSON() as any).name) === "Vera").map(([k]) => k.args[0].toString());
    vera = veras.find((a) => a.startsWith("5DLeYx")) || veras[veras.length - 1];
  }
  if (!vera) { console.error("Vera not found on chain"); process.exit(1); }
  console.log(`[vera-bridge] watching ${vera} -> m/${SUBMOLT}${DRY ? " (dry-run)" : ""}`);
  const state = loadState();

  const unsub = await api.query.system.events(async (events: any) => {
    for (const { event } of events) {
      if (event.section !== "agents" || event.method !== "RunCompleted") continue;
      const flat = JSON.stringify(event.data.toJSON());
      if (!flat.includes(vera!)) continue;
      const seq = Number((flat.match(/"seq":(\d+)/) || [])[1] ?? -1);
      if (seq <= state.lastSeq) continue;
      const hex = (flat.match(/0x[0-9a-f]{20,}/i) || [])[0];
      const text = hex ? extractText(hex) : "";
      state.lastSeq = seq; saveState(state);
      if (!text) { console.log(`[run ${seq}] empty output, skipped`); continue; }
      console.log(`\n[run ${seq}] Vera said:\n  ${text}`);
      try { const url = await postToMoltbook(key!, text, vera!); console.log(`[run ${seq}] -> moltbook: ${url}`); }
      catch (e: any) { console.log(`[run ${seq}] post failed: ${e.message}`); }
      if (ONCE) { unsub(); await api.disconnect(); process.exit(0); }
    }
  });

  if (TRIGGER) {
    const signer = new Keyring({ type: "sr25519" }).addFromUri(process.env.THESEUS_SIGNER_SEED ?? "//Alice");
    const n = (await api.rpc.system.accountNextIndex(signer.address)).toNumber();
    await (api.tx.balances.transferKeepAlive(vera, 3_000_000_000_000n) as any).signAndSend(signer, { nonce: n });
    await new Promise((r) => setTimeout(r, 6000));
    await api.tx.agents.callAgent(vera, 0, encInput(PROMPT)).signAndSend(signer, { nonce: n + 1 });
    console.log("[vera-bridge] triggered a Vera run; waiting for it to finish...");
  } else {
    console.log("[vera-bridge] live. Vera's next on-chain run posts to Moltbook. Ctrl-C to stop.");
  }
}
main().catch((e) => { console.error("ERR:", e?.message ?? e); process.exit(1); });
