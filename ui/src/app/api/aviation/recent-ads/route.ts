// GET /api/aviation/recent-ads
//
// Returns the most recent FAA Airworthiness Directives from the
// Federal Register, mapped onto the reviewer's CertificationChange
// shape. The UI calls this lazily when the visitor opens the
// "load a live FAA AD" section, then lets them pick one to feed
// into the existing review flow.

import { NextResponse } from "next/server";
import { fetchRecentADs } from "@/lib/faa-feed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const directives = await fetchRecentADs(6);
    return NextResponse.json(
      { directives },
      {
        headers: {
          // 6h fresh, 12h SWR — ADs publish ~daily at most.
          "cache-control":
            "public, s-maxage=21600, stale-while-revalidate=43200",
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
