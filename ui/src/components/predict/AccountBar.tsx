"use client";

import { useEffect, useRef, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { addMarket } from "@/lib/predict/store";
import type { SeedMarket } from "@/lib/predict/types";

interface Notif {
  id: string;
  title: string;
  body: string;
  marketSlug?: string;
  ts: number;
  read: boolean;
}

function timeago(ts: number) {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export default function AccountBar() {
  const { data: session, status } = useSession();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [accountOpen, setAccountOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [email, setEmail] = useState("");
  const seeded = useRef(false);

  async function loadMe() {
    try {
      const d = await (await fetch("/api/predict/me")).json();
      if (d.signedIn) {
        setNotifs(d.notifications || []);
        if (!seeded.current) {
          (d.markets || []).forEach((m: SeedMarket) => addMarket(m));
          seeded.current = true;
        }
      } else {
        setNotifs([]);
      }
    } catch {
      /* offline */
    }
  }

  useEffect(() => {
    if (status === "authenticated") loadMe();
    else { setNotifs([]); seeded.current = false; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session?.user?.email]);

  useEffect(() => {
    const h = () => loadMe();
    window.addEventListener("predict:refresh", h);
    return () => window.removeEventListener("predict:refresh", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unread = notifs.filter((n) => !n.read).length;

  async function toggleBell() {
    const opening = !bellOpen;
    setBellOpen(opening);
    if (opening && unread) {
      try {
        await fetch("/api/predict/me", { method: "POST" });
        setNotifs((ns) => ns.map((n) => ({ ...n, read: true })));
      } catch { /* ignore */ }
    }
  }

  if (status !== "authenticated") {
    return (
      <div className="relative">
        <button
          onClick={() => setAccountOpen((v) => !v)}
          className="rounded-md border border-border px-3 py-2 text-[13px] font-medium text-fg transition-colors hover:border-fg/30"
        >
          Sign in
        </button>
        {accountOpen && (
          <div className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-border bg-bg p-3 shadow-2xl">
            <p className="px-1 pb-2 text-[12px] text-fg-dim">Sign in to save your markets and get notified when they list.</p>
            <button
              onClick={() => signIn("google", { callbackUrl: "/predict" })}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-[13px] font-medium text-fg hover:bg-fg/[0.04]"
            >
              <span className="text-[15px]">G</span> Continue with Google
            </button>
            <div className="my-2 text-center text-[10px] uppercase tracking-[0.18em] text-fg-mute">or</div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && email.includes("@")) signIn("demo", { email, callbackUrl: "/predict" }); }}
              placeholder="you@gmail.com"
              className="w-full rounded-lg border border-border bg-surface/40 px-3 py-2 text-[13px] text-fg outline-none placeholder:text-fg-mute focus:border-coral"
            />
            <button
              onClick={() => email.includes("@") && signIn("demo", { email, callbackUrl: "/predict" })}
              disabled={!email.includes("@")}
              className="mt-2 w-full rounded-lg bg-coral px-3 py-2 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-40"
            >
              Continue with email
            </button>
          </div>
        )}
      </div>
    );
  }

  const name = session?.user?.email ?? "account";
  const initial = name[0]?.toUpperCase() ?? "·";

  return (
    <div className="flex items-center gap-1.5">
      <div className="relative">
        <button
          onClick={toggleBell}
          className="relative grid h-9 w-9 place-items-center rounded-md border border-border text-fg-mute transition-colors hover:text-fg"
          title="Notifications"
        >
          <span className="text-[15px]">🔔</span>
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-coral px-1 text-[9px] font-bold text-white">
              {unread}
            </span>
          )}
        </button>
        {bellOpen && (
          <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-border bg-bg p-2 shadow-2xl">
            <p className="px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-fg-mute">Notifications</p>
            {notifs.length === 0 ? (
              <p className="px-2 py-4 text-center text-[12.5px] text-fg-mute">Nothing yet. Request a market and you'll hear back here when the agent lists it.</p>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                {notifs.map((n) => (
                  <a
                    key={n.id}
                    href={n.marketSlug ? `/predict/${n.marketSlug}` : "#"}
                    className="block rounded-lg px-2 py-2 transition-colors hover:bg-fg/[0.04]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[12.5px] font-semibold text-fg">{n.title}</span>
                      <span className="font-mono text-[10px] text-fg-mute">{timeago(n.ts)}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[12px] text-fg-dim">{n.body}</p>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="relative">
        <button
          onClick={() => setAccountOpen((v) => !v)}
          className="grid h-9 w-9 place-items-center rounded-full bg-coral/20 text-[13px] font-bold text-coral"
          title={name}
        >
          {initial}
        </button>
        {accountOpen && (
          <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-border bg-bg p-2 shadow-2xl">
            <p className="truncate px-2 py-1.5 text-[12px] text-fg-dim">{name}</p>
            <button
              onClick={() => signOut({ callbackUrl: "/predict" })}
              className="w-full rounded-lg px-2 py-2 text-left text-[13px] text-fg hover:bg-fg/[0.04]"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
