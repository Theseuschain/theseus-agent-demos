"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { faucet, usePredict } from "@/lib/predict/store";
import { usd } from "@/lib/predict/format";

const LINKS = [
  { href: "/predict", label: "Markets" },
  { href: "/predict/portfolio", label: "Portfolio" },
  { href: "/predict/how-it-works", label: "How it works" },
];

export default function PredictNav() {
  const pathname = usePathname();
  const { balance, hydrated } = usePredict();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:gap-4 sm:px-5">
        <Link href="/predict" className="flex items-center gap-2 shrink-0">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-coral text-[14px] font-bold text-white">
            ◎
          </span>
          <span className="hidden font-semibold tracking-tight text-fg sm:inline">
            Theseus Predict
          </span>
        </Link>
        <span className="hidden rounded-full border border-border px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-fg-mute md:inline">
          Testnet · play money
        </span>

        <nav className="ml-2 flex items-center gap-1 sm:ml-4">
          {LINKS.map((l) => {
            const active =
              l.href === "/predict"
                ? pathname === "/predict"
                : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors sm:px-3 ${
                  active
                    ? "bg-fg/[0.06] text-fg"
                    : "text-fg-mute hover:bg-fg/[0.04] hover:text-fg"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div className="rounded-md border border-border px-3 py-1.5 text-right">
            <div className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-fg-mute leading-none">
              Balance
            </div>
            <div className="mt-0.5 font-mono text-[14px] font-semibold leading-none text-fg tabular-nums">
              {hydrated ? usd(balance, { cents: true }) : "—"}
            </div>
          </div>
          <button
            onClick={() => faucet()}
            disabled={!hydrated}
            className="rounded-md bg-coral px-3 py-2 text-[13px] font-medium text-white transition-colors hover:bg-coral-dim disabled:opacity-50"
            title="Add $1,000 play USDC"
          >
            + Faucet
          </button>
        </div>
      </div>
    </header>
  );
}
