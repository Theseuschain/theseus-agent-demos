// Per-account storage for signed-in users: the markets they requested (so they
// follow them across devices) and their notifications. File-backed for local
// dev; on Vercel, swap the read/write for Vercel Blob or KV (the shape is the
// same). Keyed by a hash of the email so raw addresses never hit disk as names.
import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import type { SeedMarket } from "./types";

export interface Notif {
  id: string;
  title: string;
  body: string;
  marketSlug?: string;
  ts: number;
  read: boolean;
}
export interface UserData {
  email: string;
  markets: SeedMarket[];
  notifications: Notif[];
  updatedAt: number;
}

const DIR = resolve(process.cwd(), ".data/predict-users");
const fileFor = (email: string) =>
  resolve(DIR, createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 24) + ".json");

export async function getUser(email: string): Promise<UserData> {
  try {
    return JSON.parse(await fs.readFile(fileFor(email), "utf8")) as UserData;
  } catch {
    return { email, markets: [], notifications: [], updatedAt: Date.now() };
  }
}

async function save(data: UserData) {
  await fs.mkdir(DIR, { recursive: true });
  data.updatedAt = Date.now();
  await fs.writeFile(fileFor(data.email), JSON.stringify(data, null, 2));
}

/** Save a market the user requested, and drop a "your market is live" notification. */
export async function addMarketForUser(email: string, market: SeedMarket): Promise<UserData> {
  const u = await getUser(email);
  if (!u.markets.some((m) => m.id === market.id)) u.markets.unshift(market);
  u.notifications.unshift({
    id: "n" + Date.now().toString(36),
    title: "Your market is live",
    body: market.question,
    marketSlug: market.slug,
    ts: Date.now(),
    read: false,
  });
  u.markets = u.markets.slice(0, 100);
  u.notifications = u.notifications.slice(0, 50);
  await save(u);
  return u;
}

export async function markAllRead(email: string): Promise<UserData> {
  const u = await getUser(email);
  u.notifications = u.notifications.map((n) => ({ ...n, read: true }));
  await save(u);
  return u;
}
