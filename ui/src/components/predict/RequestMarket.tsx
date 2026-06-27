"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addMarket } from "@/lib/predict/store";
import type { SeedMarket } from "@/lib/predict/types";
import { pct } from "@/lib/predict/format";

type Phase = "idle" | "working" | "done" | "declined" | "error";

const EXAMPLES = [
  "Will Hollow Knight: Silksong ship before September 1?",
  "Will a specific creator pass 1M subscribers this summer?",
  "Will a named song re-enter the Spotify Global Top 50 this month?",
];

export default function RequestMarket() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [market, setMarket] = useState<SeedMarket | null>(null);
  const [reason, setReason] = useState("");

  async function submit() {
    const ask = text.trim();
    if (!ask || phase === "working") return;
    setPhase("working");
    setReason("");
    setMarket(null);
    try {
      const r = await fetch("/api/predict/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: ask }),
      });
      const d = await r.json();
      if (d.ok && d.market) {
        addMarket(d.market);
        setMarket(d.market);
        setPhase("done");
        // refresh the account's notifications/saved markets in the nav
        window.dispatchEvent(new Event("predict:refresh"));
      } else {
        setReason(d.reason || "The desk passed on that one.");
        setPhase("declined");
      }
    } catch {
      setReason("Couldn't reach the desk. Try again.");
      setPhase("error");
    }
  }

  function reset() {
    setText("");
    setPhase("idle");
    setMarket(null);
    setReason("");
  }
  function close() {
    setOpen(false);
    setTimeout(reset, 200);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-lg border border-coral bg-coral/10 px-3.5 py-2 text-[13px] font-semibold text-coral transition-colors hover:bg-coral/20"
      >
        + Request a market
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={close}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border border-border bg-bg p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-serif text-[22px] font-medium tracking-tight text-fg">Request a market</h2>
                <p className="mt-1 text-[13px] text-fg-dim">
                  Name the bet you want. A Theseus agent researches it. If it's interesting and can be settled fairly, it writes it on-chain and lists it, otherwise it tells you why.
                </p>
              </div>
              <button onClick={close} className="ml-3 text-fg-mute hover:text-fg">✕</button>
            </div>

            {(phase === "idle" || phase === "error") && (
              <div className="mt-4">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(); }}
                  rows={3}
                  maxLength={280}
                  autoFocus
                  placeholder="e.g. Will Grand Theft Auto VI get a new trailer before August 1?"
                  className="w-full resize-none rounded-lg border border-border bg-surface/40 px-3 py-2.5 text-[14px] text-fg outline-none placeholder:text-fg-mute focus:border-coral"
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      onClick={() => setText(ex)}
                      className="rounded-full border border-border px-2.5 py-1 text-[11px] text-fg-mute transition-colors hover:border-coral hover:text-coral"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
                {phase === "error" && <p className="mt-3 text-[13px] text-red">{reason}</p>}
                <div className="mt-4 flex items-center justify-between">
                  <span className="font-mono text-[11px] text-fg-mute">the agent writes it on Theseus, signed</span>
                  <button
                    onClick={submit}
                    disabled={!text.trim()}
                    className="rounded-lg bg-coral px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    Send to the desk
                  </button>
                </div>
              </div>
            )}

            {phase === "working" && (
              <div className="mt-6 flex flex-col items-center py-8 text-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-coral/30 border-t-coral" />
                <p className="mt-4 text-[14px] font-medium text-fg">The desk agent is researching your bet</p>
                <p className="mt-1 text-[12.5px] text-fg-dim">Checking it's interesting and can be settled fairly, then writing it on-chain. This runs a real agent, give it a minute.</p>
              </div>
            )}

            {phase === "done" && market && (
              <div className="mt-5">
                <div className="rounded-xl border border-[color-mix(in_srgb,var(--green)_40%,transparent)] bg-[color-mix(in_srgb,var(--green)_8%,transparent)] p-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-green">Listed on-chain</p>
                  <p className="mt-2 flex items-start gap-2 text-[15px] font-medium leading-snug text-fg">
                    <span className="text-[18px]">{market.icon}</span>
                    {market.question}
                  </p>
                  <div className="mt-2 flex items-center gap-3 font-mono text-[11.5px] text-fg-mute">
                    <span className="rounded-full border border-border px-2 py-0.5">{market.category}</span>
                    <span className="text-fg-dim">{pct(market.initialYes)} YES</span>
                    {market.createdBy && (
                      <a href={market.createdBy.explorerUrl} target="_blank" rel="noreferrer" className="text-coral hover:underline">
                        by {market.createdBy.agent} ↗
                      </a>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <button onClick={reset} className="text-[13px] text-fg-mute hover:text-fg">Request another</button>
                  <button
                    onClick={() => { close(); router.push(`/predict/${market.slug}`); }}
                    className="rounded-lg bg-coral px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90"
                  >
                    Open market
                  </button>
                </div>
              </div>
            )}

            {phase === "declined" && (
              <div className="mt-5">
                <div className="rounded-xl border border-border bg-surface/40 p-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-amber">The desk passed</p>
                  <p className="mt-2 text-[14px] leading-relaxed text-fg-dim">{reason}</p>
                </div>
                <div className="mt-4 flex justify-end">
                  <button onClick={reset} className="rounded-lg border border-border px-4 py-2 text-[13px] font-semibold text-fg hover:border-fg/30">
                    Try another
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
