"use client";

import { useRouter } from "next/navigation";
import PriceChart from "./PriceChart";
import type { PricePoint, SeedMarket, Settlement } from "@/lib/predict/types";
import { cents, compactUsd, pct, untilDeadline, isPast } from "@/lib/predict/format";

interface Props {
  seed: SeedMarket;
  priceYes: number;
  history: PricePoint[];
  volume: number;
  settlement?: Settlement;
  featured?: boolean;
  hot?: boolean;
  change?: number;
}

export default function MarketCard({ seed, priceYes, history, volume, settlement, featured, hot, change = 0 }: Props) {
  const router = useRouter();
  const href = `/predict/${seed.slug}`;
  const go = (side?: "YES" | "NO") =>
    router.push(side ? `${href}?side=${side}` : href);

  const resolved = !!settlement;
  const past = isPast(seed.deadlineISO);
  const noPrice = 1 - priceYes;
  const yesMult = priceYes > 0.01 ? 1 / priceYes : 0;
  const noMult = noPrice > 0.01 ? 1 / noPrice : 0;

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => go()}
      onKeyDown={(e) => (e.key === "Enter" ? go() : undefined)}
      className="group flex cursor-pointer flex-col rounded-xl border border-border bg-surface/40 p-4 transition-all duration-150 hover:-translate-y-0.5 hover:border-fg/25 hover:bg-surface/70 hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {hot && (
            <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-coral/12 px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.12em] text-coral">
              Hot {change >= 0 ? "▲" : "▼"}{Math.abs(Math.round(change * 100))}
            </span>
          )}
          <p className="line-clamp-2 text-[15px] font-medium leading-snug text-fg">
            {seed.shortTitle}
          </p>
        </div>
        <div className="shrink-0 text-right leading-none">
          <div className="font-serif text-[22px] font-medium tracking-tight tabular-nums text-fg">
            {pct(priceYes)}
          </div>
          <div className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.14em] text-fg-mute">
            chance
          </div>
        </div>
      </div>

      <div className={featured ? "mt-3" : "mt-3 h-10"}>
        <PriceChart history={history} height={featured ? 96 : 40} variant={featured ? "full" : "spark"} />
      </div>

      {resolved ? (
        <div className="mt-3">
          {settlement!.verdict === "UNRESOLVABLE" ? (
            <div className="rounded-lg border border-border px-3 py-2 text-center text-[12.5px] font-semibold text-amber">
              UNRESOLVABLE · refunded
            </div>
          ) : (
            <div
              className="rounded-lg px-3 py-2 text-center text-[12.5px] font-semibold text-white"
              style={{
                background: settlement!.winningOutcome === "YES" ? "var(--green)" : "var(--red)",
              }}
            >
              Resolved {settlement!.winningOutcome} · {settlement!.confidencePct}%
            </div>
          )}
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              go("YES");
            }}
            className="flex items-baseline justify-center gap-1.5 rounded-lg border border-[color-mix(in_srgb,var(--green)_35%,transparent)] bg-[color-mix(in_srgb,var(--green)_10%,transparent)] py-2 text-[13px] font-semibold text-green transition-colors hover:bg-[color-mix(in_srgb,var(--green)_18%,transparent)]"
          >
            <span>Yes {cents(priceYes)}</span>
            <span className="font-mono text-[10.5px] font-medium opacity-70">{yesMult.toFixed(1)}×</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              go("NO");
            }}
            className="flex items-baseline justify-center gap-1.5 rounded-lg border border-[color-mix(in_srgb,var(--red)_35%,transparent)] bg-[color-mix(in_srgb,var(--red)_10%,transparent)] py-2 text-[13px] font-semibold text-red transition-colors hover:bg-[color-mix(in_srgb,var(--red)_18%,transparent)]"
          >
            <span>No {cents(noPrice)}</span>
            <span className="font-mono text-[10.5px] font-medium opacity-70">{noMult.toFixed(1)}×</span>
          </button>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-[11.5px] text-fg-mute">
        <span>{compactUsd(volume)} Vol</span>
        {resolved ? (
          <span>Settled by agent</span>
        ) : past ? (
          <span className="rounded-full bg-amber/15 px-2 py-0.5 font-medium text-amber">Agent can settle</span>
        ) : (
          <span>{untilDeadline(seed.deadlineISO)}</span>
        )}
      </div>
    </div>
  );
}
