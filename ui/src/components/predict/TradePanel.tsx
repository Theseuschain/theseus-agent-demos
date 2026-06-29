"use client";

import { useEffect, useMemo, useState } from "react";
import { buyCost, priceYes as priceYesFn, quoteBuy, sellProceeds } from "@/lib/predict/amm";
import { buy, liquidityB, sell, usePredict } from "@/lib/predict/store";
import { cents, isPast, pct, shares as fmtShares, usd } from "@/lib/predict/format";
import type { Outcome, SeedMarket } from "@/lib/predict/types";

const QUICK = [10, 50, 100, 500];

export default function TradePanel({
  seed,
  initialSide = "YES",
}: {
  seed: SeedMarket;
  initialSide?: Outcome;
}) {
  const state = usePredict();
  const [side, setSide] = useState<Outcome>(initialSide);
  const [mode, setMode] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => setSide(initialSide), [initialSide]);
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 2600);
    return () => clearTimeout(t);
  }, [flash]);

  const rt = state.markets[seed.id];
  const settled = !!state.settlements[seed.id];
  const resolving = isPast(seed.deadlineISO);
  const b = liquidityB(seed.id);
  const pYes = rt ? priceYesFn(rt.qYes, rt.qNo, b) : seed.initialYes;
  const sidePrice = side === "YES" ? pYes : 1 - pYes;
  const pos = state.positions[seed.id];
  const held = pos ? (side === "YES" ? pos.yesShares : pos.noShares) : 0;
  const amt = parseFloat(amount) || 0;

  const buyQuote = useMemo(() => {
    if (!rt || mode !== "buy" || amt <= 0) return null;
    return quoteBuy(rt.qYes, rt.qNo, b, side, amt);
  }, [rt, mode, amt, side, b]);

  const sellQuote = useMemo(() => {
    if (!rt || mode !== "sell" || amt <= 0) return null;
    const s = Math.min(amt, held);
    if (s <= 0) return null;
    const proceeds = sellProceeds(rt.qYes, rt.qNo, b, side, s);
    return { shares: s, proceeds, avgPrice: proceeds / s };
  }, [rt, mode, amt, side, held, b]);

  // Depth: eUSDC needed to move this side's price up by one cent. Lower = deeper.
  const depthUsd = useMemo(() => {
    if (!rt) return 0;
    const moveShares = (0.01 * b) / Math.max(0.0004, sidePrice * (1 - sidePrice));
    return buyCost(rt.qYes, rt.qNo, b, side, moveShares);
  }, [rt, b, side, sidePrice]);

  if (settled) {
    return (
      <div className="rounded-xl border border-border bg-surface/40 p-5 text-center">
        <p className="text-[13px] text-fg-mute">
          This market is resolved. Trading is closed.
        </p>
      </div>
    );
  }

  const canBuy = !!buyQuote && amt > 0 && amt <= state.balance;
  const canSell = !!sellQuote && sellQuote.shares > 0;

  const submit = () => {
    if (mode === "buy" && canBuy) {
      const r = buy(seed.id, side, amt);
      if (r) setFlash(`Bought ${fmtShares(r.shares)} ${side} @ ${cents(r.avgPrice)}`);
      setAmount("");
    } else if (mode === "sell" && canSell && sellQuote) {
      const r = sell(seed.id, side, sellQuote.shares);
      if (r) setFlash(`Sold ${fmtShares(sellQuote.shares)} ${side} for ${usd(r.proceeds, { cents: true })}`);
      setAmount("");
    }
  };

  return (
    <div className="rounded-xl border border-border bg-surface/40 p-4">
      {/* Buy / Sell */}
      <div className="grid grid-cols-2 gap-1 rounded-lg border border-border p-1">
        {(["buy", "sell"] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setAmount("");
            }}
            className={`rounded-md py-1.5 text-[13px] font-semibold capitalize transition-colors ${
              mode === m ? "bg-fg/[0.08] text-fg" : "text-fg-mute hover:text-fg"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Outcome */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {(["YES", "NO"] as const).map((o) => {
          const op = o === "YES" ? pYes : 1 - pYes;
          const sel = side === o;
          const isYes = o === "YES";
          return (
            <button
              key={o}
              onClick={() => setSide(o)}
              className={`rounded-lg border py-2.5 text-center transition-colors ${
                sel
                  ? "text-white"
                  : isYes
                    ? "border-[color-mix(in_srgb,var(--green)_35%,transparent)] text-green hover:bg-[color-mix(in_srgb,var(--green)_8%,transparent)]"
                    : "border-[color-mix(in_srgb,var(--red)_35%,transparent)] text-red hover:bg-[color-mix(in_srgb,var(--red)_8%,transparent)]"
              }`}
              style={
                sel
                  ? { background: isYes ? "var(--green)" : "var(--red)", borderColor: "transparent" }
                  : undefined
              }
            >
              <div className="text-[13px] font-semibold">{o}</div>
              <div className="font-mono text-[12px] opacity-90">{cents(op)}</div>
            </button>
          );
        })}
      </div>

      {/* Liquidity / depth */}
      <div className="mt-2.5 flex items-center justify-between rounded-lg border border-border bg-bg/60 px-3 py-1.5 text-[11px] text-fg-mute">
        <span>LMSR market maker</span>
        <span className="tabular-nums">~{usd(depthUsd)} moves {side} 1¢</span>
      </div>

      {resolving && (
        <p className="mt-3 rounded-lg border border-border bg-bg px-3 py-2 text-center text-[11.5px] font-medium text-amber">
          Resolving. You can keep trading until the agent settles it below.
        </p>
      )}
      {/* Amount */}
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-[11px] text-fg-mute">
              <span>{mode === "buy" ? "Amount (USDC)" : `Shares to sell`}</span>
              {mode === "sell" && <span>You hold {fmtShares(held)}</span>}
            </div>
            <div className="flex items-center rounded-lg border border-border bg-bg px-3">
              <span className="text-[14px] text-fg-mute">{mode === "buy" ? "$" : "◎"}</span>
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0"
                className="w-full bg-transparent px-2 py-2.5 text-[16px] text-fg outline-none tabular-nums"
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {mode === "buy"
                ? QUICK.map((v) => (
                    <button
                      key={v}
                      onClick={() => setAmount(String(v))}
                      className="rounded-md border border-border px-2.5 py-1 text-[12px] text-fg-mute hover:text-fg"
                    >
                      ${v}
                    </button>
                  ))
                : [25, 50, 100].map((p) => (
                    <button
                      key={p}
                      onClick={() => setAmount(((held * p) / 100).toFixed(2))}
                      className="rounded-md border border-border px-2.5 py-1 text-[12px] text-fg-mute hover:text-fg"
                    >
                      {p}%
                    </button>
                  ))}
              <button
                onClick={() =>
                  setAmount(mode === "buy" ? String(Math.floor(state.balance)) : held.toFixed(2))
                }
                className="rounded-md border border-border px-2.5 py-1 text-[12px] text-fg-mute hover:text-fg"
              >
                Max
              </button>
            </div>
          </div>

          {/* Quote — always visible so shares, impact and payout stay legible */}
          {mode === "buy" ? (
            <div className="mt-4">
              <div className="rounded-lg border border-border bg-bg/60 p-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-[11.5px] text-fg-mute">Payout if correct</span>
                  <span className="font-mono text-[20px] font-semibold tabular-nums text-fg">
                    {buyQuote ? usd(buyQuote.shares, { cents: true }) : "$0.00"}
                  </span>
                </div>
                {buyQuote && (
                  <div className="mt-0.5 text-right font-mono text-[11.5px] tabular-nums text-green">
                    +{pct((buyQuote.shares - amt) / amt)} on {usd(amt)}
                  </div>
                )}
              </div>
              <div className="mt-2.5 space-y-1.5 text-[13px]">
                <Row label="Avg price" value={buyQuote ? cents(buyQuote.avgPrice) : cents(sidePrice)} />
                <Row label="Shares" value={buyQuote ? fmtShares(buyQuote.shares) : "—"} />
                <Row label="Price impact" value={buyQuote ? pct(Math.max(0, buyQuote.priceImpact)) : "—"} muted />
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-1.5 text-[13px]">
              <Row label="Avg price" value={sellQuote ? cents(sellQuote.avgPrice) : cents(sidePrice)} />
              <Row label="Selling" value={sellQuote ? `${fmtShares(sellQuote.shares)} shares` : "—"} />
              <div className="my-2 border-t border-border" />
              <Row label="You receive" value={sellQuote ? usd(sellQuote.proceeds, { cents: true }) : "$0.00"} strong />
            </div>
          )}

          <button
            onClick={submit}
            disabled={mode === "buy" ? !canBuy : !canSell}
            className="mt-4 w-full rounded-lg py-3 text-[14px] font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              background:
                (mode === "buy" ? canBuy : canSell)
                  ? side === "YES"
                    ? "var(--green)"
                    : "var(--red)"
                  : "var(--fg-mute)",
            }}
          >
            {mode === "buy"
              ? amt > state.balance
                ? "Insufficient balance"
                : `Buy ${side}`
              : `Sell ${side}`}
          </button>

      {flash && (
        <p className="mt-2 text-center text-[12px] font-medium text-green">{flash}</p>
      )}

      <p className="mt-2.5 text-center text-[11px] text-fg-mute">
        If the agent cannot determine the outcome, every position is refunded its cost.
      </p>

      {/* Position */}
      {pos && (pos.yesShares > 0 || pos.noShares > 0) && (
        <div className="mt-4 border-t border-border pt-3 text-[12.5px]">
          <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-fg-mute">
            Your position
          </p>
          {pos.yesShares > 0 && (
            <Row label={`${fmtShares(pos.yesShares)} YES`} value={usd(pos.yesShares * pYes, { cents: true })} />
          )}
          {pos.noShares > 0 && (
            <Row label={`${fmtShares(pos.noShares)} NO`} value={usd(pos.noShares * (1 - pYes), { cents: true })} />
          )}
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  good,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  good?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-fg-mute">{label}</span>
      <span
        className={`tabular-nums ${
          good ? "text-green" : muted ? "text-fg-mute" : "text-fg"
        } ${strong ? "font-semibold" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
