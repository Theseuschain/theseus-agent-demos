"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { myStanding, usePredict } from "@/lib/predict/store";
import { usd, cents } from "@/lib/predict/format";

const HUE: Record<string, string> = {
  Kestrel: "var(--amber)",
  Atlas: "#6366F1",
  Sage: "var(--green)",
  Onyx: "#A855F7",
  You: "var(--coral)",
};

const pnlColor = (p: number) => (p > 0 ? "var(--green)" : p < 0 ? "var(--red)" : "var(--fg-mute)");

interface Row {
  name: string;
  blurb: string;
  value: number;
  cash: number;
  pnlPct: number;
  positions: number;
  kind: "agent" | "you";
  explorerUrl?: string;
  address?: string;
}

export default function LeaderboardBoard({ agents, feed }: { agents: any[]; feed: any[] }) {
  const state = usePredict();
  const router = useRouter();

  // Pick up the latest cron round without a manual reload. This only re-reads
  // stored state (no agent runs), so it costs nothing in agent credits.
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(t);
  }, [router]);

  const rows: Row[] = agents
    .map((a) => ({
      name: a.name,
      blurb: a.blurb,
      value: a.value ?? 0,
      cash: a.cash ?? 0,
      pnlPct: a.pnlPct ?? 0,
      positions: Object.keys(a.positions || {}).length,
      kind: "agent" as const,
      explorerUrl: a.address ? a.explorerUrl : undefined,
      address: a.address,
    }))
    .sort((a, b) => b.pnlPct - a.pnlPct);

  let me: { value: number; pnl: number; pnlPct: number } | null = null;
  let myOpen = 0;
  let myRank = 0;
  if (state.hydrated) {
    me = myStanding(state);
    myOpen = Object.values(state.positions).filter((p) => p.yesShares > 0 || p.noShares > 0).length;
    myRank = rows.filter((r) => r.pnlPct > me!.pnlPct).length + 1;
  }

  return (
    <>
      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        {rows.map((t, i) => (
          <div key={t.name} className="rounded-xl border border-border bg-surface/40 p-5">
            <div className="flex items-start gap-3.5">
              <span
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl font-serif text-[20px] font-medium text-white"
                style={{ background: HUE[t.name] ?? "var(--coral)" }}
              >
                {t.name[0]}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-[16px] font-semibold text-fg">
                    <span className="text-[13px] font-normal text-fg-mute">{i + 1}</span>
                    {t.name}
                  </h2>
                  <span className="text-[13px] font-semibold tabular-nums" style={{ color: pnlColor(t.pnlPct) }}>
                    {t.pnlPct >= 0 ? "+" : ""}{t.pnlPct.toFixed(1)}%
                  </span>
                </div>
                <p className="mt-0.5 text-[12px] text-fg-mute">{(t.blurb || "").split(".")[0]}</p>
              </div>
            </div>

            <div className="mt-4 flex gap-7">
              <Stat label="Portfolio" value={usd(t.value)} />
              <Stat label="Cash" value={usd(t.cash)} />
              <Stat label="Positions" value={String(t.positions)} />
            </div>

            {t.explorerUrl ? (
              <a href={t.explorerUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 font-mono text-[11px] text-fg-mute transition-colors hover:text-coral">
                <span className="h-1 w-1 rounded-full bg-coral/70" />
                {t.address ? `${t.address.slice(0, 6)}…${t.address.slice(-4)}` : "agent"} · verify on-chain ↗
              </a>
            ) : (
              <p className="mt-3 text-[12px] text-fg-mute">awaiting first round</p>
            )}
          </div>
        ))}
      </section>

      {me && (() => {
        const leader = rows[0];
        const ahead = rows.find((r) => r.pnlPct > me!.pnlPct);
        const target = ahead ?? leader;
        return (
        <section className="mt-4 rounded-xl border border-coral/40 bg-coral/[0.06] p-5">
          <div className="flex flex-wrap items-center gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-coral font-serif text-[20px] font-medium text-white">Y</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-semibold text-coral">You</span>
                <span className="text-[12px] text-fg-mute">rank {myRank} of {rows.length + 1}</span>
              </div>
              <p className="mt-0.5 text-[12.5px] text-fg-dim">
                {target
                  ? <>Pass <span className="font-semibold text-fg">{target.name}</span> at {target.pnlPct >= 0 ? "+" : ""}{target.pnlPct.toFixed(1)}% return. You trade the same markets as the agents, on your own schedule.</>
                  : "You trade the same markets as the agents, on your own schedule."}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-7">
              <Stat label="Return" value={`${me.pnlPct >= 0 ? "+" : ""}${me.pnlPct.toFixed(1)}%`} />
              <Stat label="Portfolio" value={usd(me.value)} />
              <Stat label="Positions" value={String(myOpen)} />
            </div>
            <Link
              href="/predict"
              className="shrink-0 rounded-lg bg-coral px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-coral-dim"
            >
              {myOpen > 0 ? "Trade these markets →" : "Place your first bet →"}
            </Link>
          </div>
        </section>
        );
      })()}

      <section className="mt-12">
        <h2 className="mb-4 font-serif text-[22px] tracking-tight text-fg">Recent agent trades</h2>
        {feed.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface/40 px-5 py-8 text-center text-[13.5px] text-fg-mute">
            No agent trades yet. When a round runs, every agent&rsquo;s reasoned trades show up here.
          </p>
        ) : (
          <div className="divide-y divide-border rounded-xl border border-border">
            {feed.map((tr: any, i: number) => (
              <div key={i} className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-fg/[0.03] ${i % 2 ? "bg-fg/[0.015]" : ""}`}>
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg font-serif text-[13px] text-white" style={{ background: HUE[tr.trader] ?? "var(--coral)" }}>
                  {tr.trader[0]}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="min-w-0 truncate text-[13.5px] leading-snug text-fg">
                      <span className="font-semibold">{tr.trader}</span>{" "}
                      <span className="font-semibold" style={{ color: tr.side === "YES" ? "var(--green)" : "var(--red)" }}>{tr.side}</span>{" "}
                      <span className="text-fg-dim">{tr.q}</span>
                    </p>
                    <span className="shrink-0 font-mono text-[11.5px] text-fg-mute">{cents(tr.price)} · {usd(tr.usd)}</span>
                  </div>
                  {tr.reason && <p className="mt-0.5 line-clamp-1 text-[12.5px] leading-snug text-fg-dim">{tr.reason}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-fg-mute">{label}</div>
      <div className="mt-0.5 text-[14.5px] font-semibold tabular-nums text-fg">{value}</div>
    </div>
  );
}
