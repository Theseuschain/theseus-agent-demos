// GET /api/terra/live-frax
//
// Returns a live Frax/FXS snapshot mapped onto the demo's VaultState shape.
// Thin wrapper around fetchLiveFraxVaultState(). Cached for 5 minutes at
// the edge — Frax peg and FXS price move on the order of seconds, but for
// a "load preset and reason" UI a 5-minute window is plenty fresh and
// keeps us well under CoinGecko's anonymous rate limit.

import { NextResponse } from "next/server";
import { fetchLiveFraxVaultState } from "@/lib/live-frax";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await fetchLiveFraxVaultState();
    return NextResponse.json(snapshot, {
      headers: {
        "cache-control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 502 },
    );
  }
}
