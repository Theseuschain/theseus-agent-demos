// Seeds the on-chain markets to realistic prices so the board reflects real
// on-chain state (not a flat 50/50). For each market it computes the eUSDC buy
// needed to move priceYes to the market's target (initialYes) under the FPMM,
// then sends it from the deployer wallet. Run once after deploy:
//   node scripts/predict-seed-onchain.mjs
import { createWalletClient, createPublicClient, http, parseUnits, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { readFileSync } from "fs";

const PM = "0xC7c57c7991eF070bAe55c2c5C9566c3C89E2a5F1";
const EU = "0x6aaBC0dBC77Bb5F79781D42E2F58F1312bEf607B";
const RPC = process.env.BASE_SEPOLIA_RPC ?? "https://sepolia.base.org";

const markets = JSON.parse(readFileSync(new URL("../src/lib/predict/agent-markets.json", import.meta.url)));
const env = readFileSync(new URL("../../contracts/.env", import.meta.url), "utf8");
const PK = env.match(/AGENT_PK=(0x[0-9a-fA-F]+)/)[1];

const account = privateKeyToAccount(PK);
const pub = createPublicClient({ chain: baseSepolia, transport: http(RPC) });
const wallet = createWalletClient({ account, chain: baseSepolia, transport: http(RPC) });

const PM_ABI = [
  { type: "function", name: "buy", stateMutability: "nonpayable", inputs: [{ name: "id", type: "uint256" }, { name: "outcome", type: "uint8" }, { name: "amountIn", type: "uint256" }, { name: "minSharesOut", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "priceYes", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "markets", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ name: "reserveYes", type: "uint256" }, { name: "reserveNo", type: "uint256" }, { name: "collateral", type: "uint256" }, { name: "open", type: "bool" }, { name: "resolved", type: "bool" }, { name: "winner", type: "uint8" }] },
];
const EU_ABI = [
  { type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "s", type: "address" }, { name: "a", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "o", type: "address" }, { name: "s", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function send(fn, args, contract = PM, abi = PM_ABI, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const hash = await wallet.writeContract({ address: contract, abi, functionName: fn, args });
      await pub.waitForTransactionReceipt({ hash });
      return hash;
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(3000); // ride out public-RPC read-after-write lag
    }
  }
}

// Top up eUSDC + approval only if the deployer isn't already funded (avoids a
// fresh mint racing the first buy on the public RPC).
const bal = await pub.readContract({ address: EU, abi: EU_ABI, functionName: "balanceOf", args: [account.address] });
if (bal < parseUnits("250000", 6)) { await send("mint", [account.address, parseUnits("300000", 6)], EU, EU_ABI); await sleep(4000); }
const allow = await pub.readContract({ address: EU, abi: EU_ABI, functionName: "allowance", args: [account.address, PM] });
if (allow < parseUnits("250000", 6)) await send("approve", [PM, parseUnits("100000000", 6)], EU, EU_ABI);

for (const m of markets) {
  const id = BigInt(m.id);
  const st = await pub.readContract({ address: PM, abi: PM_ABI, functionName: "markets", args: [id] });
  const rY = Number(st[0]) / 1e6, rN = Number(st[1]) / 1e6;
  const p = m.initialYes;
  // amountIn (in eUSDC) to move priceYes to p under the contract's FPMM.
  let side, a;
  const aYes = Math.sqrt((p * rY * rN) / (1 - p)) - rN;
  if (aYes >= 0.5) { side = 0; a = aYes; }
  else {
    const aNo = Math.sqrt(((1 - p) * rY * rN) / p) - rY;
    if (aNo >= 0.5) { side = 1; a = aNo; } else { console.log(`${m.id} already ~${p}, skip`); continue; }
  }
  await send("buy", [id, side, parseUnits(a.toFixed(6), 6), 0n]);
  const px = await pub.readContract({ address: PM, abi: PM_ABI, functionName: "priceYes", args: [id] });
  console.log(`${m.id} -> target ${(p * 100).toFixed(0)}%  got ${(Number(formatUnits(px, 18)) * 100).toFixed(1)}%  (${side ? "NO" : "YES"} ${a.toFixed(0)} eUSDC)`);
}
console.log("done");
