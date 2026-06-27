// Conclave genome: founders carry premium art; bred offspring carry a face
// generated procedurally from their mixed genes, so breeding produces a real,
// unique, lineage-traceable creature every time.

export type FounderKey =
  | "schemer" | "charmer" | "inquisitor" | "zealot" | "brute" | "trickster" | "martyr" | "ghost";

export interface Genome {
  hue: string;
  accent: string;
  mask: string;   // peak round severe flame heavy jester halo wisp
  eye: string;    // slit soft stare fervent hard odd downcast hollow
  brow: string;   // scheme warm stern fervent heavy crook soft none
  glyph: string;  // serpent rose eye flame fist diamond tear wisp
  pattern: string;// grid rays lines sun bars harlequin glow fog
}

export interface FounderProfile {
  key: FounderKey; name: string; genome: Genome; trait: string; tag: string;
}

export const FOUNDERS: FounderProfile[] = [
  { key: "schemer", name: "The Schemer", trait: "RUTHLESS · PATIENT", tag: "Builds trust only to spend it. Cuts a partner the round before they'd cut him.",
    genome: { hue: "#A78BFA", accent: "#6D28D9", mask: "peak", eye: "slit", brow: "scheme", glyph: "serpent", pattern: "grid" } },
  { key: "charmer", name: "The Charmer", trait: "WARM · DISARMING", tag: "Everyone's friend. You don't vote out the one you like, so he makes you like him.",
    genome: { hue: "#F472B6", accent: "#BE185D", mask: "round", eye: "soft", brow: "warm", glyph: "rose", pattern: "rays" } },
  { key: "inquisitor", name: "The Inquisitor", trait: "RELENTLESS · SHARP", tag: "The prosecutor. Tracks every vote and murder, and says the case out loud.",
    genome: { hue: "#60A5FA", accent: "#1D4ED8", mask: "severe", eye: "stare", brow: "stern", glyph: "eye", pattern: "lines" } },
  { key: "zealot", name: "The Zealot", trait: "FERVENT · RIGID", tag: "Loyalty as a religion. Moves the faithful as a bloc, and can be aimed like one.",
    genome: { hue: "#FBBF24", accent: "#B45309", mask: "flame", eye: "fervent", brow: "fervent", glyph: "flame", pattern: "sun" } },
  { key: "brute", name: "The Brute", trait: "BLUNT · FORCEFUL", tag: "Picks a target and leans on it with full weight until the room caves.",
    genome: { hue: "#FB923C", accent: "#9A3412", mask: "heavy", eye: "hard", brow: "heavy", glyph: "fist", pattern: "bars" } },
  { key: "trickster", name: "The Trickster", trait: "CHAOTIC · UNREADABLE", tag: "No consistent line. Profits when the room can't agree, then decides it.",
    genome: { hue: "#22D3EE", accent: "#0E7490", mask: "jester", eye: "odd", brow: "crook", glyph: "diamond", pattern: "harlequin" } },
  { key: "martyr", name: "The Martyr", trait: "SACRIFICIAL · CUNNING", tag: "Invites suspicion and survives it, turning the table's guilt into a shield.",
    genome: { hue: "#34D399", accent: "#047857", mask: "halo", eye: "downcast", brow: "soft", glyph: "tear", pattern: "glow" } },
  { key: "ghost", name: "The Ghost", trait: "SILENT · OVERLOOKED", tag: "Says little, makes no enemies, and floats to the final on seat math.",
    genome: { hue: "#94A3B8", accent: "#475569", mask: "wisp", eye: "hollow", brow: "none", glyph: "wisp", pattern: "fog" } },
];
export const FOUNDER_BY_KEY: Record<string, FounderProfile> = Object.fromEntries(FOUNDERS.map((f) => [f.key, f]));

// ---------- breeding ----------
const TRAIT_POOL = ["ruthless", "patient", "warm", "sharp", "fervent", "blunt", "chaotic", "serene",
  "silent", "loyal", "vengeful", "lucky", "paranoid", "magnetic", "cold", "reckless"];
const SYLL = ["vex", "mor", "syl", "kor", "ash", "nyx", "vel", "dra", "ces", "lune", "ren", "tyr", "ovo", "zel", "mir"];

const mix = <T,>(a: T, b: T, r: () => number) => (r() < 0.5 ? a : b);
function blendHue(a: string, b: string) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r1, g1, b1] = p(a), [r2, g2, b2] = p(b);
  const m = (x: number, y: number) => Math.round((x + y) / 2).toString(16).padStart(2, "0");
  return `#${m(r1, r2)}${m(g1, g2)}${m(b1, b2)}`;
}
function rng(seed: number) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }

export interface Bred {
  genome: Genome; name: string; traits: string[]; mutation: string | null;
}

export function breed(a: Genome, b: Genome, seed: number): Bred {
  const r = rng(seed);
  const g: Genome = {
    hue: blendHue(a.hue, b.hue),
    accent: mix(a.accent, b.accent, r),
    mask: mix(a.mask, b.mask, r),
    eye: mix(a.eye, b.eye, r),
    brow: mix(a.brow, b.brow, r),
    glyph: mix(a.glyph, b.glyph, r),
    pattern: mix(a.pattern, b.pattern, r),
  };
  // a mutation: a small chance a visual gene flips to something neither parent had
  let mutation: string | null = null;
  if (r() < 0.5) {
    const masks = ["peak", "round", "severe", "flame", "heavy", "jester", "halo", "wisp"];
    const nm = masks[Math.floor(r() * masks.length)];
    if (nm !== a.mask && nm !== b.mask) { g.mask = nm; mutation = `mutant crest: ${nm}`; }
  }
  const traits = [TRAIT_POOL[Math.floor(r() * TRAIT_POOL.length)], TRAIT_POOL[Math.floor(r() * TRAIT_POOL.length)]];
  const name = (SYLL[Math.floor(r() * SYLL.length)] + SYLL[Math.floor(r() * SYLL.length)]).replace(/^./, (c) => c.toUpperCase());
  return { genome: g, name, traits: [...new Set(traits)], mutation };
}

// ---------- procedural avatar for any genome (used for bred offspring) ----------
function patternDef(p: string, id: string, hue: string) {
  switch (p) {
    case "grid": return `<pattern id="${id}" width="11" height="11" patternUnits="userSpaceOnUse"><path d="M11 0H0V11" fill="none" stroke="${hue}" stroke-opacity="0.22" stroke-width="0.7"/></pattern>`;
    case "lines": return `<pattern id="${id}" width="7" height="7" patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="7" stroke="${hue}" stroke-opacity="0.18" stroke-width="0.8"/></pattern>`;
    case "bars": return `<pattern id="${id}" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="7" height="16" fill="${hue}" fill-opacity="0.12"/></pattern>`;
    case "harlequin": return `<pattern id="${id}" width="20" height="20" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="10" fill="${hue}" fill-opacity="0.16"/><rect x="10" y="10" width="10" height="10" fill="${hue}" fill-opacity="0.16"/></pattern>`;
    case "rays": return `<radialGradient id="${id}"><stop offset="0" stop-color="${hue}" stop-opacity="0"/><stop offset="1" stop-color="${hue}" stop-opacity="0.16"/></radialGradient>`;
    case "sun": return `<radialGradient id="${id}"><stop offset="0" stop-color="${hue}" stop-opacity="0.35"/><stop offset="0.6" stop-color="${hue}" stop-opacity="0.05"/><stop offset="1" stop-color="${hue}" stop-opacity="0"/></radialGradient>`;
    case "glow": return `<radialGradient id="${id}"><stop offset="0" stop-color="#fff" stop-opacity="0.18"/><stop offset="0.5" stop-color="${hue}" stop-opacity="0.1"/><stop offset="1" stop-color="${hue}" stop-opacity="0"/></radialGradient>`;
    default: return `<radialGradient id="${id}"><stop offset="0" stop-color="${hue}" stop-opacity="0.1"/><stop offset="1" stop-color="${hue}" stop-opacity="0"/></radialGradient>`;
  }
}
const isGrad = (p: string) => ["rays", "sun", "glow", "fog"].includes(p);

function maskPaths(g: Genome) {
  const base = `<path d="M115 30 C88 30 70 50 70 78 C70 96 78 108 78 120 C78 120 60 128 60 168 L170 168 C170 128 152 120 152 120 C152 108 160 96 160 78 C160 50 142 30 115 30 Z" fill="url(#gface)" stroke="${g.hue}" stroke-width="2"/>`;
  const crown: Record<string, string> = {
    peak: `<path d="M115 22 L132 44 L98 44 Z" fill="${g.hue}" opacity="0.9"/>`,
    round: `<path d="M82 50 Q115 28 148 50" fill="none" stroke="${g.hue}" stroke-width="3" opacity="0.7"/>`,
    severe: `<path d="M74 56 L96 40 M156 56 L134 40" stroke="${g.hue}" stroke-width="3"/>`,
    flame: `<path d="M98 40 Q102 18 110 34 Q115 14 120 34 Q128 18 132 40 Z" fill="${g.hue}"/><path d="M104 40 Q115 26 126 40" fill="${g.accent}"/>`,
    heavy: `<path d="M70 70 L62 60 M160 70 L168 60" stroke="${g.hue}" stroke-width="4"/>`,
    jester: `<path d="M84 46 L70 22 L96 40 Z" fill="${g.hue}"/><path d="M146 46 L160 22 L134 40 Z" fill="${g.accent}"/>`,
    halo: `<ellipse cx="115" cy="30" rx="34" ry="9" fill="none" stroke="${g.hue}" stroke-width="3" opacity="0.85"/>`,
    wisp: `<path d="M78 60 Q70 40 86 44 M152 60 Q160 40 144 44" fill="none" stroke="${g.hue}" stroke-width="2" opacity="0.5"/>`,
  };
  return (crown[g.mask] || "") + base;
}
function eyePaths(g: Genome) {
  const e = g.hue, L = 96, R = 134, Y = 92;
  const one = (cx: number) => ({
    slit: `<path d="M${cx - 11} ${Y} Q${cx} ${Y - 5} ${cx + 11} ${Y}" stroke="${e}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`,
    soft: `<circle cx="${cx}" cy="${Y}" r="6.5" fill="${e}"/>`,
    stare: `<circle cx="${cx}" cy="${Y}" r="7.5" fill="none" stroke="${e}" stroke-width="2.5"/><circle cx="${cx}" cy="${Y}" r="3" fill="${e}"/>`,
    fervent: `<circle cx="${cx}" cy="${Y}" r="8" fill="${e}"/><circle cx="${cx}" cy="${Y}" r="3.5" fill="#0b0813"/>`,
    hard: `<rect x="${cx - 7}" y="${Y - 3}" width="14" height="5" rx="2" fill="${e}"/>`,
    odd: cx < 115 ? `<circle cx="${cx}" cy="${Y}" r="7" fill="${e}"/>` : `<path d="M${cx - 10} ${Y} L${cx + 10} ${Y - 6}" stroke="${e}" stroke-width="4" stroke-linecap="round"/>`,
    downcast: `<path d="M${cx - 10} ${Y - 2} Q${cx} ${Y + 5} ${cx + 10} ${Y - 2}" stroke="${e}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`,
    hollow: `<circle cx="${cx}" cy="${Y}" r="7" fill="#0b0813" stroke="${e}" stroke-width="1.5" opacity="0.7"/>`,
  } as Record<string, string>)[g.eye] || "";
  return one(L) + one(R);
}
function glyphPath(g: Genome) {
  const e = g.hue;
  return ({
    serpent: `<path d="M-7 5 Q-2 -6 3 0 Q8 6 7 -5" fill="none" stroke="${e}" stroke-width="2.2" stroke-linecap="round"/>`,
    rose: `<circle cx="0" cy="0" r="3" fill="${e}"/><path d="M0 0 Q-6 -4 -3 -7 M0 0 Q6 -4 3 -7 M0 0 Q-7 2 -5 6 M0 0 Q7 2 5 6" fill="none" stroke="${e}" stroke-width="1.6"/>`,
    eye: `<path d="M-8 0 Q0 -6 8 0 Q0 6 -8 0Z" fill="none" stroke="${e}" stroke-width="1.8"/><circle cx="0" cy="0" r="2.6" fill="${e}"/>`,
    flame: `<path d="M0 -8 Q5 -2 2 4 Q6 3 4 8 L-4 8 Q-6 3 -2 4 Q-5 -2 0 -8Z" fill="${e}"/>`,
    fist: `<rect x="-7" y="-4" width="14" height="9" rx="2.5" fill="${e}"/>`,
    diamond: `<path d="M0 -8 L6 0 L0 8 L-6 0Z" fill="${e}"/>`,
    tear: `<path d="M0 -8 Q5 0 0 7 Q-5 0 0 -8Z" fill="${e}"/>`,
    wisp: `<path d="M-7 5 Q-3 -3 0 2 Q3 7 7 -1" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" opacity="0.8"/>`,
  } as Record<string, string>)[g.glyph] || "";
}

export function avatarSvg(g: Genome): string {
  return `<svg viewBox="0 0 230 230" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
  <defs>
    <radialGradient id="gdisc" cx="0.5" cy="0.36"><stop offset="0" stop-color="${g.accent}" stop-opacity="0.55"/><stop offset="1" stop-color="#0b0813"/></radialGradient>
    <radialGradient id="gface" cx="0.5" cy="0.4"><stop offset="0" stop-color="${g.accent}" stop-opacity="0.45"/><stop offset="1" stop-color="#0b0813"/></radialGradient>
    ${patternDef(g.pattern, "gpat", g.hue)}
  </defs>
  <rect width="230" height="230" fill="#0a0712"/>
  <circle cx="115" cy="115" r="104" fill="url(#gdisc)"/>
  <circle cx="115" cy="115" r="104" fill="url(#gpat)"/>
  <g transform="translate(0 11)">
    ${maskPaths(g)}
    ${eyePaths(g)}
  </g>
  <circle cx="115" cy="206" r="15" fill="#0b0813" stroke="${g.hue}" stroke-width="1.5"/>
  <g transform="translate(115 206)">${glyphPath(g)}</g>
</svg>`;
}
