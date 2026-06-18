"use client";

import { useId, useMemo, useState } from "react";
import type { PricePoint } from "@/lib/predict/types";

interface Props {
  history: PricePoint[];
  height?: number;
  variant?: "spark" | "full";
  /** Force a color; otherwise derived from the trend. */
  color?: string;
  className?: string;
}

const W = 1000; // viewBox width; SVG scales to container

export default function PriceChart({
  history,
  height = 64,
  variant = "spark",
  color,
  className,
}: Props) {
  const gid = useId().replace(/[:]/g, "");
  const [hoverX, setHoverX] = useState<number | null>(null);

  const data = useMemo(() => {
    const pts = history.length >= 2 ? history : [];
    if (pts.length === 0) return null;
    const tMin = pts[0].t;
    const tMax = pts[pts.length - 1].t;
    const span = Math.max(1, tMax - tMin);
    const H = 100;
    const pad = variant === "full" ? 6 : 2;
    const xy = pts.map((p) => ({
      x: ((p.t - tMin) / span) * W,
      y: pad + (1 - p.pYes) * (H - 2 * pad),
      p: p.pYes,
      t: p.t,
    }));
    const line = xy.map((d, i) => `${i === 0 ? "M" : "L"}${d.x.toFixed(1)},${d.y.toFixed(2)}`).join(" ");
    const area = `${line} L${W},${H} L0,${H} Z`;
    const trendUp = pts[pts.length - 1].pYes >= pts[0].pYes;
    return { xy, line, area, trendUp, H };
  }, [history, variant]);

  if (!data) {
    return <div style={{ height }} className={className} aria-hidden />;
  }

  const stroke =
    color ?? (data.trendUp ? "var(--green)" : "var(--red)");
  const hovered =
    hoverX == null
      ? null
      : data.xy.reduce((best, d) =>
          Math.abs(d.x - hoverX) < Math.abs(best.x - hoverX) ? d : best,
        );

  return (
    <svg
      viewBox={`0 0 ${W} ${data.H}`}
      preserveAspectRatio="none"
      style={{ height, width: "100%", display: "block", overflow: "visible" }}
      className={className}
      onMouseMove={
        variant === "full"
          ? (e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setHoverX(((e.clientX - r.left) / r.width) * W);
            }
          : undefined
      }
      onMouseLeave={variant === "full" ? () => setHoverX(null) : undefined}
    >
      <defs>
        <linearGradient id={`g${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity={variant === "full" ? 0.22 : 0.16} />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      {variant === "full" &&
        [0.25, 0.5, 0.75].map((g) => (
          <line
            key={g}
            x1="0"
            x2={W}
            y1={(1 - g) * data.H}
            y2={(1 - g) * data.H}
            stroke="var(--border)"
            strokeWidth="0.6"
            strokeDasharray="3 5"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      <path d={data.area} fill={`url(#g${gid})`} />
      <path
        d={data.line}
        fill="none"
        stroke={stroke}
        strokeWidth={variant === "full" ? 2 : 1.75}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {hovered && (
        <>
          <line
            x1={hovered.x}
            x2={hovered.x}
            y1="0"
            y2={data.H}
            stroke="var(--fg-mute)"
            strokeWidth="0.8"
            vectorEffect="non-scaling-stroke"
          />
          <circle cx={hovered.x} cy={hovered.y} r="3.5" fill={stroke} vectorEffect="non-scaling-stroke" />
          <text
            x={Math.min(W - 60, Math.max(40, hovered.x))}
            y={Math.max(12, hovered.y - 8)}
            fontSize="11"
            textAnchor="middle"
            fill="var(--fg)"
            fontFamily="ui-monospace, monospace"
            style={{ fontWeight: 600 }}
          >
            {Math.round(hovered.p * 100)}%
          </text>
        </>
      )}
    </svg>
  );
}
