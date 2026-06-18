"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  applyShares,
  priceYes,
  quoteBuy,
  seedShares,
  sellProceeds,
} from "./amm";
import { genHistory, SEED_MARKETS } from "./seed";
import type {
  MarketRuntime,
  Outcome,
  Position,
  Settlement,
  Trade,
} from "./types";

const STORAGE_KEY = "theseus-predict-v1";
const STARTING_BALANCE = 1_000;
const FAUCET_AMOUNT = 1_000;

export interface SettledPosition {
  marketId: number;
  yesShares: number;
  noShares: number;
  costBasis: number;
  payout: number;
  winningOutcome: Outcome | null;
  settledAt: number;
}

export interface PredictState {
  hydrated: boolean;
  balance: number;
  positions: Record<number, Position>;
  trades: Trade[];
  markets: Record<number, MarketRuntime>;
  settlements: Record<number, Settlement>;
  settledPositions: SettledPosition[];
}

const EMPTY: PredictState = {
  hydrated: false,
  balance: 0,
  positions: {},
  trades: [],
  markets: {},
  settlements: {},
  settledPositions: [],
};

const seedMap = new Map(SEED_MARKETS.map((m) => [m.id, m]));
export const liquidityB = (id: number) => seedMap.get(id)?.liquidityB ?? 5000;

let state: PredictState = EMPTY;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
  persist();
}

function set(next: Partial<PredictState>) {
  state = { ...state, ...next };
  emit();
}

function persist() {
  if (typeof window === "undefined" || !state.hydrated) return;
  try {
    const { balance, positions, trades, settlements, settledPositions, markets } =
      state;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ balance, positions, trades, settlements, settledPositions, markets }),
    );
  } catch {
    /* quota / private mode — ignore */
  }
}

function seededMarkets(): Record<number, MarketRuntime> {
  const out: Record<number, MarketRuntime> = {};
  for (const m of SEED_MARKETS) {
    const { qYes, qNo } = seedShares(m.initialYes, m.liquidityB);
    out[m.id] = {
      qYes,
      qNo,
      volumeUsd: m.volumeUsd,
      history: genHistory(m.id, m.initialYes),
    };
  }
  return out;
}

let hydrating = false;
function ensureHydrated() {
  if (state.hydrated || hydrating || typeof window === "undefined") return;
  hydrating = true;
  const base: PredictState = {
    hydrated: true,
    balance: STARTING_BALANCE,
    positions: {},
    trades: [],
    markets: seededMarkets(),
    settlements: {},
    settledPositions: [],
  };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<PredictState>;
      base.balance = typeof saved.balance === "number" ? saved.balance : base.balance;
      base.positions = saved.positions ?? {};
      base.trades = saved.trades ?? [];
      base.settlements = saved.settlements ?? {};
      base.settledPositions = saved.settledPositions ?? [];
      // Merge any persisted AMM drift over the seed (keeps prices the user moved).
      if (saved.markets) {
        for (const id of Object.keys(saved.markets)) base.markets[+id] = saved.markets[+id]!;
      }
    }
  } catch {
    /* corrupt store — fall back to seed */
  }
  state = base;
  emit();
}

// ---- external-store wiring -------------------------------------------------

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
const getSnapshot = () => state;
const getServerSnapshot = () => EMPTY;

export function usePredict(): PredictState {
  useEffect(() => {
    ensureHydrated();
  }, []);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// ---- derived helpers -------------------------------------------------------

export function marketPriceYes(id: number): number {
  const m = state.markets[id];
  if (!m) return seedMap.get(id)?.initialYes ?? 0.5;
  return priceYes(m.qYes, m.qNo, liquidityB(id));
}

export function emptyPosition(marketId: number): Position {
  return { marketId, yesShares: 0, noShares: 0, yesCost: 0, noCost: 0 };
}

// ---- actions ---------------------------------------------------------------

export function faucet(amount = FAUCET_AMOUNT) {
  set({ balance: state.balance + amount });
}

export function resetAccount() {
  state = {
    ...state,
    balance: STARTING_BALANCE,
    positions: {},
    trades: [],
    settlements: {},
    settledPositions: [],
    markets: seededMarkets(),
  };
  emit();
}

let tradeSeq = 0;
function tradeId() {
  tradeSeq += 1;
  return `${Date.now().toString(36)}-${tradeSeq}`;
}

export function buy(marketId: number, side: Outcome, usdc: number) {
  const rt = state.markets[marketId];
  if (!rt || usdc <= 0 || usdc > state.balance) return null;
  const b = liquidityB(marketId);
  const { shares, avgPrice } = quoteBuy(rt.qYes, rt.qNo, b, side, usdc);
  if (shares <= 0) return null;
  const next = applyShares(rt.qYes, rt.qNo, side, shares);
  const newHistory = [
    ...rt.history,
    { t: Date.now(), pYes: priceYes(next.qYes, next.qNo, b) },
  ].slice(-120);
  const pos = state.positions[marketId] ?? emptyPosition(marketId);
  const updatedPos: Position =
    side === "YES"
      ? { ...pos, yesShares: pos.yesShares + shares, yesCost: pos.yesCost + usdc }
      : { ...pos, noShares: pos.noShares + shares, noCost: pos.noCost + usdc };
  const trade: Trade = {
    id: tradeId(),
    marketId,
    side,
    action: "buy",
    shares,
    usdc,
    avgPrice,
    ts: Date.now(),
  };
  set({
    balance: state.balance - usdc,
    markets: {
      ...state.markets,
      [marketId]: { ...rt, qYes: next.qYes, qNo: next.qNo, volumeUsd: rt.volumeUsd + usdc, history: newHistory },
    },
    positions: { ...state.positions, [marketId]: updatedPos },
    trades: [trade, ...state.trades].slice(0, 200),
  });
  return { shares, avgPrice };
}

export function sell(marketId: number, side: Outcome, shares: number) {
  const rt = state.markets[marketId];
  const pos = state.positions[marketId];
  if (!rt || !pos || shares <= 0) return null;
  const held = side === "YES" ? pos.yesShares : pos.noShares;
  const sellShares = Math.min(shares, held);
  if (sellShares <= 0) return null;
  const b = liquidityB(marketId);
  const proceeds = sellProceeds(rt.qYes, rt.qNo, b, side, sellShares);
  const next = applyShares(rt.qYes, rt.qNo, side, -sellShares);
  const newHistory = [
    ...rt.history,
    { t: Date.now(), pYes: priceYes(next.qYes, next.qNo, b) },
  ].slice(-120);
  const heldCost = side === "YES" ? pos.yesCost : pos.noCost;
  const costReduction = held > 0 ? (heldCost * sellShares) / held : 0;
  const updatedPos: Position =
    side === "YES"
      ? { ...pos, yesShares: pos.yesShares - sellShares, yesCost: pos.yesCost - costReduction }
      : { ...pos, noShares: pos.noShares - sellShares, noCost: pos.noCost - costReduction };
  const trade: Trade = {
    id: tradeId(),
    marketId,
    side,
    action: "sell",
    shares: sellShares,
    usdc: proceeds,
    avgPrice: sellShares > 0 ? proceeds / sellShares : 0,
    ts: Date.now(),
  };
  set({
    balance: state.balance + proceeds,
    markets: {
      ...state.markets,
      [marketId]: { ...rt, qYes: next.qYes, qNo: next.qNo, volumeUsd: rt.volumeUsd + proceeds, history: newHistory },
    },
    positions: { ...state.positions, [marketId]: updatedPos },
    trades: [trade, ...state.trades].slice(0, 200),
  });
  return { proceeds };
}

/** Apply the agent's verdict: pay winners, refund on UNRESOLVABLE, archive. */
export function applySettlement(s: Settlement) {
  if (state.settlements[s.marketId]) return; // already settled
  const pos = state.positions[s.marketId];
  let payout = 0;
  if (pos) {
    const costBasis = pos.yesCost + pos.noCost;
    if (s.verdict === "UNRESOLVABLE") {
      payout = costBasis; // refund the cost basis, no forced loss
    } else if (s.winningOutcome === "YES") {
      payout = pos.yesShares; // each winning share pays $1
    } else if (s.winningOutcome === "NO") {
      payout = pos.noShares;
    }
    const settled: SettledPosition = {
      marketId: s.marketId,
      yesShares: pos.yesShares,
      noShares: pos.noShares,
      costBasis,
      payout,
      winningOutcome: s.winningOutcome,
      settledAt: s.settledAt,
    };
    const { [s.marketId]: _drop, ...restPos } = state.positions;
    void _drop;
    set({
      balance: state.balance + payout,
      positions: restPos,
      settledPositions: [settled, ...state.settledPositions],
      settlements: { ...state.settlements, [s.marketId]: s },
    });
  } else {
    set({ settlements: { ...state.settlements, [s.marketId]: s } });
  }
}
