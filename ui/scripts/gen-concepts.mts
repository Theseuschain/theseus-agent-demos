import { readFileSync, writeFileSync } from "node:fs";
const m = JSON.parse(readFileSync("scripts/avatar-prompts.json", "utf8"));
const MASK: Record<string,string> = { peak:"a sleek peaked aristocratic faceplate", round:"a smooth rounded hooded faceplate", severe:"a severe angular faceplate", flame:"a faceplate crowned with flame", heavy:"a heavy cracked stone-and-iron faceplate", jester:"an asymmetric harlequin faceplate", halo:"a serene faceplate under a faint halo", wisp:"a faceplate dissolving into wisps of smoke" };
const EYE: Record<string,string> = { slit:"half-lidded calculating eye-glow", soft:"warm soft open eye-glow", stare:"piercing focused eye-glow with a lens", fervent:"burning exalted eye-glow", hard:"small hard eye-glow", odd:"mismatched asymmetric eyes", downcast:"downcast eye-glow with a single tear", hollow:"hollow blank eye-glow" };
const BROW: Record<string,string> = { scheme:"a knowing smirk", warm:"a disarming smile", stern:"a stern set", fervent:"a righteous look", heavy:"a clenched scarred jaw", crook:"a crooked grin", soft:"a gentle resigned look", none:"forgettable features" };
const GLYPH: Record<string,string> = { serpent:"a coiled-serpent motif", rose:"a rose motif", eye:"an all-seeing-eye motif", flame:"a flame motif", fist:"a fist-and-anvil motif", diamond:"harlequin-diamond motifs", tear:"a halo-and-teardrop motif", wisp:"a vanishing-wisp motif" };
const lines: string[] = [];
for (const e of m) {
  if (!e.parents) continue;
  const name = e.label.split(" (")[0];
  const g = e.genome;
  lines.push(`Next character: ${name}, the offspring of ${e.parents.replace(" x ", " and ")}. Signature rim-glow ${g.hue}. ${MASK[g.mask]}, ${EYE[g.eye]}, ${BROW[g.brow]}, ${GLYPH[g.glyph]}. Blend the two parents' faceplates so it visibly belongs to both.  [save as ${e.file}]`);
}
writeFileSync("scripts/avatar-concepts.txt", lines.join("\n\n"));
console.log(`${lines.length} offspring concepts -> scripts/avatar-concepts.txt\n`);
console.log(lines.slice(0, 6).join("\n\n"));
