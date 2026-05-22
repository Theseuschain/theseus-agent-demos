"use client";

interface Props {
  busy: boolean;
  pending: boolean;
  onSubmit: () => Promise<void> | void;
}

export function FundTickButton({ busy, pending, onSubmit }: Props) {
  const disabled = busy || pending;
  const label = pending
    ? "agent reasoning…"
    : busy
      ? "executing…"
      : "run a tick →";

  return (
    <div>
      <button
        type="button"
        onClick={() => onSubmit()}
        disabled={disabled}
        className="cta-ink inline-flex items-center px-4 py-2 font-mono text-[12px] uppercase tracking-[0.18em] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {label}
      </button>
      <p className="mt-3 text-[12px] leading-relaxed text-fg-mute">
        Each tick the agent reads the market + portfolio and decides{" "}
        <span className="font-mono">HOLD</span> /{" "}
        <span className="font-mono">BUY_WETH</span> /{" "}
        <span className="font-mono">SELL_WETH</span>. Signed, no human
        approval.
      </p>
    </div>
  );
}
