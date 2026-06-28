"use client";

import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatUnits, parseUnits } from "viem";
import {
  EUSDC_ADDRESS, EUSDC_DECIMALS, ERC20_ABI, OUTCOME,
  PREDICT_CHAIN_ID, PREDICT_MARKET_ABI, PREDICT_MARKET_ADDRESS,
} from "@/lib/predict/onchain";
import { cents, pct } from "@/lib/predict/format";
import type { Outcome, SeedMarket } from "@/lib/predict/types";

const market = PREDICT_MARKET_ADDRESS as `0x${string}`;
const fmt = (v: bigint) => Number(formatUnits(v, EUSDC_DECIMALS));

export default function OnChainTradePanel({ seed }: { seed: SeedMarket }) {
  const { address, isConnected, chainId } = useAccount();
  const [side, setSide] = useState<Outcome>("YES");
  const [amount, setAmount] = useState("");
  const { writeContractAsync, isPending } = useWriteContract();
  const [busy, setBusy] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const { isLoading: mining } = useWaitForTransactionReceipt({ hash: txHash });

  const id = BigInt(seed.id);
  const wrongChain = isConnected && chainId !== PREDICT_CHAIN_ID;

  const { data: priceRaw, refetch: refetchPrice } = useReadContract({ address: market, abi: PREDICT_MARKET_ABI, functionName: "priceYes", args: [id], chainId: PREDICT_CHAIN_ID });
  const { data: mkt, refetch: refetchMkt } = useReadContract({ address: market, abi: PREDICT_MARKET_ABI, functionName: "markets", args: [id], chainId: PREDICT_CHAIN_ID });
  const { data: myShares, refetch: refetchShares } = useReadContract({ address: market, abi: PREDICT_MARKET_ABI, functionName: "sharesOf", args: [id, address ?? "0x0000000000000000000000000000000000000000"], chainId: PREDICT_CHAIN_ID, query: { enabled: !!address } });
  const { data: bal, refetch: refetchBal } = useReadContract({ address: EUSDC_ADDRESS, abi: ERC20_ABI, functionName: "balanceOf", args: [address ?? "0x0000000000000000000000000000000000000000"], chainId: PREDICT_CHAIN_ID, query: { enabled: !!address } });
  const { data: allowance, refetch: refetchAllow } = useReadContract({ address: EUSDC_ADDRESS, abi: ERC20_ABI, functionName: "allowance", args: [address ?? "0x0", market], chainId: PREDICT_CHAIN_ID, query: { enabled: !!address } });

  const pYes = priceRaw != null ? Number(priceRaw) / 1e18 : seed.initialYes;
  const resolved = mkt ? (mkt as unknown as any[])[4] === true : false;
  const winnerYes = mkt ? (mkt as unknown as any[])[5] === 0 : false;
  const amt = parseFloat(amount) || 0;

  const refreshAll = () => { refetchPrice(); refetchMkt(); refetchShares(); refetchBal(); refetchAllow(); };
  const after = async (h: `0x${string}`) => { setTxHash(h); await new Promise((r) => setTimeout(r, 4000)); refreshAll(); setBusy(null); setAmount(""); };

  async function getTestUsdc() {
    if (!address) return;
    setBusy("Minting test eUSDC...");
    try { const h = await writeContractAsync({ address: EUSDC_ADDRESS, abi: ERC20_ABI, functionName: "mint", args: [address, parseUnits("1000", EUSDC_DECIMALS)], chainId: PREDICT_CHAIN_ID }); await after(h); }
    catch { setBusy(null); }
  }

  async function buy() {
    if (!address || amt <= 0) return;
    const wei = parseUnits(String(amt), EUSDC_DECIMALS);
    try {
      if (!allowance || (allowance as bigint) < wei) {
        setBusy("Approving eUSDC...");
        const a = await writeContractAsync({ address: EUSDC_ADDRESS, abi: ERC20_ABI, functionName: "approve", args: [market, parseUnits("1000000", EUSDC_DECIMALS)], chainId: PREDICT_CHAIN_ID });
        await new Promise((r) => setTimeout(r, 3000)); await refetchAllow(); void a;
      }
      setBusy(`Buying ${side}...`);
      const h = await writeContractAsync({ address: market, abi: PREDICT_MARKET_ABI, functionName: "buy", args: [id, side === "YES" ? OUTCOME.YES : OUTCOME.NO, wei, 0n], chainId: PREDICT_CHAIN_ID });
      await after(h);
    } catch { setBusy(null); }
  }

  async function redeem() {
    setBusy("Redeeming...");
    try { const h = await writeContractAsync({ address: market, abi: PREDICT_MARKET_ABI, functionName: "redeem", args: [id], chainId: PREDICT_CHAIN_ID }); await after(h); }
    catch { setBusy(null); }
  }

  const working = !!busy || isPending || mining;
  const yesSh = myShares ? fmt((myShares as unknown as bigint[])[0]) : 0;
  const noSh = myShares ? fmt((myShares as unknown as bigint[])[1]) : 0;

  return (
    <div className="rounded-xl border border-border bg-surface/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-coral">On-chain · Base Sepolia</span>
        <span className="font-mono text-[10.5px] text-fg-mute">{pct(pYes)} YES</span>
      </div>

      {!isConnected ? (
        <div className="py-4 text-center">
          <p className="mb-3 text-[13px] text-fg-dim">Connect a wallet to trade this market with testnet eUSDC.</p>
          <div className="flex justify-center"><ConnectButton showBalance={false} chainStatus="none" /></div>
        </div>
      ) : wrongChain ? (
        <div className="py-4 text-center">
          <p className="mb-3 text-[13px] text-amber">Switch your wallet to Base Sepolia to trade.</p>
          <div className="flex justify-center"><ConnectButton showBalance={false} /></div>
        </div>
      ) : resolved ? (
        <div className="space-y-3">
          <p className="rounded-lg border border-border bg-bg px-3 py-2 text-center text-[12.5px] text-fg">
            Resolved <span style={{ color: winnerYes ? "var(--green)" : "var(--red)" }}>{winnerYes ? "YES" : "NO"}</span> by the agent.
          </p>
          <p className="text-[12.5px] text-fg-dim">You hold {yesSh.toFixed(2)} YES, {noSh.toFixed(2)} NO. Winning shares redeem 1 eUSDC each.</p>
          <button onClick={redeem} disabled={working} className="w-full rounded-lg bg-coral py-3 text-[14px] font-semibold text-white disabled:opacity-50">
            {working ? busy ?? "Working..." : "Redeem winnings"}
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            {(["YES", "NO"] as const).map((o) => {
              const sel = side === o; const isYes = o === "YES"; const op = isYes ? pYes : 1 - pYes;
              return (
                <button key={o} onClick={() => setSide(o)}
                  className={`rounded-lg border py-2.5 text-center transition-colors ${sel ? "text-white" : isYes ? "border-[color-mix(in_srgb,var(--green)_35%,transparent)] text-green" : "border-[color-mix(in_srgb,var(--red)_35%,transparent)] text-red"}`}
                  style={sel ? { background: isYes ? "var(--green)" : "var(--red)", borderColor: "transparent" } : undefined}>
                  <div className="text-[13px] font-semibold">{o}</div>
                  <div className="font-mono text-[12px] opacity-90">{cents(op)}</div>
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-[11px] text-fg-mute">
              <span>Amount (eUSDC)</span>
              <button onClick={getTestUsdc} disabled={working} className="text-coral hover:underline disabled:opacity-50">balance {bal ? fmt(bal as bigint).toFixed(0) : "0"} · get test eUSDC</button>
            </div>
            <div className="flex items-center rounded-lg border border-border bg-bg px-3">
              <span className="text-[14px] text-fg-mute">$</span>
              <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0" className="w-full bg-transparent px-2 py-2.5 text-[16px] text-fg outline-none tabular-nums" />
            </div>
            <div className="mt-2 flex gap-1.5">
              {[10, 50, 100].map((v) => <button key={v} onClick={() => setAmount(String(v))} className="rounded-md border border-border px-2.5 py-1 text-[12px] text-fg-mute hover:text-fg">${v}</button>)}
            </div>
          </div>

          <button onClick={buy} disabled={working || amt <= 0} className="mt-4 w-full rounded-lg py-3 text-[14px] font-semibold text-white disabled:opacity-50" style={{ background: side === "YES" ? "var(--green)" : "var(--red)" }}>
            {working ? busy ?? "Working..." : `Buy ${side} · $${amt || 0}`}
          </button>

          {(yesSh > 0 || noSh > 0) && (
            <div className="mt-4 border-t border-border pt-3 text-[12.5px]">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-fg-mute">Your position</p>
              {yesSh > 0 && <div className="flex justify-between"><span className="text-fg-mute">{yesSh.toFixed(2)} YES</span></div>}
              {noSh > 0 && <div className="flex justify-between"><span className="text-fg-mute">{noSh.toFixed(2)} NO</span></div>}
            </div>
          )}
        </>
      )}

      <p className="mt-3 text-center font-mono text-[10px] text-fg-mute">collateral: eUSDC on Base Sepolia · settled by the Theseus agent</p>
    </div>
  );
}
