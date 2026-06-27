// Procedural collectible crest-portraits for the Conclave contestants.
// One masked-conspirator crest per archetype, generated from a small gene set
// so bred offspring can later mix traits. Outputs a contact sheet to iterate on.
//
//   cd ui && node scripts/gen-avatars.mjs && qlmanage -t -s 1400 -o /tmp scripts/avatars-sheet.svg
import { writeFileSync } from "fs";

// gene table — each archetype's look. hue/accent palette, mask silhouette,
// eye + brow shape (expression), a house glyph, and a backdrop pattern.
export const GENES = {
  schemer:    { name: "The Schemer",    hue: "#A78BFA", accent: "#6D28D9", mask: "peak",   eye: "slit",     brow: "scheme",  glyph: "serpent", pattern: "grid",     trait: "ruthless · patient" },
  charmer:    { name: "The Charmer",    hue: "#F472B6", accent: "#BE185D", mask: "round",  eye: "soft",     brow: "warm",    glyph: "rose",    pattern: "rays",     trait: "warm · disarming" },
  inquisitor: { name: "The Inquisitor", hue: "#60A5FA", accent: "#1D4ED8", mask: "severe", eye: "stare",    brow: "stern",   glyph: "eye",     pattern: "lines",    trait: "relentless · sharp" },
  zealot:     { name: "The Zealot",     hue: "#FBBF24", accent: "#B45309", mask: "flame",  eye: "fervent",  brow: "fervent", glyph: "flame",   pattern: "sun",      trait: "fervent · rigid" },
  brute:      { name: "The Brute",      hue: "#FB923C", accent: "#9A3412", mask: "heavy",  eye: "hard",     brow: "heavy",   glyph: "fist",    pattern: "bars",     trait: "blunt · forceful" },
  trickster:  { name: "The Trickster",  hue: "#22D3EE", accent: "#0E7490", mask: "jester", eye: "odd",      brow: "crook",   glyph: "diamond", pattern: "harlequin",trait: "chaotic · unreadable" },
  martyr:     { name: "The Martyr",     hue: "#34D399", accent: "#047857", mask: "halo",   eye: "downcast", brow: "soft",    glyph: "tear",    pattern: "glow",     trait: "sacrificial · cunning" },
  ghost:      { name: "The Ghost",      hue: "#94A3B8", accent: "#475569", mask: "wisp",   eye: "hollow",   brow: "none",    glyph: "wisp",    pattern: "fog",      trait: "silent · overlooked" },
};

const W = 230, H = 286;

function pattern(p, id, hue) {
  switch (p) {
    case "grid":      return `<pattern id="${id}" width="11" height="11" patternUnits="userSpaceOnUse"><path d="M11 0H0V11" fill="none" stroke="${hue}" stroke-opacity="0.22" stroke-width="0.7"/></pattern>`;
    case "rays":      return `<radialGradient id="${id}"><stop offset="0" stop-color="${hue}" stop-opacity="0.0"/><stop offset="1" stop-color="${hue}" stop-opacity="0.16"/></radialGradient>`;
    case "lines":     return `<pattern id="${id}" width="7" height="7" patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="7" stroke="${hue}" stroke-opacity="0.18" stroke-width="0.8"/></pattern>`;
    case "sun":       return `<radialGradient id="${id}"><stop offset="0" stop-color="${hue}" stop-opacity="0.35"/><stop offset="0.6" stop-color="${hue}" stop-opacity="0.05"/><stop offset="1" stop-color="${hue}" stop-opacity="0"/></radialGradient>`;
    case "bars":      return `<pattern id="${id}" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="7" height="16" fill="${hue}" fill-opacity="0.12"/></pattern>`;
    case "harlequin": return `<pattern id="${id}" width="20" height="20" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="10" fill="${hue}" fill-opacity="0.16"/><rect x="10" y="10" width="10" height="10" fill="${hue}" fill-opacity="0.16"/></pattern>`;
    case "glow":      return `<radialGradient id="${id}"><stop offset="0" stop-color="#fff" stop-opacity="0.18"/><stop offset="0.5" stop-color="${hue}" stop-opacity="0.10"/><stop offset="1" stop-color="${hue}" stop-opacity="0"/></radialGradient>`;
    case "fog":       return `<radialGradient id="${id}"><stop offset="0" stop-color="${hue}" stop-opacity="0.10"/><stop offset="1" stop-color="${hue}" stop-opacity="0"/></radialGradient>`;
  }
}
const isGrad = (p) => ["rays", "sun", "glow", "fog"].includes(p);

// the hooded mask silhouette + archetype crown features
function mask(g) {
  const c = "#0b0813";
  const base = `<path d="M115 30 C88 30 70 50 70 78 C70 96 78 108 78 120 C78 120 60 128 60 168 L170 168 C170 128 152 120 152 120 C152 108 160 96 160 78 C160 50 142 30 115 30 Z" fill="url(#face)" stroke="${g.hue}" stroke-width="2"/>`;
  let crown = "";
  if (g.mask === "peak")   crown = `<path d="M115 22 L132 44 L98 44 Z" fill="${g.hue}" opacity="0.9"/>`;
  if (g.mask === "round")  crown = `<path d="M82 50 Q115 28 148 50" fill="none" stroke="${g.hue}" stroke-width="3" opacity="0.7"/>`;
  if (g.mask === "severe") crown = `<path d="M74 56 L96 40 M156 56 L134 40" stroke="${g.hue}" stroke-width="3"/>`;
  if (g.mask === "flame")  crown = `<path d="M98 40 Q102 18 110 34 Q115 14 120 34 Q128 18 132 40 Z" fill="${g.hue}"/><path d="M104 40 Q115 26 126 40" fill="${g.accent}"/>`;
  if (g.mask === "heavy")  crown = `<path d="M70 70 L62 60 M160 70 L168 60" stroke="${g.hue}" stroke-width="4"/><path d="M115 30 L115 58" stroke="${g.accent}" stroke-width="2" opacity="0.6"/>`;
  if (g.mask === "jester") crown = `<path d="M84 46 L70 22 L96 40 Z" fill="${g.hue}"/><path d="M146 46 L160 22 L134 40 Z" fill="${g.accent}"/><circle cx="70" cy="22" r="4" fill="${g.accent}"/><circle cx="160" cy="22" r="4" fill="${g.hue}"/>`;
  if (g.mask === "halo")   crown = `<ellipse cx="115" cy="30" rx="34" ry="9" fill="none" stroke="${g.hue}" stroke-width="3" opacity="0.85"/>`;
  if (g.mask === "wisp")   crown = `<path d="M78 60 Q70 40 86 44 M152 60 Q160 40 144 44" fill="none" stroke="${g.hue}" stroke-width="2" opacity="0.5"/>`;
  return crown + base;
}

function eyes(g) {
  const e = g.hue;
  const L = 96, R = 134, Y = 92;
  const lid = (cx) => {
    switch (g.eye) {
      case "slit":     return `<path d="M${cx-11} ${Y} Q${cx} ${Y-5} ${cx+11} ${Y}" stroke="${e}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
      case "soft":     return `<circle cx="${cx}" cy="${Y}" r="6.5" fill="${e}"/><circle cx="${cx+2}" cy="${Y-2}" r="2" fill="#fff" opacity="0.8"/>`;
      case "stare":    return `<circle cx="${cx}" cy="${Y}" r="7.5" fill="none" stroke="${e}" stroke-width="2.5"/><circle cx="${cx}" cy="${Y}" r="3" fill="${e}"/>`;
      case "fervent":  return `<circle cx="${cx}" cy="${Y}" r="8" fill="${e}"/><circle cx="${cx}" cy="${Y}" r="3.5" fill="#0b0813"/>`;
      case "hard":     return `<rect x="${cx-7}" y="${Y-3}" width="14" height="5" rx="2" fill="${e}"/>`;
      case "odd":      return cx<115 ? `<circle cx="${cx}" cy="${Y}" r="7" fill="${e}"/>` : `<path d="M${cx-10} ${Y} L${cx+10} ${Y-6}" stroke="${e}" stroke-width="4" stroke-linecap="round"/>`;
      case "downcast": return `<path d="M${cx-10} ${Y-2} Q${cx} ${Y+5} ${cx+10} ${Y-2}" stroke="${e}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
      case "hollow":   return `<circle cx="${cx}" cy="${Y}" r="7" fill="#0b0813" stroke="${e}" stroke-width="1.5" opacity="0.7"/>`;
    }
  };
  return lid(L) + lid(R);
}

function brow(g) {
  const e = g.accent, L = 96, R = 134, Y = 78;
  switch (g.brow) {
    case "scheme":  return `<path d="M${L-12} ${Y+3} L${L+10} ${Y}" stroke="${e}" stroke-width="3"/><path d="M${R-10} ${Y} L${R+12} ${Y+3}" stroke="${e}" stroke-width="3"/>`;
    case "warm":    return `<path d="M${L-11} ${Y} Q${L} ${Y-4} ${L+11} ${Y}" stroke="${e}" stroke-width="2.5" fill="none"/><path d="M${R-11} ${Y} Q${R} ${Y-4} ${R+11} ${Y}" stroke="${e}" stroke-width="2.5" fill="none"/>`;
    case "stern":   return `<path d="M${L-12} ${Y-2} L${L+12} ${Y+2} M${R-12} ${Y+2} L${R+12} ${Y-2}" stroke="${e}" stroke-width="3.5"/>`;
    case "fervent": return `<path d="M${L-12} ${Y+4} L${L+12} ${Y-3} M${R-12} ${Y-3} L${R+12} ${Y+4}" stroke="${e}" stroke-width="3.5"/>`;
    case "heavy":   return `<rect x="${L-13}" y="${Y-2}" width="26" height="5" rx="2" fill="${e}"/><rect x="${R-13}" y="${Y-2}" width="26" height="5" rx="2" fill="${e}"/>`;
    case "crook":   return `<path d="M${L-12} ${Y} L${L+12} ${Y-5}" stroke="${e}" stroke-width="3"/><path d="M${R-12} ${Y+4} L${R+12} ${Y}" stroke="${e}" stroke-width="3"/>`;
    case "soft":    return `<path d="M${L-10} ${Y+2} Q${L} ${Y} ${L+10} ${Y+2}" stroke="${e}" stroke-width="2" fill="none" opacity="0.7"/><path d="M${R-10} ${Y+2} Q${R} ${Y} ${R+10} ${Y+2}" stroke="${e}" stroke-width="2" fill="none" opacity="0.7"/>`;
    default:        return "";
  }
}

function mouth(g) {
  const e = g.hue, Y = 134;
  const m = {
    schemer:    `<path d="M104 ${Y} Q120 ${Y+7} 130 ${Y-3}" stroke="${e}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
    charmer:    `<path d="M100 ${Y-2} Q115 ${Y+9} 130 ${Y-2}" stroke="${e}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
    inquisitor: `<line x1="102" y1="${Y}" x2="128" y2="${Y}" stroke="${e}" stroke-width="2.5"/>`,
    zealot:     `<path d="M104 ${Y-2} L115 ${Y+2} L126 ${Y-2}" stroke="${e}" stroke-width="2.5" fill="none"/>`,
    brute:      `<path d="M100 ${Y} L130 ${Y} M108 ${Y} L108 ${Y+5} M122 ${Y} L122 ${Y+5}" stroke="${e}" stroke-width="2.5"/>`,
    trickster:  `<path d="M100 ${Y-3} Q110 ${Y+6} 116 ${Y} Q122 ${Y-6} 132 ${Y+3}" stroke="${e}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
    martyr:     `<path d="M104 ${Y+2} Q115 ${Y-3} 126 ${Y+2}" stroke="${e}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
    ghost:      `<line x1="108" y1="${Y}" x2="122" y2="${Y}" stroke="${e}" stroke-width="1.5" opacity="0.5"/>`,
  };
  return m[Object.keys(GENES).find((k) => GENES[k] === g)] || "";
}

function glyph(g) {
  const e = g.hue;
  const G = {
    serpent: `<path d="M-7 5 Q-2 -6 3 0 Q8 6 7 -5" fill="none" stroke="${e}" stroke-width="2.2" stroke-linecap="round"/>`,
    rose:    `<circle cx="0" cy="0" r="3" fill="${e}"/><path d="M0 0 Q-6 -4 -3 -7 M0 0 Q6 -4 3 -7 M0 0 Q-7 2 -5 6 M0 0 Q7 2 5 6" fill="none" stroke="${e}" stroke-width="1.6"/>`,
    eye:     `<path d="M-8 0 Q0 -6 8 0 Q0 6 -8 0Z" fill="none" stroke="${e}" stroke-width="1.8"/><circle cx="0" cy="0" r="2.6" fill="${e}"/>`,
    flame:   `<path d="M0 -8 Q5 -2 2 4 Q6 3 4 8 L-4 8 Q-6 3 -2 4 Q-5 -2 0 -8Z" fill="${e}"/>`,
    fist:    `<rect x="-7" y="-4" width="14" height="9" rx="2.5" fill="${e}"/><path d="M-7 -2 h14 M-7 1 h14" stroke="#0b0813" stroke-width="1"/>`,
    diamond: `<path d="M0 -8 L6 0 L0 8 L-6 0Z" fill="${e}"/><path d="M0 -8 L0 8 M-6 0 L6 0" stroke="#0b0813" stroke-width="0.8"/>`,
    tear:    `<path d="M0 -8 Q5 0 0 7 Q-5 0 0 -8Z" fill="${e}"/>`,
    wisp:    `<path d="M-7 5 Q-3 -3 0 2 Q3 7 7 -1" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" opacity="0.8"/>`,
  };
  return G[g.glyph] || "";
}

export function crest(key, x = 0, y = 0, scale = 1) {
  const g = GENES[key];
  const id = key;
  const ghosted = key === "ghost" ? 'opacity="0.82"' : "";
  return `<g transform="translate(${x} ${y}) scale(${scale})">
  <defs>
    <linearGradient id="card-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16101f"/><stop offset="1" stop-color="#0a0712"/></linearGradient>
    <radialGradient id="disc-${id}" cx="0.5" cy="0.36"><stop offset="0" stop-color="${g.accent}" stop-opacity="0.55"/><stop offset="1" stop-color="#0b0813"/></radialGradient>
    <radialGradient id="face" cx="0.5" cy="0.4"><stop offset="0" stop-color="${g.accent}" stop-opacity="0.45"/><stop offset="1" stop-color="#0b0813"/></radialGradient>
    ${pattern(g.pattern, "pat-" + id, g.hue)}
  </defs>
  <rect width="${W}" height="${H}" rx="16" fill="url(#card-${id})" stroke="${g.hue}" stroke-opacity="0.4"/>
  <rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="12" fill="none" stroke="${g.hue}" stroke-opacity="0.15"/>
  <!-- portrait disc -->
  <circle cx="115" cy="104" r="86" fill="url(#disc-${id})"/>
  <circle cx="115" cy="104" r="86" fill="${isGrad(g.pattern) ? `url(#pat-${id})` : `url(#pat-${id})`}"/>
  <circle cx="115" cy="104" r="86" fill="none" stroke="${g.hue}" stroke-opacity="0.5" stroke-width="1.5"/>
  <g ${ghosted}>
    ${mask(g)}
    ${brow(g)}
    ${eyes(g)}
    ${mouth(g)}
  </g>
  <!-- house glyph badge -->
  <circle cx="115" cy="206" r="15" fill="#0b0813" stroke="${g.hue}" stroke-width="1.5"/>
  <g transform="translate(115 206)">${glyph(g)}</g>
  <!-- name plate -->
  <text x="115" y="244" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="17" fill="#F4F1EA">${g.name}</text>
  <text x="115" y="262" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9" letter-spacing="1.5" fill="${g.hue}">${g.trait.toUpperCase()}</text>
</g>`;
}

// contact sheet
const keys = Object.keys(GENES);
const cols = 4, gap = 22, pad = 28;
const sw = pad * 2 + cols * W + (cols - 1) * gap;
const rows = Math.ceil(keys.length / cols);
const sh = pad * 2 + rows * H + (rows - 1) * gap + 40;
let body = "";
keys.forEach((k, i) => {
  const cx = pad + (i % cols) * (W + gap);
  const cy = pad + 40 + Math.floor(i / cols) * (H + gap);
  body += crest(k, cx, cy);
});
const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${sw}" height="${sh}" viewBox="0 0 ${sw} ${sh}">
<rect width="${sw}" height="${sh}" fill="#070510"/>
<text x="${pad}" y="34" font-family="Georgia, serif" font-size="22" fill="#F4F1EA">Conclave · the contestants</text>
${body}</svg>`;
writeFileSync(new URL("./avatars-sheet.svg", import.meta.url), sheet);
console.log(`wrote avatars-sheet.svg (${sw}x${sh}, ${keys.length} crests)`);
