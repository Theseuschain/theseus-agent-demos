// Logarithmic Market Scoring Rule (LMSR) for a binary YES/NO market.
//
// The market maker always quotes a price and always has liquidity; price impact
// scales with trade size and inversely with the liquidity parameter b. YES and
// NO prices always sum to 1, so each can be read directly as an implied
// probability. All functions are numerically stable (log-sum-exp shifted).

import type { Outcome } from "./types";

/** Implied YES probability given net shares q and liquidity b. */
export function priceYes(qYes: number, qNo: number, b: number): number {
  // logistic form of the softmax — stable for large |qNo - qYes|
  return 1 / (1 + Math.exp((qNo - qYes) / b));
}

export function priceFor(
  qYes: number,
  qNo: number,
  b: number,
  outcome: Outcome,
): number {
  const p = priceYes(qYes, qNo, b);
  return outcome === "YES" ? p : 1 - p;
}

/** LMSR cost function C(q), shifted by max for stability. */
function cost(qYes: number, qNo: number, b: number): number {
  const m = Math.max(qYes, qNo);
  return m + b * Math.log(Math.exp((qYes - m) / b) + Math.exp((qNo - m) / b));
}

/** USDC cost to buy `shares` of `outcome` (always ≥ 0). */
export function buyCost(
  qYes: number,
  qNo: number,
  b: number,
  outcome: Outcome,
  shares: number,
): number {
  const c0 = cost(qYes, qNo, b);
  const c1 =
    outcome === "YES"
      ? cost(qYes + shares, qNo, b)
      : cost(qYes, qNo + shares, b);
  return c1 - c0;
}

/** USDC proceeds from selling `shares` of `outcome` (always ≥ 0). */
export function sellProceeds(
  qYes: number,
  qNo: number,
  b: number,
  outcome: Outcome,
  shares: number,
): number {
  const c0 = cost(qYes, qNo, b);
  const c1 =
    outcome === "YES"
      ? cost(qYes - shares, qNo, b)
      : cost(qYes, qNo - shares, b);
  return c0 - c1;
}

/** Closed-form: shares received for spending `usdc` on `outcome`. */
export function sharesForUsdc(
  qYes: number,
  qNo: number,
  b: number,
  outcome: Outcome,
  usdc: number,
): number {
  if (usdc <= 0) return 0;
  const m = Math.max(qYes, qNo);
  const eY = Math.exp((qYes - m) / b);
  const eN = Math.exp((qNo - m) / b);
  const own = outcome === "YES" ? eY : eN;
  const other = outcome === "YES" ? eN : eY;
  // e^((qOwn - m + δ)/b) = (eY+eN)·e^(usdc/b) − other
  const target = (eY + eN) * Math.exp(usdc / b) - other;
  if (target <= 0) return 0;
  const qOwn = outcome === "YES" ? qYes : qNo;
  // δ = b·ln(target) + m − qOwn  (since ln(target) = (qOwn − m + δ)/b)
  return Math.max(0, b * Math.log(target) + m - qOwn);
}

/** New (qYes, qNo) after buying (+) or selling (−) `delta` shares of outcome. */
export function applyShares(
  qYes: number,
  qNo: number,
  outcome: Outcome,
  delta: number,
): { qYes: number; qNo: number } {
  return outcome === "YES"
    ? { qYes: qYes + delta, qNo }
    : { qYes, qNo: qNo + delta };
}

/** Seed q so the market opens at a target YES probability p0. */
export function seedShares(p0: number, b: number): { qYes: number; qNo: number } {
  const p = Math.min(0.99, Math.max(0.01, p0));
  return { qYes: b * Math.log(p), qNo: b * Math.log(1 - p) };
}

/** A quote for a buy of `usdc` into `outcome`: shares, avg price, impact. */
export function quoteBuy(
  qYes: number,
  qNo: number,
  b: number,
  outcome: Outcome,
  usdc: number,
): { shares: number; avgPrice: number; newPrice: number; priceImpact: number } {
  const startPrice = priceFor(qYes, qNo, b, outcome);
  const shares = sharesForUsdc(qYes, qNo, b, outcome, usdc);
  const next = applyShares(qYes, qNo, outcome, shares);
  const newPrice = priceFor(next.qYes, next.qNo, b, outcome);
  const avgPrice = shares > 0 ? usdc / shares : startPrice;
  return {
    shares,
    avgPrice,
    newPrice,
    priceImpact: startPrice > 0 ? (avgPrice - startPrice) / startPrice : 0,
  };
}
