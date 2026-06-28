"use client";

import { useEffect, useRef, useState } from "react";
import { pct } from "@/lib/predict/format";

/** Animates a 0..1 probability to its target: counts up on mount, ticks
 *  smoothly when the price moves on a trade. */
export default function AnimatedPct({ value, className }: { value: number; className?: string }) {
  const [v, setV] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    const begin = from.current;
    const target = value;
    const ms = 600;
    let raf = 0;
    let start: number | null = null;
    const tick = (t: number) => {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(begin + (target - begin) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <span className={className}>{pct(v)}</span>;
}
