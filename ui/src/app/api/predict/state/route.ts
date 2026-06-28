// Live market state for the app. Prices come from the on-chain contract (the
// board reads real on-chain prices); volume comes from the agent-trader cron
// round if one has run, else the bundled baseline. The Traders page reads the
// leaderboard from the same cron state.
import { readState } from "@/lib/predict/traders-store";
import { readOnChainPrices } from "@/lib/predict/onchain-read";
import bundled from "@/lib/predict/agent-markets.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const baseVol: Record<number, number> = Object.fromEntries(
  (bundled as { id: number; volumeUsd: number }[]).map((m) => [m.id, m.volumeUsd]),
);

export async function GET() {
  const [s, onchain] = await Promise.all([
    readState().catch(() => null),
    readOnChainPrices().catch(() => ({} as Record<number, number>)),
  ]);

  const traderVol: Record<number, number> = s?.markets
    ? Object.fromEntries((s.markets as { id: number; volumeUsd: number }[]).map((m) => [m.id, m.volumeUsd]))
    : {};

  // On-chain price is the source of truth; volume falls back trader-round -> baseline.
  const prices: Record<number, { initialYes: number; volumeUsd: number }> = {};
  for (const [idStr, yes] of Object.entries(onchain)) {
    const id = Number(idStr);
    prices[id] = { initialYes: yes, volumeUsd: traderVol[id] ?? baseVol[id] ?? 0 };
  }

  const live = Object.keys(prices).length > 0;
  return Response.json({ live, round: s?.round, updatedAt: s?.updatedAt, prices, traders: s?.traders });
}
