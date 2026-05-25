// GET /api/bridge/recent-fills
//
// Returns the most recent filled Across deposits landing on Base,
// mapped onto the demo's LiveBridgeFill shape. The UI calls this
// once when the visitor opens the "load a live Across fill"
// section, then lets them pick which fill to feed into the
// existing review flow.
//
// Cache: 2min server-side, 4min SWR. Visitors clicking quickly
// share a single upstream call.

import { NextResponse } from "next/server";
import { fetchRecentBaseFills } from "@/lib/across";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const fills = await fetchRecentBaseFills(10);
    return NextResponse.json(
      { fills },
      {
        headers: {
          "cache-control": "public, s-maxage=120, stale-while-revalidate=240",
        },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 502 },
    );
  }
}
