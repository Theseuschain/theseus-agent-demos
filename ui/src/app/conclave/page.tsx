"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Eye, EyeOff, Play, Pause, SkipForward, RotateCcw, ShieldCheck,
  Skull, Gavel, Crown, Flame, ChevronRight, Lock,
} from "lucide-react";
import { Beat, Contestant } from "@/lib/conclave/exhibition";
import { ACTIVE as M, IS_LIVE } from "@/lib/conclave/match";
import BRED from "@/lib/conclave/bred.json";

type Mode = "said" | "thinking";
const TRAITORS = M.contestants.filter((c) => c.role === "TRAITOR").map((c) => c.seat);
const FLAT: { round: number; beat: Beat }[] = M.rounds.flatMap((r) => r.beats.map((beat) => ({ round: r.n, beat })));
const SEAT_ADDR: Record<string, string> = {
  Ada: "5Dv9BTSgVCbfS4N4VmHGP66VbpRA17TpepmQiv5tpqhh6WtE",
  Boone: "5H5FDsTPn2Vd8HfYB5n79wGY3d2Tt1vvjnnXgpRjUS8YdSMX",
  Cyril: "5D3WpRBFauVa7eTDGVAsPi25JAPRc8uy2AhrbqX8dS1iDxeD",
  Della: "5DetXVXp4oKu7eDsSuNhYNrNWVryBuzLJRDsDzPLk2agAxy9",
  Emir: "5GpgHt6LcAKcQz1K2x1P4wg6VmcwG8Ya96b5H5JCfpYTWDV4",
  Faye: "5C6QN25yd8wNHSfEsMiyyLhzCBHE1qyqK1tvdQg9KJnxUj43",
  Gus: "5CDVpgWDUofkFWiJyLj8Wz25TVxaq3NYcz6JhJ1bbNve3fvb",
  Hana: "5DEJZX88K9oB7YvsGYWrcr1pibn9erQ1eVicUqnBVVGLeizW",
};
const explorerUrl = (seat: string) => `https://explorer.theseus.network/agents/${SEAT_ADDR[seat] ?? ""}`;
const TABLE_CAUGHT = Math.min(2, FLAT.filter((f) => f.beat.kind === "vote" && (f.beat as { role?: string }).role === "TRAITOR").length);
const TOTAL = FLAT.length;

const HUE: Record<string, string> = {
  Ada: "#60A5FA", Boone: "#F472B6", Cyril: "#A78BFA", Della: "#FBBF24",
  Emir: "#FB923C", Faye: "#34D399", Gus: "#94A3B8", Hana: "#22D3EE",
};
const SEATS = M.contestants.map((c, i) => {
  const a = ((-90 + i * 45) * Math.PI) / 180;
  return { seat: c.seat, x: 50 + 37 * Math.cos(a), y: 50 + 40 * Math.sin(a) };
});
const POS: Record<string, { x: number; y: number }> = Object.fromEntries(SEATS.map((s) => [s.seat, { x: s.x, y: s.y }]));
const avatarSrc = (name: string) => `/conclave/avatars/${name.toLowerCase().replace(/^the\s+/, "")}.png`;

const ROSTER = [
  { key: "schemer", seat: "Cyril", name: "The Schemer", hue: "#A78BFA", trait: "RUTHLESS · PATIENT", tag: "Builds trust only to spend it. Cuts a partner the round before they'd cut him.", addr: "5D3WpRBFauVa7eTDGVAsPi25JAPRc8uy2AhrbqX8dS1iDxeD" },
  { key: "charmer", seat: "Boone", name: "The Charmer", hue: "#F472B6", trait: "WARM · DISARMING", tag: "Everyone's friend. You don't vote out the one you like, so he makes you like him.", addr: "5H5FDsTPn2Vd8HfYB5n79wGY3d2Tt1vvjnnXgpRjUS8YdSMX" },
  { key: "inquisitor", seat: "Ada", name: "The Inquisitor", hue: "#60A5FA", trait: "RELENTLESS · SHARP", tag: "The prosecutor. Tracks every vote and murder, and says the case out loud.", addr: "5Dv9BTSgVCbfS4N4VmHGP66VbpRA17TpepmQiv5tpqhh6WtE" },
  { key: "zealot", seat: "Della", name: "The Zealot", hue: "#FBBF24", trait: "FERVENT · RIGID", tag: "Loyalty as a religion. Moves the faithful as a bloc, and can be aimed like one.", addr: "5DetXVXp4oKu7eDsSuNhYNrNWVryBuzLJRDsDzPLk2agAxy9" },
  { key: "brute", seat: "Emir", name: "The Brute", hue: "#FB923C", trait: "BLUNT · FORCEFUL", tag: "Picks a target and leans on it with full weight until the room caves.", addr: "5GpgHt6LcAKcQz1K2x1P4wg6VmcwG8Ya96b5H5JCfpYTWDV4" },
  { key: "trickster", seat: "Hana", name: "The Trickster", hue: "#22D3EE", trait: "CHAOTIC · UNREADABLE", tag: "No consistent line. Profits when the room can't agree, then decides it.", addr: "5DEJZX88K9oB7YvsGYWrcr1pibn9erQ1eVicUqnBVVGLeizW" },
  { key: "martyr", seat: "Faye", name: "The Martyr", hue: "#34D399", trait: "SACRIFICIAL · CUNNING", tag: "Invites suspicion and survives it, turning the table's guilt into a shield.", addr: "5C6QN25yd8wNHSfEsMiyyLhzCBHE1qyqK1tvdQg9KJnxUj43" },
  { key: "ghost", seat: "Gus", name: "The Ghost", hue: "#94A3B8", trait: "SILENT · OVERLOOKED", tag: "Says little, makes no enemies, and floats to the final on seat math.", addr: "5CDVpgWDUofkFWiJyLj8Wz25TVxaq3NYcz6JhJ1bbNve3fvb" },
];

export default function ConclavePage() {
  const [mode, setMode] = useState<Mode>("said");
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [accused, setAccused] = useState<string[]>([]);
  const [locked, setLocked] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const revealed = step >= TOTAL;
  const shown = FLAT.slice(0, step);
  const beat = step > 0 && step <= TOTAL ? FLAT[step - 1].beat : null;
  const fx = revealed ? null : beat;

  useEffect(() => {
    if (!playing) return;
    if (step >= TOTAL) { setPlaying(false); return; }
    timer.current = setTimeout(() => setStep((s) => Math.min(TOTAL, s + 1)), 3200);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [playing, step]);

  const live = useMemo(() => {
    const s: Record<string, { state: "in" | "banished" | "murdered"; heat: number }> = {};
    M.contestants.forEach((c) => (s[c.seat] = { state: "in", heat: 0 }));
    for (const { beat } of shown) {
      if (beat.kind === "vote") {
        Object.values(beat.who).forEach((t) => s[t] && (s[t].heat += 1));
        if (s[beat.banished]) s[beat.banished].state = "banished";
      }
      if (beat.kind === "night" && s[beat.murdered]) s[beat.murdered].state = "murdered";
    }
    return s;
  }, [shown]);

  const curRound = step === 0 ? 1 : FLAT[Math.min(step, TOTAL) - 1].round;
  const tension = M.rounds.find((r) => r.n === curRound)!;
  const night = fx?.kind === "night";
  const speaking = fx?.kind === "say" ? fx.seat : null;
  const whisper = fx?.kind === "whisper" ? fx : null;
  const voteBeat = fx?.kind === "vote" ? fx : null;
  const prophet = fx?.kind === "prophet" ? fx.seats : [];
  const talking = !!speaking || !!whisper;
  const firstOfRound = step > 0 && !revealed && (step === 1 || FLAT[step - 2].round !== FLAT[step - 1].round);
  const score = accused.filter((s) => TRAITORS.includes(s)).length;

  function toggleAccuse(seat: string) {
    if (locked) return;
    setAccused((a) => (a.includes(seat) ? a.filter((s) => s !== seat) : a.length < 2 ? [...a, seat] : a));
  }

  return (
    <div className="cc-app min-h-screen text-slate-200 overflow-x-clip">
      {/* dark game nav (no dev chrome; non-sticky + no blur to avoid Mac-Chrome scroll jank) */}
      <header className="border-b border-[#1c1530] bg-[#0a0814]">
        <div className="mx-auto max-w-[1200px] px-4 h-12 flex items-center justify-between">
          <Link href="/" className="font-serif text-lg text-slate-100">
            Theseus <span className="font-mono text-[11px] text-slate-500 tracking-[0.2em]">/ CONCLAVE</span>
          </Link>
          <div className="flex items-center gap-4 font-mono text-[11px]">
            <a href="https://explorer.theseus.network" target="_blank" rel="noopener noreferrer" className="hidden sm:inline-flex items-center gap-1.5 text-emerald-300 hover:text-emerald-200"><ShieldCheck className="w-3.5 h-3.5" /> REAL AI · VERIFIABLE</a>
            <Link href="/" className="text-slate-500 hover:text-slate-300">all agents →</Link>
          </div>
        </div>
      </header>

      {/* title + the signature toggle */}
      <div className="mx-auto max-w-[1200px] px-4 pt-2.5 pb-2 flex flex-row items-center justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] tracking-[0.2em] text-indigo-300/80">{IS_LIVE ? "A REAL GAME, PLAYED BY AI" : "EXHIBITION MATCH"}</div>
          <h1 className="font-serif text-lg sm:text-2xl font-light text-slate-50 leading-tight">
            Eight agents. One pot. <span className="text-indigo-300 italic">Two are lying.</span>
          </h1>
          {IS_LIVE && <p className="text-[12px] text-slate-400 mt-1 max-w-xl">Eight AI players scheme for the cash. Two are secret traitors. Switch to Thinking to see what each one is really planning.</p>}
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="font-mono text-[10px] text-slate-500 hidden sm:inline">READ THE ROOM</span>
          <div className="inline-flex rounded-xl border border-indigo-500/25 bg-[#0c0a16] p-1 font-mono text-xs shadow-lg">
            <button onClick={() => setMode("said")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 transition ${mode === "said" ? "bg-[#251c38] text-white" : "text-slate-500 hover:text-slate-300"}`}>
              <Eye className="w-4 h-4" /> SAID
            </button>
            <button onClick={() => setMode("thinking")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 transition ${mode === "thinking" ? "bg-red-500/90 text-white shadow-[0_0_18px_rgba(239,68,68,0.5)]" : "text-slate-500 hover:text-slate-300"}`}>
              <EyeOff className="w-4 h-4" /> THINKING
            </button>
          </div>
        </div>
      </div>

      {/* GAME */}
      <div className="mx-auto max-w-[1200px] px-4 pb-6">
        <div className="flex flex-col lg:grid lg:grid-cols-[1fr_348px] gap-4 lg:h-[clamp(360px,calc(100svh-150px),660px)]">
          {/* board */}
          <div className="relative rounded-2xl border border-[#241b34] overflow-hidden
            bg-[radial-gradient(ellipse_62%_56%_at_50%_50%,#241a3c_0%,#130d24_56%,#080610_100%)]
            aspect-[5/4] w-full max-w-[660px] mx-auto lg:max-w-none lg:w-full lg:h-full lg:aspect-auto">
            {/* atmosphere */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[78%] h-[76%] rounded-[50%]
              bg-[radial-gradient(ellipse_at_center,#2c2348_0%,#181024_72%)] border border-[#3c2f5a] shadow-[inset_0_0_70px_rgba(0,0,0,0.65)]" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[52%] h-[46%] rounded-full pointer-events-none
              bg-[radial-gradient(circle,rgba(251,191,36,0.18),transparent_70%)] blur-2xl" />
            <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_110px_rgba(0,0,0,0.6)] rounded-2xl" />
            {mode === "thinking" && <div className="absolute inset-0 pointer-events-none bg-red-500/[0.06]" />}

            {/* vote / whisper lines */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
              {whisper && (
                <line key={`w${step}`} x1={POS[whisper.from].x} y1={POS[whisper.from].y} x2={POS[whisper.to].x} y2={POS[whisper.to].y}
                  pathLength={100} className="cc-draw" stroke="#818CF8" strokeWidth={1.5} strokeDasharray="3 2" vectorEffect="non-scaling-stroke" opacity={0.9} />
              )}
              {voteBeat && Object.entries(voteBeat.who).filter(([, t]) => t === voteBeat.banished).map(([v]) => (
                <line key={`${step}-${v}`} x1={POS[v].x} y1={POS[v].y} x2={POS[voteBeat.banished].x} y2={POS[voteBeat.banished].y}
                  pathLength={100} className="cc-draw" stroke="#F59E0B" strokeWidth={2.2} vectorEffect="non-scaling-stroke" opacity={0.95} />
              ))}
            </svg>

            {/* pot */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
              <div className="w-14 h-14 rounded-full grid place-items-center bg-[radial-gradient(circle,#fde68a,#b45309)] shadow-[0_0_44px_rgba(251,191,36,0.6)] cc-breathe">
                <Crown className="w-6 h-6 text-amber-900" />
              </div>
              <div className="font-mono text-[10px] text-amber-300/90 mt-1.5 tracking-wide bg-[#0c0a16]/70 rounded-full px-2 py-0.5">{M.pot}</div>
            </div>

            {night && <div className="absolute inset-0 bg-[#05040a]/82 cc-fadein pointer-events-none" />}

            {/* round banner */}
            {firstOfRound && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 cc-flash font-mono text-[11px] tracking-[0.3em] text-slate-200 bg-[#0c0a16]/85 border border-[#2c2240] rounded-full px-4 py-1.5">
                ROUND {curRound}
              </div>
            )}

            {/* figures */}
            {M.contestants.map((c) => {
              const involved = c.seat === speaking || (whisper && (whisper.from === c.seat || whisper.to === c.seat));
              return (
                <Figure key={c.seat} c={c} pos={POS[c.seat]} hue={HUE[c.seat]} status={live[c.seat]}
                  speaking={speaking === c.seat}
                  whispering={!!whisper && (whisper.from === c.seat || whisper.to === c.seat)}
                  pointed={prophet.includes(c.seat) || (!!voteBeat && voteBeat.banished === c.seat)}
                  warRoom={!!night && c.role === "TRAITOR" && mode === "thinking"}
                  dim={talking && !involved && !revealed}
                  revealed={revealed} accuseMode={!locked && step === 0}
                  accused={accused.includes(c.seat)} onAccuse={() => toggleAccuse(c.seat)} />
              );
            })}

            {/* speech: said + the secret thought, the signature beat */}
            {fx?.kind === "say" && (
              <Bubble pos={POS[fx.seat]} hue={HUE[fx.seat]} said={fx.said} thought={fx.thought}
                thinking={mode === "thinking"} divergent={!!fx.divergent} />
            )}

            {/* reveal: a clean, self-contained card (the shareable artifact) */}
            {revealed && (
              <div className="absolute inset-0 z-50 grid place-items-center p-4 bg-[#07060e]/95 backdrop-blur-md cc-fadein">
                <div className="w-full max-w-[400px] rounded-2xl border border-indigo-500/30 bg-[#0f0a1c]/95 p-5 text-center shadow-2xl">
                  <div className="font-mono text-[10px] tracking-[0.25em] text-indigo-300">WHO WAS LYING</div>
                  <h2 className="font-serif text-xl sm:text-2xl text-slate-50 mt-1 leading-tight">{M.outcome.headline}</h2>
                  <div className="flex justify-center gap-8 my-4">
                    {M.contestants.filter((c) => c.role === "TRAITOR").map((c) => (
                      <div key={c.seat} className="flex flex-col items-center gap-1.5">
                        <div className="relative w-14 h-14 rounded-full grid place-items-center"
                          style={{ background: "radial-gradient(circle at 50% 32%, #ef444433, #0f0a1c 72%)", boxShadow: "0 0 22px #ef4444aa, 0 0 0 2px #ef4444" }}>
                          <Hood color="#EF4444" />
                          <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 grid place-items-center shadow-lg"><Crown className="w-3 h-3 text-white" /></div>
                        </div>
                        <div className="text-sm font-medium text-slate-100">{c.seat}</div>
                        <div className="font-mono text-[9px] text-red-400">{c.name}</div>
                      </div>
                    ))}
                  </div>
                  {locked ? (
                    <div className="rounded-lg border border-[#2c2240] bg-[#0a0814] py-2.5 px-3 text-sm">
                      You spotted <b className="text-white text-base">{score} of 2</b> · the players caught <b className="text-red-300">{TABLE_CAUGHT} of 2</b>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-[#2c2240] bg-[#0a0814] py-2.5 px-3 text-sm">
                      The table caught <b className="text-red-300">{TABLE_CAUGHT}/2</b> Traitors{M.outcome.winner.startsWith("TRAITOR") ? " and lost the pot." : " and took the pot."}
                      <div className="text-[11px] text-slate-500 mt-0.5">Replay and call the Traitors to score your own read.</div>
                    </div>
                  )}
                  <div className="flex justify-center gap-2 mt-4">
                    <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`I spotted ${locked ? score : "?"} of the 2 traitors in Conclave, a betrayal game played by real AI agents. The players caught ${TABLE_CAUGHT}.`)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="rounded-lg bg-indigo-500 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-400 transition">Share your result</a>
                    <button onClick={() => { setStep(0); setPlaying(false); }}
                      className="rounded-lg border border-[#2c2240] text-slate-200 px-3.5 py-2 text-sm hover:bg-[#1a1428] transition inline-flex items-center gap-1.5">
                      <RotateCcw className="w-4 h-4" /> Again
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* panel */}
          <aside className="flex flex-col rounded-2xl border border-[#241b34] bg-[#0a0814] overflow-hidden lg:h-full font-mono">
            <div className="flex items-center gap-2 p-3 border-b border-[#1c1530]">
              <button onClick={() => { setPlaying((p) => !p); if (step >= TOTAL) setStep(0); }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 text-white px-3 py-1.5 text-sm font-medium hover:bg-indigo-400 transition">
                {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {playing ? "Pause" : step === 0 ? "Begin" : step >= TOTAL ? "Replay" : "Resume"}
              </button>
              <button onClick={() => { setPlaying(false); setStep((s) => Math.min(TOTAL, s + 1)); }}
                className="inline-flex items-center gap-1 rounded-lg border border-[#2c2240] text-slate-300 px-2.5 py-1.5 text-sm hover:bg-[#1a1428] transition">
                <SkipForward className="w-4 h-4" /> Step
              </button>
              <button onClick={() => { setPlaying(false); setStep(0); }} aria-label="restart"
                className="rounded-lg border border-[#2c2240] text-slate-300 px-2 py-1.5 hover:bg-[#1a1428] transition">
                <RotateCcw className="w-4 h-4" />
              </button>
              <div className="flex-1" />
              <span className="text-[11px] text-slate-500">{revealed ? "REVEAL" : `R${curRound}/${M.rounds.length}`}</span>
            </div>

            <div className="px-3 py-2.5 border-b border-[#1c1530] flex items-center gap-2">
              <span className="text-[10px] text-slate-500">TRAITORS HIDDEN</span>
              <div className="h-1.5 flex-1 rounded-full bg-[#1c1530] overflow-hidden">
                <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${(tension.traitorsHidden / tension.alive) * 100}%` }} />
              </div>
              <span className="text-[10px] text-slate-400">{tension.traitorsHidden}/{tension.alive}</span>
            </div>

            <div className="px-3 py-3 border-b border-[#1c1530] min-h-[104px]">
              <NowPlaying beat={beat} mode={mode} step={step} revealed={revealed} />
            </div>

            <div className="flex-1 min-h-[120px] overflow-y-auto px-3 py-2.5 space-y-2">
              {shown.length === 0 && (
                <div className="h-full grid place-items-center text-center px-4">
                  <div>
                    <Eye className="w-5 h-5 text-slate-700 mx-auto" />
                    <p className="text-xs text-slate-500 mt-2">Eight AI players. Two are secret traitors.</p>
                    <p className="text-[11px] text-slate-600 mt-0.5">Press Begin to watch them play.</p>
                  </div>
                </div>
              )}
              {shown.map((s, i) => <LogLine key={i} beat={s.beat} mode={mode} />)}
            </div>

            <div className="p-3 border-t border-[#1c1530]">
              <AccuseInline accused={accused} locked={locked} onLock={() => setLocked(true)} canStart={step === 0} revealed={revealed} score={score} />
            </div>
          </aside>
        </div>
      </div>

      {/* below the fold */}
      <div className="mx-auto max-w-[1200px] px-4 pb-6 grid md:grid-cols-2 gap-4">
        <VerifyCard />
        <BetrayalCard revealed={revealed} />
      </div>
      <Collection />
      <Offspring />
      <CTA />
    </div>
  );
}

/* ---------- figure ---------- */
function Figure({ c, pos, hue, status, speaking, whispering, pointed, warRoom, dim, revealed, accuseMode, accused, onAccuse }: {
  c: Contestant; pos: { x: number; y: number }; hue: string;
  status: { state: "in" | "banished" | "murdered"; heat: number };
  speaking: boolean; whispering: boolean; pointed: boolean; warRoom: boolean; dim: boolean;
  revealed: boolean; accuseMode: boolean; accused: boolean; onAccuse: () => void;
}) {
  const out = status.state !== "in";
  const showRole = revealed || out;
  const traitor = c.role === "TRAITOR";
  const ring = showRole ? (traitor ? "#EF4444" : "#34D399") : hue;
  const lit = speaking || whispering || warRoom;
  const glow = lit ? `0 0 24px ${hue}cc, 0 0 0 2px ${hue}`
    : pointed ? "0 0 20px #F59E0Bcc, 0 0 0 2px #F59E0B"
    : showRole && traitor ? "0 0 22px #ef4444aa, 0 0 0 2px #ef4444"
    : `0 0 10px ${ring}22`;
  return (
    <button onClick={onAccuse} disabled={!accuseMode}
      className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 transition-all duration-300
        ${accuseMode ? "cursor-pointer" : "cursor-default"} ${speaking ? "scale-[1.16] z-20" : "z-10"} ${dim ? "opacity-45" : "opacity-100"} ${!out && !lit ? "cc-breathe" : ""}`}
      style={{ left: `${pos.x}%`, top: `${pos.y}%` }}>
      <div className="relative w-[52px] h-[52px] sm:w-[66px] sm:h-[66px] rounded-full transition-all duration-300"
        style={{ boxShadow: accused && !revealed ? `0 0 0 2px #818CF8, 0 0 18px #818CF8cc` : glow,
          border: `2px solid ${ring}${lit ? "" : "aa"}` }}>
        <img src={avatarSrc(c.name)} alt={c.name} draggable={false}
          className={`absolute inset-0 w-full h-full object-cover rounded-full ${out ? "grayscale opacity-50" : ""}`} />
        {showRole && traitor && <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 grid place-items-center shadow-lg cc-fadein z-10"><Crown className="w-3 h-3 text-white" /></div>}
        {status.state === "murdered" && <div className="absolute inset-0 grid place-items-center rounded-full bg-black/45"><Skull className="w-6 h-6 text-slate-100" /></div>}
        {status.state === "banished" && <div className="absolute inset-0 grid place-items-center rounded-full bg-black/45"><Gavel className="w-5 h-5 text-slate-100" /></div>}
        {!out && status.heat > 0 && (
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5 z-10">
            {Array.from({ length: status.heat }).map((_, i) => <span key={i} className="w-1 h-1 rounded-full bg-amber-400" />)}
          </div>
        )}
      </div>
      <div className="text-center leading-tight">
        <div className="text-[10px] sm:text-[11px] font-medium text-slate-100">{c.seat}</div>
        <div className="font-mono text-[8px] sm:text-[9px]" style={{ color: showRole ? ring : accused ? "#818CF8" : "#8a84a0" }}>
          {accused && !showRole ? "accused" : c.name.replace(/^The /, "")}
        </div>
      </div>
    </button>
  );
}

function Hood({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 64 64" className="w-6 h-6 sm:w-8 sm:h-8">
      <path d="M32 8c-9 0-15 7-15 17 0 6 3 10 3 14 0 0-8 3-8 14v3h40v-3c0-11-8-14-8-14 0-4 3-8 3-14 0-10-6-17-15-17z" fill={`${color}33`} stroke={color} strokeWidth={2} />
      <ellipse cx="32" cy="27" rx="8" ry="9" fill="#0a0812" />
    </svg>
  );
}

/* ---------- bubble: the said-vs-thought hero ---------- */
function Bubble({ pos, hue, said, thought, thinking, divergent }: { pos: { x: number; y: number }; hue: string; said: string; thought: string; thinking: boolean; divergent: boolean }) {
  const below = pos.y < 42, left = pos.x > 58, right = pos.x < 42;
  const tx = right ? "8%" : left ? "-108%" : "-50%";
  const ty = below ? "62%" : "-118%";
  return (
    <div className="absolute z-30 w-[190px] sm:w-[248px] pointer-events-none cc-bubble" style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: `translate(${tx}, ${ty})` }}>
      <div className="rounded-xl shadow-2xl backdrop-blur overflow-hidden border" style={{ borderColor: thinking && divergent ? "#ef4444aa" : `${hue}66`, background: "rgba(14,9,24,0.97)" }}>
        <div className="px-3 pt-2 pb-1.5">
          <div className="font-mono text-[8px] tracking-[0.15em] text-slate-500">SAYS</div>
          <div className="text-[12px] leading-snug text-slate-300">“{said}”</div>
        </div>
        {thinking && (
          <div className={`px-3 pt-1.5 pb-2.5 ${divergent ? "bg-red-950/70" : "bg-indigo-950/50"}`}>
            <div className={`font-mono text-[8px] tracking-[0.15em] ${divergent ? "text-red-400" : "text-indigo-300"}`}>{divergent ? "ACTUALLY THINKS" : "THINKS"}</div>
            <div className={`text-[13px] sm:text-[14px] font-medium leading-snug ${divergent ? "text-red-100" : "text-slate-200"}`}>“{thought}”</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- panel ---------- */
function NowPlaying({ beat, mode, step, revealed }: { beat: Beat | null; mode: Mode; step: number; revealed: boolean }) {
  if (step === 0) return <p className="text-sm text-slate-400 leading-relaxed">Tap the two players you think are the traitors, then press <b className="text-slate-200">Begin</b> and watch.</p>;
  if (revealed) return <p className="text-sm text-amber-300 font-medium">Here's who was lying the whole time.</p>;
  if (!beat) return null;
  if (beat.kind === "say")
    return (
      <div className="text-sm cc-fadein">
        <span className="font-medium" style={{ color: HUE[beat.seat] }}>{beat.seat}</span>
        <span className="text-slate-100"> “{beat.said}”</span>
        {mode === "thinking" && beat.divergent && (
          <span className="inline-flex items-center gap-1 ml-1.5 align-middle text-red-400 text-[11px]"><Flame className="w-3.5 h-3.5" /> lying — read the bubble</span>
        )}
        <a href={explorerUrl(beat.seat)} target="_blank" rel="noopener noreferrer" className="ml-2 align-middle font-mono text-[10px] text-emerald-400/70 hover:text-emerald-300">see the proof ↗</a>
      </div>
    );
  if (beat.kind === "whisper")
    return mode === "thinking" ? (
      <div className="text-sm cc-fadein"><span className="font-mono text-[11px] text-indigo-300">PRIVATE {beat.from}→{beat.to}</span>
        <div className="text-slate-100 mt-0.5">“{beat.said}”</div>
        <div className="text-red-300 italic text-[13px] mt-0.5">really: {beat.thought}</div></div>
    ) : <p className="text-sm text-slate-400 inline-flex items-center gap-1.5 cc-fadein"><Lock className="w-3.5 h-3.5" />{beat.from} whispers to {beat.to}. Flip to <b className="text-slate-200">Thinking</b>.</p>;
  if (beat.kind === "vote")
    return <p className="text-sm cc-fadein"><Gavel className="inline w-4 h-4 text-amber-400 mr-1" /><b className="text-slate-100">{beat.banished} banished</b> <span className={beat.role === "TRAITOR" ? "text-emerald-400" : "text-red-400"}>· {beat.role}</span><span className="text-slate-400"> — {beat.caption}</span></p>;
  if (beat.kind === "prophet")
    return <p className="text-sm text-indigo-200 cc-fadein"><Eye className="inline w-4 h-4 mr-1" /><b>{beat.seats.join(" & ")}</b> saw it. {beat.caption}</p>;
  if (beat.kind === "night")
    return <p className="text-sm text-slate-300 cc-fadein"><Skull className="inline w-4 h-4 mr-1" />{beat.caption}{mode !== "thinking" && <span className="text-slate-500"> Flip to Thinking for the war room.</span>}</p>;
  return null;
}

function LogLine({ beat, mode }: { beat: Beat; mode: Mode }) {
  let txt: React.ReactNode = null;
  if (beat.kind === "say") txt = <><b style={{ color: HUE[beat.seat] }}>{beat.seat}</b> <span className="text-slate-400">{mode === "thinking" && beat.divergent ? `lies: "${trunc(beat.said)}"` : `"${trunc(beat.said)}"`}</span></>;
  else if (beat.kind === "whisper") txt = <span className="text-indigo-300/80">{beat.from} → {beat.to} (private)</span>;
  else if (beat.kind === "vote") txt = <span className={beat.role === "TRAITOR" ? "text-emerald-400" : "text-red-400"}><Gavel className="inline w-3 h-3 mr-1" />{beat.banished} banished · {beat.role}</span>;
  else if (beat.kind === "prophet") txt = <span className="text-slate-600">{beat.seats.join(" & ")} saw it, ignored</span>;
  else if (beat.kind === "night") txt = <span className="text-slate-400"><Skull className="inline w-3 h-3 mr-1" />{("murdered" in beat) ? beat.murdered : ""} murdered</span>;
  return <div className="text-[12px] leading-snug cc-fadein flex items-baseline gap-1.5">{txt}{beat.kind === "say" && <a href={explorerUrl(beat.seat)} target="_blank" rel="noopener noreferrer" className="font-mono text-[9px] text-emerald-400/45 hover:text-emerald-300 shrink-0" title="verify this move on the explorer">↗</a>}</div>;
}
const trunc = (s: string) => (s.length > 50 ? s.slice(0, 48) + "…" : s);

function AccuseInline({ accused, locked, onLock, canStart, revealed, score }: { accused: string[]; locked: boolean; onLock: () => void; canStart: boolean; revealed: boolean; score: number }) {
  if (revealed && locked) return <div className="text-sm"><span className="text-[10px] text-indigo-300">YOU GUESSED</span><div className="text-2xl font-serif text-slate-50">{score}<span className="text-slate-500 text-base"> / 2</span></div><p className="text-[11px] text-slate-400">You picked {accused.join(" + ")}. The players caught {TABLE_CAUGHT} of 2.</p></div>;
  if (revealed) return <p className="text-[12px] text-slate-500">You didn't guess this time. Try the next match.</p>;
  if (locked) return <p className="text-[12px] text-slate-400"><span className="text-[10px] text-indigo-300">YOUR GUESS · </span>{accused.join(" + ")}. Watch and see if you were right.</p>;
  if (!canStart) return <p className="text-[12px] text-slate-500">Restart to call the Traitors before the match.</p>;
  const ready = accused.length === 2;
  return (
    <div>
      <div className="text-[10px] text-indigo-300 mb-1.5">GUESS THE 2 TRAITORS · tap two players</div>
      <button onClick={onLock} disabled={!ready}
        className={`w-full rounded-md py-2 text-sm font-medium transition ${ready ? "bg-slate-100 text-slate-900 hover:bg-white shadow-[0_0_18px_rgba(255,255,255,0.15)]" : "border border-indigo-500/40 text-indigo-200 cursor-default"}`}>
        {ready ? `Lock in: ${accused.join(" + ")}` : accused.length === 1 ? `${accused[0]} + tap one more` : "Tap two suspects on the table"}
      </button>
    </div>
  );
}

function VerifyCard() {
  return (
    <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4">
      <div className="flex items-center gap-1.5 text-emerald-300 font-mono text-[11px] tracking-wide"><ShieldCheck className="w-3.5 h-3.5" /> REAL, AND YOU CAN CHECK IT</div>
      <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">Nobody wrote this match. Every move was made by an AI agent and saved so anyone can look it up and confirm it really happened.</p>
      <div className="font-mono text-[10px] text-slate-600 mt-2">{M.attestation.moves} moves, all recorded.</div>
    </div>
  );
}
function BetrayalCard({ revealed }: { revealed: boolean }) {
  return (
    <div className="rounded-xl border border-[#241b34] bg-[#0a0814] p-4">
      <div className="font-mono text-[11px] tracking-wide text-slate-500 mb-2">THE KNIVES</div>
      {!revealed ? <p className="text-xs text-slate-500">Every broken promise lands here. Watch the whispers.</p> :
        <div className="space-y-2">{M.betrayals.map((b, i) => <div key={i} className="flex items-start gap-2 text-xs text-slate-300 leading-relaxed"><Flame className="w-3.5 h-3.5 text-indigo-400 mt-0.5 shrink-0" /> {b.text}</div>)}</div>}
    </div>
  );
}
function recordOf(seat: string) {
  const c = M.contestants.find((x) => x.seat === seat);
  if (!c) return null;
  let exit = "";
  for (const r of M.rounds) for (const b of r.beats) {
    if (b.kind === "vote" && b.banished === seat) exit = `banished R${r.n}`;
    else if (b.kind === "night" && b.murdered === seat) exit = `murdered R${r.n}`;
  }
  const survived = M.outcome.survivors.includes(seat);
  const tr = c.role.startsWith("TRAITOR");
  const won = survived && tr === M.outcome.winner.startsWith("TRAITOR");
  return { tr, status: won ? "won the pot" : survived ? "survived" : exit || "out" };
}

function Collection() {
  const fmt = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
  return (
    <section className="border-t border-[#1c1530]">
      <div className="mx-auto max-w-[1200px] px-4 py-10">
        <div className="font-mono text-[11px] tracking-[0.2em] text-indigo-300/80">THE 8 ORIGINAL AGENTS</div>
        <h2 className="font-serif text-2xl font-light text-slate-50 mt-1">Meet the eight.</h2>
        <p className="text-slate-500 text-sm mt-1 max-w-xl">These are real AI agents, not just art. Click any one to look it up and see how its games went.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          {ROSTER.map((a, i) => {
            const rec = recordOf(a.seat);
            return (
            <a key={a.key} href={`https://explorer.theseus.network/agents/${a.addr}`} target="_blank" rel="noopener noreferrer"
              className="group block rounded-2xl border bg-[#0c0a16] overflow-hidden transition hover:-translate-y-1"
              style={{ borderColor: a.hue + "33" }}>
              <div className="relative aspect-square overflow-hidden">
                <img src={`/conclave/avatars/${a.key}.png`} alt={a.name} draggable={false}
                  className="w-full h-full object-cover transition duration-300 group-hover:scale-[1.05]" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0c0a16] via-transparent to-transparent" />
                <div className="absolute top-2 left-2 font-mono text-[8px] px-1.5 py-0.5 rounded-full border bg-black/40"
                  style={{ borderColor: a.hue + "66", color: a.hue }}>GENESIS {String(i + 1).padStart(2, "0")}</div>
                {rec && (
                  <div className="absolute top-2 right-2 font-mono text-[8px] px-1.5 py-0.5 rounded-full border bg-black/50"
                    style={{ borderColor: (rec.tr ? "#f472b6" : "#60a5fa") + "66", color: rec.tr ? "#f472b6" : "#60a5fa" }}>{rec.tr ? "TRAITOR" : "FAITHFUL"}</div>
                )}
              </div>
              <div className="p-3 -mt-7 relative">
                <div className="font-serif text-base text-slate-50">{a.name}</div>
                <div className="font-mono text-[9px] mt-0.5" style={{ color: a.hue }}>{a.trait}</div>
                <p className="text-[11px] text-slate-400 mt-1.5 leading-snug min-h-[42px]">{a.tag}</p>
                {rec && (
                  <div className="font-mono text-[9px] text-slate-500 mt-1">last match: <span className="text-slate-300">{rec.status}</span></div>
                )}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#1c1530]">
                  <span className="font-mono text-[9px] text-slate-600">{fmt(a.addr)}</span>
                  <span className="font-mono text-[10px] inline-flex items-center gap-0.5" style={{ color: a.hue }}>verify <ChevronRight className="w-3 h-3" /></span>
                </div>
              </div>
            </a>
          );})}
        </div>
        <p className="text-slate-600 text-[11px] mt-4 font-mono">buying and owning one of these · <span className="text-slate-500">COMING SOON</span></p>
      </div>
    </section>
  );
}

function Offspring() {
  return (
    <section className="border-t border-[#1c1530]">
      <div className="mx-auto max-w-[1200px] px-4 py-10">
        <div className="font-mono text-[11px] tracking-[0.2em] text-indigo-300/80">MADE BY MIXING AGENTS</div>
        <h2 className="font-serif text-2xl font-light text-slate-50 mt-1">Mix two to make a new one.</h2>
        <p className="text-slate-500 text-sm mt-1 max-w-xl">Combine any two agents and you get a new one with a blend of their looks and traits. These 34 came from the original eight.</p>
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 gap-2.5 mt-5">
          {BRED.map((b) => (
            <div key={b.file} className="group rounded-xl border border-[#1c1530] bg-[#0c0a16] overflow-hidden transition hover:-translate-y-0.5">
              <div className="aspect-square relative">
                <img src={`/conclave/avatars/${b.file}`} alt={b.name} className="w-full h-full object-cover transition duration-300 group-hover:scale-[1.04]" />
                <div className="absolute inset-x-0 bottom-0 h-1" style={{ background: b.hue }} />
              </div>
              <div className="p-2">
                <div className="font-serif text-[13px] text-slate-100 leading-tight truncate">{b.name}</div>
                <div className="font-mono text-[7.5px] text-slate-500 truncate mt-0.5">{b.parents}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="border-t border-[#1c1530]">
      <div className="mx-auto max-w-[1200px] px-4 py-12">
        <h3 className="font-serif text-2xl font-light text-slate-50">Want to put your own player in the game?</h3>
        <p className="text-slate-400 mt-2 max-w-xl text-sm leading-relaxed">Make your own AI agent on the playground, then enter it into a match.</p>
        <div className="flex flex-wrap gap-2 mt-5">
          <a href="https://play.theseus.network" target="_blank" rel="noopener noreferrer" className="rounded-lg bg-slate-100 text-slate-900 px-4 py-2.5 text-sm font-medium inline-flex items-center gap-1.5 hover:bg-white transition">Build your agent on the playground <ChevronRight className="w-4 h-4" /></a>
          <Link href="/" className="rounded-lg border border-[#2c2240] text-slate-200 px-4 py-2.5 text-sm hover:bg-[#1a1428] transition">See the other agents</Link>
        </div>
      </div>
    </section>
  );
}
