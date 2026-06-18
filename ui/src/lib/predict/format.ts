// Display formatting for the prediction market.

/** Probability 0..1 → "62¢" style price. */
export function cents(p: number): string {
  return `${Math.round(p * 100)}¢`;
}

/** Probability 0..1 → "62%". */
export function pct(p: number): string {
  return `${Math.round(p * 100)}%`;
}

export function usd(n: number, opts: { cents?: boolean } = {}): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: opts.cents ? 2 : 0,
    maximumFractionDigits: opts.cents ? 2 : 0,
  });
}

/** Compact volume: $54.2M, $7.1M, $912K. */
export function compactUsd(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return usd(n);
}

export function shares(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function signedUsd(n: number): string {
  const s = usd(Math.abs(n), { cents: true });
  return n >= 0 ? `+${s}` : `-${s}`;
}

/** Calendar date → "Jun 30, 2025". */
export function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Time-to-deadline → "in 5 days" / "ended" / "in 3 months". */
export function untilDeadline(iso: string, now = Date.now()): string {
  const end = Date.parse(iso + "T23:59:59Z");
  const ms = end - now;
  if (ms <= 0) return "Ended";
  const days = Math.ceil(ms / 86_400_000);
  if (days <= 1) return "Ends today";
  if (days < 31) return `${days}d left`;
  if (days < 365) return `${Math.round(days / 30)}mo left`;
  return `${(days / 365).toFixed(1)}y left`;
}

export function isPast(iso: string, now = Date.now()): boolean {
  return Date.parse(iso + "T23:59:59Z") <= now;
}

export function timeAgo(ts: number, now = Date.now()): string {
  const s = Math.max(1, Math.round((now - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
