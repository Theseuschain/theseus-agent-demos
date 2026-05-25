import { NextResponse } from "next/server";
import { fetchLiveMarket } from "@/lib/live-market";

export const dynamic = "force-dynamic";
// CoinGecko's free tier is sensitive to bursts; 60s SWR is generous and
// matches what daily-return numbers actually move on. Venue mid still
// updates every poll because /api/venues has its own 10s edge cache.
export const revalidate = 60;

export async function GET() {
  try {
    const snapshot = await fetchLiveMarket();
    return NextResponse.json(
      { snapshot, fetchedAt: Date.now() },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=60, stale-while-revalidate=30",
        },
      },
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
