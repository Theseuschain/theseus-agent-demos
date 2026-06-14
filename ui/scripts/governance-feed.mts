/**
 * Run the live governance reviewer on its presets and print the reasoning it
 * actually produces, to check the prose got sharper (and the verdict held).
 *   cd ui && npx --yes tsx scripts/governance-feed.mts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { reviewGovernanceStream } from "../src/lib/governance-llm";
import { GOVERNANCE_PRESETS } from "../src/lib/governance-scenario";

const here = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(here, "..", ".env.local");
if (!process.env.DEEPSEEK_API_KEY && fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function main() {
  for (const key of ["beanstalk", "routine"] as const) {
    let out: { decision: string; reasoning: string } | null = null;
    for await (const e of reviewGovernanceStream({
      proposal: GOVERNANCE_PRESETS[key].proposal,
      recentVerdicts: [],
    })) {
      if (e.type === "final") out = e.output;
    }
    console.log(`\n===== ${key} -> ${out?.decision} =====`);
    console.log(out?.reasoning);
  }
}
main();
