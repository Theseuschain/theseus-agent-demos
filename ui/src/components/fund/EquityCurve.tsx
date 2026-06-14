"use client";

// Dual-line equity curve: the agent-managed NAV vs a buy-and-hold benchmark,
// revealed up to the current play step. Pure SVG, no chart dependency. The
// gap between the two lines is the agent's value-add (or cost) made visible.

interface Props {
  managed: number[];
  hold: number[];
  /** reveal the curve up to this step index (inclusive); defaults to full */
  upTo?: number;
  startNav: number;
}

const W = 640;
const H = 200;
const PAD = 10;

function path(series: number[], n: number, min: number, max: number): string {
  const span = max - min || 1;
  return series
    .slice(0, n)
    .map((v, i) => {
      const x = PAD + (i / (series.length - 1)) * (W - 2 * PAD);
      const y = H - PAD - ((v - min) / span) * (H - 2 * PAD);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function EquityCurve({ managed, hold, upTo, startNav }: Props) {
  const n = Math.max(1, Math.min(managed.length, (upTo ?? managed.length - 1) + 1));
  const all = [...managed, ...hold];
  const min = Math.min(...all, startNav);
  const max = Math.max(...all, startNav);
  const span = max - min || 1;

  const baselineY = H - PAD - ((startNav - min) / span) * (H - 2 * PAD);
  const lastI = n - 1;
  const lastX = PAD + (lastI / (managed.length - 1)) * (W - 2 * PAD);
  const lastManagedY =
    H - PAD - ((managed[lastI] - min) / span) * (H - 2 * PAD);

  const managedD = path(managed, n, min, max);
  const holdD = path(hold, n, min, max);
  const areaD = `${managedD} L${lastX.toFixed(1)},${(H - PAD).toFixed(1)} L${PAD},${(H - PAD).toFixed(1)} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height: "200px" }}
      role="img"
      aria-label="Fund NAV versus buy-and-hold"
    >
      {/* inception baseline */}
      <line
        x1={PAD}
        x2={W - PAD}
        y1={baselineY}
        y2={baselineY}
        style={{ stroke: "var(--border)" }}
        strokeDasharray="3 4"
        strokeWidth={1}
      />
      {/* area under managed */}
      <path d={areaD} style={{ fill: "var(--coral)", opacity: 0.08 }} />
      {/* buy-and-hold benchmark */}
      <path
        d={holdD}
        fill="none"
        style={{ stroke: "var(--fg-mute)" }}
        strokeWidth={1.5}
        strokeDasharray="5 4"
        vectorEffect="non-scaling-stroke"
      />
      {/* managed */}
      <path
        d={managedD}
        fill="none"
        style={{ stroke: "var(--coral)" }}
        strokeWidth={2.25}
        vectorEffect="non-scaling-stroke"
      />
      {/* current point */}
      <circle
        cx={lastX}
        cy={lastManagedY}
        r={3.5}
        style={{ fill: "var(--coral)" }}
      />
    </svg>
  );
}
