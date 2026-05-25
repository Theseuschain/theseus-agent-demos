/**
 * Live Frax (FRAX / FXS) data adapter for the Terra failsafe demo.
 *
 * Maps real-world Frax protocol state onto the USTD/LUND-shaped `VaultState`
 * the demo already consumes:
 *
 *   USTD (peg-targeting stablecoin)  <->  FRAX
 *   LUND (volatile share / governance) <->  FXS (Frax Share)
 *
 * Frax is not pure-algorithmic (it's now hybrid / partly-collateralized),
 * but it's the cleanest still-trading analog of the Terra mechanic: a
 * dollar-pegged token whose floating sibling absorbs supply/demand. Plugging
 * the live numbers in lets the same failsafe agent reason about a real
 * system instead of a pre-baked vault snapshot.
 *
 * Data sources (no auth required):
 *   - CoinGecko `simple/price` for FRAX peg, FXS price + 24h change, market caps.
 *   - DefiLlama `stablecoins/stablecoin/6` for FRAX circulating supply and
 *     (where available) the collateral-side breakdown used to derive a
 *     reserve coverage proxy.
 *
 * Both endpoints are best-effort. If CoinGecko fails this function throws;
 * the caller surfaces an error and the synthetic Terra presets keep working.
 * If only DefiLlama fails we still return a usable VaultState, with
 * `reserveCoverage` falling back to a conservative published-ratio default.
 */

import type { VaultState } from "./terra-scenario";

const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=frax,frax-share&vs_currencies=usd&include_24hr_change=true&include_market_cap=true";

// DefiLlama indexes FRAX as stablecoin id=6.
const DEFILLAMA_FRAX_URL = "https://stablecoins.llama.fi/stablecoin/6";

const FETCH_TIMEOUT_MS = 8_000;

interface CoinGeckoEntry {
  usd: number;
  usd_market_cap?: number;
  usd_24h_change?: number;
}

interface CoinGeckoResponse {
  frax?: CoinGeckoEntry;
  "frax-share"?: CoinGeckoEntry;
}

interface DefiLlamaCirculatingPoint {
  date: string | number;
  circulating?: { peggedUSD?: number };
}

interface DefiLlamaStablecoin {
  id?: string;
  name?: string;
  symbol?: string;
  pegType?: string;
  /** Total circulating supply across all chains, indexed by date. */
  tokens?: DefiLlamaCirculatingPoint[];
  /** Some payloads name it differently — accept either. */
  chainBalances?: Record<string, { tokens?: DefiLlamaCirculatingPoint[] }>;
}

export interface LiveFraxSnapshot {
  /** What we return to the page as VaultState. */
  vault: VaultState;
  /** Pass-through diagnostics so the API route / UI can show provenance. */
  fetchedAt: number;
  source: {
    coingecko: boolean;
    defiLlama: boolean;
  };
  fxsMarketCap?: number;
  fraxMarketCap?: number;
}

/** Fetch with a small timeout so a hung upstream doesn't wedge the route. */
async function fetchJson<T>(url: string, label: string): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      // 5min server cache; matches our SWR contract on the API route.
      next: { revalidate: 300 },
      headers: { accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`${label} http ${res.status}`);
    }
    return (await res.json()) as T;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`${label}: ${msg}`);
  } finally {
    clearTimeout(timer);
  }
}

/** Pull the most recent circulating supply point (peggedUSD) from a tokens
 *  array. DefiLlama orders points oldest -> newest; we want the tail. */
function latestCirculating(points?: DefiLlamaCirculatingPoint[]): number | undefined {
  if (!points || points.length === 0) return undefined;
  for (let i = points.length - 1; i >= 0; i--) {
    const v = points[i]?.circulating?.peggedUSD;
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  }
  return undefined;
}

/** Frax has published a collateral-ratio (CR) that's hovered between ~85%
 *  and ~100% post-Feb-2023. We use 0.92 as a calibrated default if we
 *  cannot derive a fresher number from DefiLlama. The agent prompt treats
 *  reserves below ~40% as a red flag; 0.92 sits firmly in the calm range. */
const FRAX_DEFAULT_RESERVE_COVERAGE = 0.92;

/** Estimate reserve coverage from DefiLlama. Today the public stablecoin
 *  endpoint exposes circulating supply but not the live CR, so this is
 *  primarily a hook for future fields and currently returns undefined.
 *  Kept here so the call site reads cleanly. */
function deriveReserveCoverage(_data: DefiLlamaStablecoin): number | undefined {
  return undefined;
}

/** Map a 24h % change (e.g. -3.5 means -3.5%) onto the demo's ratio shape
 *  (e.g. 0.965 = "now is 96.5% of 24h-ago"). */
function pctChangeToRatio(pct: number | undefined): number {
  if (typeof pct !== "number" || !Number.isFinite(pct)) return 1;
  return 1 + pct / 100;
}

/**
 * Fetch live Frax data and return it shaped as a `VaultState` the existing
 * Terra failsafe agent can reason about directly.
 */
export async function fetchLiveFraxVaultState(): Promise<LiveFraxSnapshot> {
  // CoinGecko is required — it's the only source of peg + FXS price.
  const cg = await fetchJson<CoinGeckoResponse>(COINGECKO_URL, "coingecko");
  const frax = cg.frax;
  const fxs = cg["frax-share"];
  if (!frax || typeof frax.usd !== "number") {
    throw new Error("coingecko: missing FRAX price");
  }
  if (!fxs || typeof fxs.usd !== "number") {
    throw new Error("coingecko: missing FXS price");
  }

  // DefiLlama is best-effort — used for circulating supply. If it fails we
  // fall back to CoinGecko market-cap / price as the supply proxy.
  let defiLlamaOk = false;
  let fraxCirculating: number | undefined;
  let reserveCoverage: number | undefined;
  try {
    const dl = await fetchJson<DefiLlamaStablecoin>(DEFILLAMA_FRAX_URL, "defillama");
    defiLlamaOk = true;
    fraxCirculating = latestCirculating(dl.tokens);
    reserveCoverage = deriveReserveCoverage(dl);
  } catch {
    // Swallow — we'll lean on CoinGecko marketcap below.
  }

  // FRAX supply: prefer DefiLlama peggedUSD; else market-cap / price.
  const ustdSupply =
    fraxCirculating ??
    (typeof frax.usd_market_cap === "number"
      ? frax.usd_market_cap / Math.max(frax.usd, 1e-6)
      : 0);

  // FXS supply: derive from market-cap / price. CoinGecko reports both.
  const lundSupply =
    typeof fxs.usd_market_cap === "number"
      ? fxs.usd_market_cap / Math.max(fxs.usd, 1e-6)
      : 0;

  // FXS 24h change as a ratio. CoinGecko returns percent.
  const lundPriceChange24h = pctChangeToRatio(fxs.usd_24h_change);

  // FXS supply growth: we don't have a 24h-ago supply number directly, and
  // FXS share-supply is governance-set rather than minted by the peg
  // mechanism (unlike Terra's LUNA). Reporting 1.005 (slight growth) is a
  // conservative neutral value — it tells the agent "supply is not
  // exploding" without falsely claiming perfect constancy.
  const lundSupplyGrowth24h = 1.005;

  // Redemption rate not directly readable from public endpoints. 0 reads
  // to the agent as "calm" — which it pairs with the live peg and price
  // change to form a coherent picture.
  const redemptionRate1h = 0;

  // FRAX targets $1; CoinGecko USD price is our peg signal.
  const ustdMedianUsd = frax.usd;

  const vault: VaultState = {
    ustdSupply,
    lundSupply,
    lundPriceUsd: fxs.usd,
    ustdMedianUsd,
    redemptionRate1h,
    lundSupplyGrowth24h,
    lundPriceChange24h,
    reserveCoverage: reserveCoverage ?? FRAX_DEFAULT_RESERVE_COVERAGE,
  };

  return {
    vault,
    fetchedAt: Date.now(),
    source: { coingecko: true, defiLlama: defiLlamaOk },
    fxsMarketCap: fxs.usd_market_cap,
    fraxMarketCap: frax.usd_market_cap,
  };
}
