// Genome -> premium AI image prompt, founders' art direction parametrized per
// genome so EVERY agent gets a real face. Emits the full batch (founders + all
// gen-1 pairings + a gen-2 layer) and a reusable template for user-built
// genomes. Outputs scripts/avatar-prompts.txt (human) + .json (machine: loop it
// through any image model, save each `file` into public/conclave/avatars/).
import { FOUNDERS, FOUNDER_BY_KEY, breed, type Genome } from "../src/lib/conclave/genome.ts";
import { writeFileSync } from "node:fs";

const SHARED =
  "Stylized painterly character portrait, head and shoulders, facing forward, a masked conspirator of a secret candlelit society. Square 1024x1024, centered bust with a little headroom, dark near-black moody background with a faint candlelit vignette, one dramatic warm key light plus the character's own colored rim glow. Premium, clean, cohesive rendering, the look of a high-status collectible character set. No text, no frame, no logo.";
const MASK: Record<string, string> = { peak: "a sleek sharp aristocratic mask with a peaked crest", round: "a smooth rounded hood, soft and inviting", severe: "a severe angular interrogator's mask", flame: "a crown of flame rising above the mask", heavy: "a heavy massive cracked stone-and-iron mask", jester: "an asymmetric harlequin jester mask", halo: "a serene mask beneath a faint glowing halo", wisp: "a faint semi-translucent mask dissolving into wisps of smoke at the edges" };
const EYE: Record<string, string> = { slit: "half-lidded calculating eyes", soft: "warm soft open eyes", stare: "piercing focused eyes, a lens or monocle motif", fervent: "burning exalted eyes", hard: "small hard eyes", odd: "mismatched asymmetric eyes", downcast: "downcast glistening sorrowful eyes with a single tear", hollow: "hollow blank barely-there eyes" };
const BROW: Record<string, string> = { scheme: "a faint knowing smirk", warm: "a genuine, disarming smile", stern: "a stern flat mouth", fervent: "a righteous exalted expression", heavy: "a clenched heavy jaw with a faint scar", crook: "a crooked grin", soft: "a gentle resigned mouth", none: "barely-there, deliberately forgettable features" };
const GLYPH: Record<string, string> = { serpent: "a coiled serpent and interlocking-rings motif", rose: "a single rose motif", eye: "an all-seeing eye and scales-of-justice motif", flame: "a flame and sunburst-halo motif", fist: "a fist and anvil motif", diamond: "harlequin diamond motifs", tear: "a halo and teardrop motif", wisp: "a vanishing-wisp motif" };

const promptFor = (g: Genome) =>
  `${SHARED} The character is dominated by its signature color ${g.hue} as rim light, glow, and accents over the dark base; make this color unmistakable. Wearing ${MASK[g.mask] ?? "a mask"}, with ${EYE[g.eye] ?? "expressive eyes"} and ${BROW[g.brow] ?? "a subtle expression"}. ${GLYPH[g.glyph] ?? ""}. Elegant, dramatic, a little sinister, beautiful and high-status.`;

type Entry = { file: string; label: string; parents: string | null; genome: Genome; prompt: string };
const manifest: Entry[] = [];
const add = (file: string, label: string, parents: string | null, genome: Genome) =>
  manifest.push({ file, label, parents, genome, prompt: promptFor(genome) });

// Founders
for (const f of FOUNDERS) add(`${f.key}.png`, f.name, null, f.genome);
// Gen 1: every unique founder pairing (28)
const keys = FOUNDERS.map((f) => f.key);
const seedFor = (a: string, b: string) => (keys.indexOf(a) * 8 + keys.indexOf(b) + 1) * 7919 + 17;
const gen1: { a: string; b: string; child: ReturnType<typeof breed> }[] = [];
for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
  const a = keys[i], b = keys[j], child = breed(FOUNDER_BY_KEY[a].genome, FOUNDER_BY_KEY[b].genome, seedFor(a, b));
  gen1.push({ a, b, child });
  add(`gen1-${a}-${b}.png`, `${child.name} (${a} x ${b})`, `${a} x ${b}`, child.genome);
}
// Gen 2: pair consecutive gen-1 offspring (6)
for (let i = 0; i + 1 < 12; i += 2) {
  const p = gen1[i], q = gen1[i + 1];
  const child = breed(p.child.genome, q.child.genome, seedFor(p.a, q.b) + i);
  add(`gen2-${i / 2}.png`, `${child.name} (${p.child.name} x ${q.child.name})`, `${p.child.name} x ${q.child.name}`, child.genome);
}

const TEMPLATE = `## TEMPLATE — user-built agents
Any agent's genome (7 genes) maps to a prompt with promptFor(genome). Genes:
  mask:  ${Object.keys(MASK).join(" | ")}
  eye:   ${Object.keys(EYE).join(" | ")}
  brow:  ${Object.keys(BROW).join(" | ")}
  glyph: ${Object.keys(GLYPH).join(" | ")}
  hue/accent: any hex (hue is the unmistakable signature color)
Raw template:
${SHARED} The character is dominated by its signature color {HUE} ... Wearing {MASK}, with {EYE} and {BROW}. {GLYPH}. Elegant, dramatic, a little sinister, beautiful and high-status.`;

const txt = [
  "# CONCLAVE AVATAR PROMPTS",
  "# Render each at 1024x1024 and save as its FILE into public/conclave/avatars/.",
  "# Same art direction for all, so founders and generated agents read as one set.",
  "", TEMPLATE, "",
  ...manifest.map((e) => `FILE: ${e.file}\n# ${e.label}${e.parents ? `  [bred: ${e.parents}]` : "  [founder]"}\n${e.prompt}\n`),
].join("\n");
writeFileSync("scripts/avatar-prompts.txt", txt);
writeFileSync("scripts/avatar-prompts.json", JSON.stringify(manifest, null, 2));
console.log(`wrote ${manifest.length} prompts (${FOUNDERS.length} founders + ${gen1.length} gen1 + 6 gen2)`);
console.log(`-> scripts/avatar-prompts.txt  and  scripts/avatar-prompts.json\n`);
console.log("sample gen-1:", manifest[10].file, "\n" + manifest[10].prompt.slice(0, 260) + "...");
