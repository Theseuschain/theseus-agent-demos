import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { fetchLiveMarkets } from "@/lib/predict/markets";
import { isOnChainMarket, PREDICT_MARKET_ADDRESS, PREDICT_CHAIN_ID } from "@/lib/predict/onchain";

// Machine-readable record for one market: everything an autonomous agent needs
// to price, trade, or independently verify settlement — normalized to UTC.
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const { markets } = await fetchLiveMarkets();
  const m = markets.find((x) => x.slug === slug);
  if (!m) {
    return NextResponse.json({ error: "market not found" }, { status: 404 });
  }

  const onChain = isOnChainMarket(m.id);
  const closesUtc = `${m.deadlineISO}T23:59:59Z`;
  const status = Date.parse(closesUtc) <= Date.now() ? "awaiting_settlement" : "open";

  const record = {
    id: m.id,
    slug: m.slug,
    question: m.question,
    category: m.category,
    outcomes: ["YES", "NO"],
    status,
    closes_utc: closesUtc,
    resolution: {
      criteria: m.resolutionCriteria,
      primary_source: m.resolutionSource,
      // If the primary source is unreadable at close, the agent falls back to
      // an archived snapshot of it before declaring UNRESOLVABLE.
      fallback: "web.archive.org snapshot of the primary source nearest to closes_utc",
      snapshot_at: closesUtc,
      confidence_bar: 0.8,
      rule: "At close the agent reads the primary source (or its archived snapshot), records the observed value, and signs a verdict on-chain. Pays $1/share to the winning outcome. If sources are silent or contradict at or above the 0.8 confidence bar, it returns UNRESOLVABLE and refunds every position its cost.",
    },
    provenance: m.createdBy
      ? {
          created_by: m.createdBy.agent,
          agent_l1_address: m.createdBy.address,
          created_at_utc: m.createdBy.createdAtISO,
          run_seq: m.createdBy.runSeq ?? null,
          verify_url: m.createdBy.explorerUrl,
        }
      : null,
    settlement: {
      venue: onChain ? "base-sepolia" : "play-money",
      chain_id: onChain ? PREDICT_CHAIN_ID : null,
      market_contract: onChain ? PREDICT_MARKET_ADDRESS : null,
      settled_by: "Theseus adjudicator agent",
      // Populated once the agent settles. Until then settlement is pending.
      settlement_tx: null,
      settled_at_utc: null,
      final_outcome: null,
      finality: "Immediate on the agent's signed verdict. No token-holder vote and no challenge window; the only non-final state is UNRESOLVABLE, which refunds.",
    },
  };

  // Integrity binding: a hash over the immutable terms (not the live status),
  // so a reader can confirm the served record matches the on-chain terms.
  const terms = JSON.stringify({
    id: record.id,
    question: record.question,
    closes_utc: record.closes_utc,
    criteria: record.resolution.criteria,
    primary_source: record.resolution.primary_source,
  });
  const market_hash = `sha256:${createHash("sha256").update(terms).digest("hex")}`;

  return NextResponse.json(
    { ...record, market_hash },
    { headers: { "cache-control": "public, max-age=30" } },
  );
}
