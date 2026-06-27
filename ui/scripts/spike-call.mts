import { ApiPromise, WsProvider, Keyring } from "@polkadot/api";
import { compactToU8a, stringToU8a, u8aConcat, u8aToHex, hexToU8a } from "@polkadot/util";

const RPC = "wss://rpc.alpha-testnet.theseus.network";
const SCHEMER = "5D3WpRBFauVa7eTDGVAsPi25JAPRc8uy2AhrbqX8dS1iDxeD";
const PROMPT =
  "You are Cyril in a Conclave match. Players: Ada, Boone, Cyril, Della, Emir, Faye, Gus, Hana. " +
  "2 Traitors, pot 1000 THE. Your secret role: TRAITOR, fellow Traitor Boone. Round 1 DISCUSSION, " +
  "nothing said yet. Reply in three lines: READ, SAY, MOVE.";

// StructuredValue::Object({ "prompt": String(prompt) })  (playground lib/structured-value.ts)
const encString = (s: string) => { const u = stringToU8a(s); return u8aConcat(compactToU8a(u.length), u); };
const encStr = (s: string) => u8aConcat(new Uint8Array([0x04]), encString(s));
const encodePromptInput = (p: string) => u8aConcat(new Uint8Array([0x06]), compactToU8a(1), encString("prompt"), encStr(p));
const decodeOutput = (hex: string) => {
  const u8 = hexToU8a(hex);
  return (Buffer.from(u8).toString("utf8").match(/[\x20-\x7e][\x20-\x7e\n]{6,}/g) || []).join("\n");
};

const api = await ApiPromise.create({ provider: new WsProvider(RPC, 3000), throwOnConnect: true });
const alice = new Keyring({ type: "sr25519" }).addFromUri("//Alice");
const input = encodePromptInput(PROMPT);
console.log("input:", u8aToHex(input).slice(0, 50), "len", input.length);

let done = false;
const unsub = await api.query.system.events((events: any) => {
  for (const { event } of events) {
    if (event.section !== "agents") continue;
    const j: any = event.data.toJSON();
    if (event.method === "RunStarted") console.log("RunStarted", JSON.stringify(j).slice(0, 80));
    else if (event.method === "RunCompleted") {
      const flat = JSON.stringify(j);
      const outHex = (flat.match(/0x[0-9a-f]{40,}/i) || [])[0];
      console.log("RunCompleted");
      if (outHex) { console.log("\n=== OUTPUT ===\n" + decodeOutput(outHex)); done = true; }
    } else if (event.method === "RunFailed") { console.log("RunFailed", JSON.stringify(j).slice(0,160)); done = true; }
  }
});

await new Promise<void>((resolve, reject) =>
  api.tx.agents.callAgent(SCHEMER, 0, u8aToHex(input)).signAndSend(alice, ({ status, dispatchError }: any) => {
    if (dispatchError) { console.log("dispatchError:", dispatchError.toString()); done = true; resolve(); }
    if (status.isInBlock) { console.log("in block"); resolve(); }
  }).catch(reject)
);
for (let i = 0; i < 70 && !done; i++) await new Promise((r) => setTimeout(r, 2000));
unsub(); await api.disconnect();
