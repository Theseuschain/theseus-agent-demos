// Server-side read of live on-chain prices for the board. Multicalls priceYes
// for every on-chain market and returns { id: yesProbability }. Cached briefly so
// a board load doesn't hammer the RPC. Returns {} when on-chain is disabled.
import { createPublicClient, http, formatUnits } from "viem";
import { baseSepolia } from "viem/chains";
import {
  ON_CHAIN_MARKET_MAX,
  ON_CHAIN_MARKET_MIN,
  PREDICT_MARKET_ABI,
  PREDICT_MARKET_ADDRESS,
  onChainEnabled,
} from "./onchain";

let cache: { at: number; prices: Record<number, number> } | null = null;

export async function readOnChainPrices(): Promise<Record<number, number>> {
  if (!onChainEnabled()) return {};
  if (cache && Date.now() - cache.at < 10_000) return cache.prices;

  const client = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC ?? "https://sepolia.base.org"),
  });
  const ids: number[] = [];
  for (let id = ON_CHAIN_MARKET_MIN; id <= ON_CHAIN_MARKET_MAX; id++) ids.push(id);

  const results = await client.multicall({
    contracts: ids.map((id) => ({
      address: PREDICT_MARKET_ADDRESS as `0x${string}`,
      abi: PREDICT_MARKET_ABI,
      functionName: "priceYes",
      args: [BigInt(id)],
    })),
  });

  const prices: Record<number, number> = {};
  results.forEach((r, i) => {
    if (r.status === "success") prices[ids[i]] = Number(formatUnits(r.result as bigint, 18));
  });
  cache = { at: Date.now(), prices };
  return prices;
}
