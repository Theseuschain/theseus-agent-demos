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

  return NextResponse.json(
    {
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
        rule: "Agent settles from the named source at close. Pays $1/share to the winning outcome; refunds cost if the record is too thin to call (UNRESOLVABLE).",
      },
      provenance: m.createdBy
        ? {
            created_by: m.createdBy.agent,
            agent_address: m.createdBy.address,
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
      },
    },
    { headers: { "cache-control": "public, max-age=30" } },
  );
}
