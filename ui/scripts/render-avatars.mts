// Render every avatar prompt in one pass. Reads scripts/avatar-prompts.json and
// saves each image to public/conclave/avatars/<file>. Founders are kept unless
// --all is passed. Provider is swappable: default is the OpenAI images API
// (gpt-image-1, 1024x1024); replace generateImage() for Replicate/Fal/etc.
//
//   OPENAI_API_KEY=sk-... npx tsx scripts/render-avatars.mts        # offspring only
//   OPENAI_API_KEY=sk-... npx tsx scripts/render-avatars.mts --all  # re-render founders too
import { readFileSync, writeFileSync, existsSync } from "node:fs";

type Entry = { file: string; label: string; parents: string | null; prompt: string };
const manifest: Entry[] = JSON.parse(readFileSync("scripts/avatar-prompts.json", "utf8"));
const KEY = process.env.OPENAI_API_KEY;
const ALL = process.argv.includes("--all");
const OUT = "public/conclave/avatars";

async function generateImage(prompt: string): Promise<Buffer> {
  const r = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-image-1", prompt, size: "1024x1024", n: 1 }),
  });
  const j: any = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(j).slice(0, 200));
  return Buffer.from(j.data[0].b64_json, "base64");
}

if (!KEY) { console.error("Set OPENAI_API_KEY (or edit generateImage() for your image provider)."); process.exit(1); }
let done = 0, skipped = 0, failed = 0;
for (const e of manifest) {
  const path = `${OUT}/${e.file}`;
  const isFounder = e.parents === null;
  if (!ALL && isFounder && existsSync(path)) { skipped++; continue; }
  try { writeFileSync(path, await generateImage(e.prompt)); done++; console.log(`  ${done}. ${e.file}  (${e.label})`); }
  catch (err: any) { failed++; console.log(`  x ${e.file}: ${err.message}`); }
}
console.log(`\ndone ${done}, skipped ${skipped} founders, failed ${failed} -> ${OUT}/`);
