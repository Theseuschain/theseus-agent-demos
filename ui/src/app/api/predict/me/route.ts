// The signed-in user's saved markets + notifications. GET to load them, POST to
// mark notifications read.
import { auth } from "@/auth";
import { getUser, markAllRead } from "@/lib/predict/user-store";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return Response.json({ signedIn: false, markets: [], notifications: [] });
  const u = await getUser(email);
  return Response.json({ signedIn: true, email, markets: u.markets, notifications: u.notifications });
}

export async function POST() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return Response.json({ ok: false }, { status: 401 });
  const u = await markAllRead(email);
  return Response.json({ ok: true, notifications: u.notifications });
}
