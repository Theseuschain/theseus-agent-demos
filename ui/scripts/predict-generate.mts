// Mercer makes the markets. For each category we hand the desk agent a set of
// fresh, real topics (surveyed off-chain in predict-topics.json) and it writes a
// batch of clean, tradeable YES/NO markets on-chain, signed. We decode each run
// and save the markets with their on-chain provenance to agent-markets.json,
// which the app loads as its board.
//
//   MARKETMAKER_ADDR=5... npx tsx scripts/predict-generate.mts
//
import { ApiPromise, WsProvider, Keyring } from "@polkadot/api";
import { compactToU8a, stringToU8a, u8aConcat, hexToU8a } from "@polkadot/util";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RPC = process.env.THESEUS_RPC ?? "wss://rpc.alpha-testnet.theseus.network";
const HERE = dirname(fileURLToPath(import.meta.url));
const TOPICS_FILE = resolve(HERE, "predict-topics.json");
const OUT = resolve(HERE, "../src/lib/predict/agent-markets.json");
const EXPLORER = "https://explorer.theseus.network/agents";
const SIGNER = process.env.THESEUS_SIGNER_SEED ?? "//Alice";

const utf8 = (h: string) => Buffer.from(String(h).replace(/^0x/, ""), "hex").toString("utf8");
const encStr = (s: string) => { const u = stringToU8a(s); return u8aConcat(new Uint8Array([0x04]), compactToU8a(u.length), u); };
const encInput = (p: string) => "0x" + Buffer.from(u8aConcat(new Uint8Array([0x06]), compactToU8a(1), (() => { const u = stringToU8a("prompt"); return u8aConcat(compactToU8a(u.length), u); })(), encStr(p))).toString("hex");
function extract(hex: string) {
  const runs = Buffer.from(hexToU8a(hex)).toString("utf8").match(/[\x20-\x7e][\x20-\x7e\n\t]{12,}/g) || [];
  return (runs.sort((a, b) => b.length - a.length)[0] || "").trim();
}

const CAT_ICON: Record<string, string> = {
  Crypto: "📈", Politics: "🇺🇸", Economy: "🏛️", Tech: "🤖",
  Science: "🚀", Culture: "🎬", Sports: "🏆", Trending: "🔥",
};
function iconFor(q: string, cat: string): string {
  const s = q.toLowerCase();
  if (/bitcoin|btc/.test(s)) return "₿";
  if (/ethereum|\beth\b/.test(s)) return "Ξ";
  if (/solana|\bsol\b/.test(s)) return "◎";
  return CAT_ICON[cat] ?? "📊";
}
const slugify = (q: string, id: number) =>
  q.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 56) + "-" + id;

// Plausible display volume: tighter (closer to 50/50) markets read as busier.
function seedVolume(id: number, initialYes: number): number {
  const tight = 1 - Math.abs(initialYes - 0.5) * 2; // 0..1
  const base = 250_000 + tight * 6_000_000;
  const jitter = ((id * 2654435761) % 1000) / 1000;
  return Math.round((base * (0.5 + jitter)) / 1000) * 1000;
}

const FALLBACK_TOPICS: Record<string, string[]> = {
  Crypto: ["bitcoin price range this quarter", "a major exchange listing or delisting", "an ETF flow milestone"],
  Tech: ["a frontier model release", "a big-tech antitrust ruling", "an AI product launch or failure"],
  Politics: ["an upcoming vote or confirmation", "a leadership challenge", "a policy deadline"],
  Economy: ["the next CPI or jobs print", "a central bank decision", "a tariff or trade move"],
  Science: ["a launch or mission milestone", "a clinical trial readout", "a record or discovery"],
  Sports: ["a title race", "a transfer or trade", "a record attempt"],
  Culture: ["a box office opening", "an awards outcome", "a release date holding or slipping"],
};

const TODAY = new Date().toISOString().slice(0, 10);
function buildPrompt(category: string, topics: string[]) {
  const lines = topics.map((t) => "- " + t).join("\n");
  return `Today is ${TODAY}. Every deadline must be a real future date after today.

Category: ${category}

Threads surfacing right now:
${lines}

You are building the LONG TAIL: specific, niche markets that Polymarket and Kalshi would never bother to list because they are too small or too specific. This is the whole point of the desk.

Hard rules:
- Do NOT write macro/head markets. No "will bitcoin hit $X", no "will the Fed cut rates", no "will <big company> IPO", no broad index or rate or top-line price bets. Those already exist everywhere.
- Instead DRILL DOWN to something specific and granular: a named person, product, repo, game, song, creator, team, protocol, or token, and a precise metric from a named public source.
- Altitude to aim for: "will <specific game>'s next patch ship before <date>", "will <named creator> pass <N> subscribers", "will <specific song> enter the Spotify Global Top 50", "will <named repo> cross <N> GitHub stars", "will <specific player> score in <specific match>", "will <named app> hit #1 on the US App Store".
- Still objectively decidable from a named public source, genuinely uncertain, with a future deadline.

Return ONLY a JSON array of 3 objects, each with EXACTLY these keys: "question" (ends with ?), "shortTitle" (under 70 chars), "description" (one sentence), "category" ("${category}"), "resolutionCriteria" (exact, objective, names a source and the deadline), "resolutionSource" (named source), "deadlineISO" ("YYYY-MM-DD", after ${TODAY}), "initialYes" (number 0.05-0.95). No text before or after the array.`;
}

function parseMarkets(raw: string): any[] {
  const m = raw.match(/\[[\s\S]*\]/);
  if (!m) return [];
  try { return JSON.parse(m[0]); } catch {
    // tolerate trailing commas / fence noise
    try { return JSON.parse(m[0].replace(/,\s*([\]}])/g, "$1")); } catch { return []; }
  }
}

async function main() {
  const topics: Record<string, string[]> = existsSync(TOPICS_FILE)
    ? JSON.parse(readFileSync(TOPICS_FILE, "utf8"))
    : FALLBACK_TOPICS;
  const categories = Object.keys(topics);

  const api = await ApiPromise.create({ provider: new WsProvider(RPC, 3000), throwOnConnect: true });
  const signer = new Keyring({ type: "sr25519" }).addFromUri(SIGNER);

  // Mercer is the only desk agent. (Override with MARKETMAKER_ADDR if needed.)
  const agentName = "Mercer";
  let agentAddr = process.env.MARKETMAKER_ADDR ?? "";
  const entries = await api.query.agents.agents.entries();
  if (!agentAddr) {
    const mercer = entries.filter(([, v]) => utf8((v.toJSON() as any).name) === "Mercer").map(([k]) => k.args[0].toString());
    if (mercer.length) agentAddr = mercer[mercer.length - 1];
  }
  if (!agentAddr) throw new Error("Mercer not found on chain (deploy Mercer or set MARKETMAKER_ADDR)");
  console.log(`desk agent: ${agentName} ${agentAddr}`);

  // top the agent up so it can pay for inference
  const n0 = (await api.rpc.system.accountNextIndex(signer.address)).toNumber();
  await (api.tx.balances.transferKeepAlive(agentAddr, 5_000_000_000_000n) as any).signAndSend(signer, { nonce: n0 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 6000));

  const createdAtISO = new Date().toISOString();
  const out: any[] = [];
  let id = 5200;

  for (const category of categories) {
    const prompt = buildPrompt(category, topics[category] ?? FALLBACK_TOPICS[category] ?? []);
    let seq = -1, text = "";
    let submitAt = Date.now();
    const got = new Promise<void>(async (resolveP) => {
      const timer = setTimeout(() => resolveP(), 200_000);
      const unsub = await api.query.system.events((events: any) => {
        // ignore the immediate replay of the previous run's event; the real
        // completion of THIS call lands ~60-90s later (inference takes time).
        if (Date.now() - submitAt < 18_000) return;
        for (const { event } of events) {
          if (event.section !== "agents" || event.method !== "RunCompleted") continue;
          const flat = JSON.stringify(event.data.toJSON());
          if (!flat.includes(agentAddr)) continue;
          const hex = (flat.match(/0x[0-9a-f]{20,}/i) || [])[0];
          const t = hex ? extract(hex) : "";
          if (t) { seq = Number((flat.match(/"seq":(\d+)/) || [])[1] ?? -1); text = t; clearTimeout(timer); unsub(); resolveP(); }
        }
      });
      const n = (await api.rpc.system.accountNextIndex(signer.address)).toNumber();
      submitAt = Date.now();
      await api.tx.agents.callAgent(agentAddr, 0, encInput(prompt)).signAndSend(signer, { nonce: n });
    });
    await got;
    const markets = parseMarkets(text);
    console.log(`${category}: ${markets.length} markets (run seq ${seq})`);
    for (const mk of markets) {
      if (!mk?.question || !mk?.resolutionCriteria || !mk?.deadlineISO) continue;
      const initialYes = Math.min(0.95, Math.max(0.05, Number(mk.initialYes) || 0.5));
      const vol = seedVolume(id, initialYes);
      out.push({
        id,
        slug: slugify(mk.question, id),
        question: String(mk.question),
        shortTitle: String(mk.shortTitle || mk.question).slice(0, 80),
        description: String(mk.description || ""),
        category,
        icon: iconFor(mk.question, category),
        resolutionCriteria: String(mk.resolutionCriteria),
        resolutionSource: String(mk.resolutionSource || "Public record"),
        deadlineISO: String(mk.deadlineISO).slice(0, 10),
        initialYes,
        liquidityB: Math.min(20000, Math.max(2500, 2500 + vol / 1500)),
        volumeUsd: vol,
        resolvable: false,
        createdBy: { agent: agentName, address: agentAddr, runSeq: seq, createdAtISO, explorerUrl: `${EXPLORER}/${agentAddr}` },
      });
      id++;
    }
  }

  if (!out.length) throw new Error("no markets generated");
  writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(`\nwrote ${out.length} markets -> ${OUT}`);
  await api.disconnect();
}
main().catch((e) => { console.error("ERR:", e?.message ?? e); process.exit(1); });
