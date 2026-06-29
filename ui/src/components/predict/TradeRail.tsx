"use client";

import { useState } from "react";
import TradePanel from "./TradePanel";
import OnChainTradePanel from "./OnChainTradePanel";
import { isOnChainMarket } from "@/lib/predict/onchain";
import type { Outcome, SeedMarket } from "@/lib/predict/types";

/**
 * The trade rail. Play-money "Practice" is the default so anyone can size a
 * bet and see shares, price impact and payout instantly — no wallet wall. For
 * markets that are live on Base Sepolia, a toggle swaps to the on-chain panel.
 */
export default function TradeRail({
  seed,
  initialSide = "YES",
}: {
  seed: SeedMarket;
  initialSide?: Outcome;
}) {
  const onChain = isOnChainMarket(seed.id);
  const [mode, setMode] = useState<"practice" | "onchain">("practice");

  return (
    <div>
      {onChain && (
        <div className="mb-2 grid grid-cols-2 gap-1 rounded-lg border border-border p-1">
          {(
            [
              ["practice", "Practice"],
              ["onchain", "On-chain"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-md py-1.5 text-[12.5px] font-semibold transition-colors ${
                mode === m ? "bg-fg/[0.08] text-fg" : "text-fg-mute hover:text-fg"
              }`}
            >
              {label}
              {m === "onchain" && (
                <span className="ml-1.5 align-middle font-mono text-[9px] uppercase tracking-[0.12em] text-coral">
                  Base Sepolia
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {onChain && mode === "onchain" ? (
        <OnChainTradePanel seed={seed} />
      ) : (
        <TradePanel seed={seed} initialSide={initialSide} />
      )}
    </div>
  );
}
