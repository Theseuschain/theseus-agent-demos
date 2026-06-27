// Market source. The board is created by Theseus agents: the desk agent surveys
// what is happening and writes each market on-chain, signed, and we bundle the
// decoded result in agent-markets.json (every market carries its on-chain
// provenance). If that file is empty (no generation run yet), we fall back to
// the bundled SEED_MARKETS so the app still renders. DEMO_MARKETS (two just-
// closed markets) are appended so the agent-settlement demo always has something
// to settle.

import { DEMO_MARKETS, SEED_MARKETS } from "./seed";
import type { SeedMarket } from "./types";
import agentMarketsRaw from "./agent-markets.json";

export { DEMO_MARKETS };

/** Markets minted by the Theseus desk agent, with on-chain provenance. */
export const AGENT_MARKETS: SeedMarket[] =
  (agentMarketsRaw as unknown as SeedMarket[]) ?? [];

export const FALLBACK_MARKETS: SeedMarket[] =
  AGENT_MARKETS.length > 0 ? AGENT_MARKETS : SEED_MARKETS;

export interface LoadResult {
  markets: SeedMarket[];
  /** True when the board was minted by the Theseus desk agent. */
  live: boolean;
}

export async function fetchLiveMarkets(): Promise<LoadResult> {
  const agentMade = AGENT_MARKETS.length > 0;
  const base = agentMade ? AGENT_MARKETS : SEED_MARKETS;
  return { markets: [...base, ...DEMO_MARKETS], live: agentMade };
}
