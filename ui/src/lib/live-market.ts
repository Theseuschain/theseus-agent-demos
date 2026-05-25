/**
 * Live ETH/USD MarketSnapshot.
 *
 * Builds a MarketSnapshot for the Sovereign Fund demo from real venue
 * data. The mid-price comes from the same /api/venues endpoint the Aave
 * Oracle agent already polls (median of Coinbase, Binance, Uniswap). The
 * 24h + 7d returns and realized vol come from CoinGecko's market_chart
 * (free, no key required), which gives daily closes over a 7-day window.
 *
 * Realized vol is the annualized stdev of daily log-returns over the
 * window: stdev(log(p_t / p_{t-1})) * sqrt(365) * 100.
 *
 * This file is server-only. The API route at /api/fund/live-market wraps
 * it; the page never imports it directly.
 */
import type { MarketSnapshot } from "./fund-scenario";
import { coinbaseOrderbook } from "./venues/coinbase";
import { binanceTicker } from "./venues/binance";
import { uniswapTwap } from "./venues/uniswap";

const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/coins/ethereum/market_chart?vs_currency=usd&days=7&interval=daily";
const TIMEOUT_MS = 6_000;

interface CoinGeckoMarketChart {
  prices: [number, number][]; // [unix ms, price]
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Annualized stdev of daily log-returns, in percent. */
function realizedVolFromSeries(prices: number[]): number {
  if (prices.length < 3) return 0;
  const rets: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const prev = prices[i - 1];
    const cur = prices[i];
    if (prev > 0 && cur > 0) rets.push(Math.log(cur / prev));
  }
  if (rets.length < 2) return 0;
  const mean = rets.reduce((s, r) => s + r, 0) / rets.length;
  const variance =
    rets.reduce((s, r) => s + (r - mean) ** 2, 0) / (rets.length - 1);
  const dailyStd = Math.sqrt(variance);
  return dailyStd * Math.sqrt(365) * 100;
}

async function fetchVenueMid(): Promise<number> {
  const [cb, bn, un] = await Promise.all([
    coinbaseOrderbook("ETH-USD"),
    binanceTicker("ETHUSDT"),
    uniswapTwap(),
  ]);
  const prices = [cb, bn, un]
    .filter((v) => v.ok && Number.isFinite(v.priceUsd) && v.priceUsd > 0)
    .map((v) => v.priceUsd);
  if (prices.length === 0) throw new Error("all_venues_failed");
  return median(prices);
}

async function fetchCoinGeckoSeries(): Promise<number[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(COINGECKO_URL, {
      signal: ctrl.signal,
      headers: { "User-Agent": "theseus-agent-oracle-demo/1" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`coingecko_http_${res.status}`);
    const body = (await res.json()) as CoinGeckoMarketChart;
    const series = body.prices
      .map(([, p]) => p)
      .filter((p) => Number.isFinite(p) && p > 0);
    if (series.length < 3) throw new Error("coingecko_short_series");
    return series;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchLiveMarket(): Promise<MarketSnapshot> {
  // Run in parallel; the venue mid is preferred over the CoinGecko spot
  // because it's the same number the rest of the demo speaks in.
  const [venueMid, series] = await Promise.all([
    fetchVenueMid(),
    fetchCoinGeckoSeries(),
  ]);

  const last = series[series.length - 1];
  const prev = series[series.length - 2];
  const first = series[0];

  // CoinGecko series is 8 points (today + last 7 daily closes). 24h return
  // uses the last two points; 7d return uses first vs last. We anchor the
  // ratios to the venue mid so the displayed price agrees with the venue
  // strip: scale the "last" point implicitly via the ratio, not the level.
  const ret24h = prev > 0 ? last / prev : 1;
  const ret7d = first > 0 ? last / first : 1;
  const realizedVolPct = realizedVolFromSeries(series);

  return {
    wethPriceUsd: venueMid,
    ret24h,
    ret7d,
    realizedVolPct,
    macroNote: "Live ETH/USD venue mid; no macro overlay applied.",
  };
}
