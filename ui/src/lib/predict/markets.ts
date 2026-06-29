// Market source. The board is created by Theseus agents: the desk agent surveys
// what is happening and writes each market on-chain, signed, and we bundle the
// decoded result in agent-markets.json (every market carries its on-chain
// provenance). If that file is empty (no generation run yet), we fall back to
// the bundled SEED_MARKETS so the app still renders. DEMO_MARKETS (two just-
// closed markets) are appended so the agent-settlement demo always has something
// to settle.

import { DEMO_MARKETS as DEMO_RAW, SEED_MARKETS } from "./seed";
import type { SeedMarket } from "./types";
import agentMarketsRaw from "./agent-markets.json";

// The bundled volume figures were authored at mainnet scale. This is a
// play-money testnet where individual trades are a few hundred to a few
// thousand eUSDC, so we bring the seeded volume into the same range. Trades
// placed in-app add their real eUSDC amount on top.
const VOLUME_SCALE = 0.01;
const scaleVolume = (m: SeedMarket): SeedMarket => ({
  ...m,
  volumeUsd: Math.round((m.volumeUsd * VOLUME_SCALE) / 100) * 100,
});

export const DEMO_MARKETS: SeedMarket[] = DEMO_RAW.map(scaleVolume);

/** Markets minted by the Theseus desk agent, with on-chain provenance. */
export const AGENT_MARKETS: SeedMarket[] =
  ((agentMarketsRaw as unknown as SeedMarket[]) ?? []).map(scaleVolume);

export const FALLBACK_MARKETS: SeedMarket[] =
  AGENT_MARKETS.length > 0 ? AGENT_MARKETS : SEED_MARKETS.map(scaleVolume);

export interface LoadResult {
  markets: SeedMarket[];
  /** True when the board was minted by the Theseus desk agent. */
  live: boolean;
}

export async function fetchLiveMarkets(): Promise<LoadResult> {
  const agentMade = AGENT_MARKETS.length > 0;
  const base = agentMade ? AGENT_MARKETS : SEED_MARKETS.map(scaleVolume);
  return { markets: [...base, ...DEMO_MARKETS], live: agentMade };
}
