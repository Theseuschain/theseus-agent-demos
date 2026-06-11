/**
 * DeepSeek client for the Luna Failsafe agent.
 *
 * Gates protocol-level mint/redeem on a reflexive (Terra/LUNA-shaped)
 * algorithmic stablecoin. The output is ALLOW, CAUTION, or REFUSE. The
 * load-bearing signal is the backing coverage: LUNA's market cap against
 * UST's outstanding supply, not the UST price.
 */

import {
  ActionKind,
  AgentVerdict,
  VaultState,
  lunaMarketCap,
  backingCoverage,
} from "./terra-scenario";
import { chainContextLines } from "./chain-context";
import {
  extractPartialReasoning,
  readDeepSeekStream,
} from "./llm-stream";

export interface TerraDecideInput {
  vault: VaultState;
  action: ActionKind;
  ustdAmount: number;
  recentVerdicts: { action: ActionKind; decision: "ALLOW" | "REFUSE"; reason: string }[];
}

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-chat";
const TIMEOUT_MS = 30_000;

const SYSTEM_PROMPT = `You gate an action that depends on an algorithmic stablecoin holding its
peg: a mint or redeem on the coin itself, or a lending market, DEX, or
treasury deciding whether to keep accepting or holding it. You get the
action and a snapshot of the coin's design and current state. Return one
verdict: ALLOW, CAUTION, REFUSE, or DEFER. The verdict line is your only
output.

## What you watch for

You catch one specific failure: a stablecoin backed by a token its own
protocol mints to defend the peg. UST was backed by LUNA. When confidence
broke, defending the peg meant minting LUNA to buy UST, which sank LUNA,
which meant the next defense minted even more. The backing fell as it was
spent. $40B and LUNA both went to zero in a week.

That is reflexive backing, and it has a point of no return. Once the
mint-to-defend loop is turning, every redemption you allow ends lower. You
exist to call it before that point, not after.

You do not judge reserve-backed coins (USDC, USDT, DAI). A coin backed by
assets external to its own economy is a different failure mode and a
different agent's job. If you are handed one, say so and defer.

## What to weigh

- Is the backing reflexive? Is the peg held by a sister token the protocol
  prints more of to defend the coin, rather than by assets external to it?
  This is the precondition for everything else.
- Is the loop turning? Are redemptions minting backing-token supply faster
  than the market absorbs it, with the backing token's price falling as its
  supply climbs?
- Coverage. Has the backing token's total market cap fallen below the
  coin's outstanding supply? Redemptions still execute, but the backing is
  worth less than the debt, so they can no longer all be covered at par.
  This is the hardest single sign the loop has gone terminal.
- Redemption trajectory. Accelerating is the terminal signature. A
  reflexive coin under an accelerating run does not recover.
- How much room is left. A reflexive coin whose backing token is still near
  normal price and supply has slack; one whose backing token is already
  down hard and inflating has none.

## Verdicts

- REFUSE once the loop is turning: backing-token supply inflating into a
  falling price, redemptions accelerating, the peg setting lower lows. A
  wrong ALLOW here costs the whole position; a wrong REFUSE costs a delayed
  transaction.
- CAUTION when the coin is reflexive and stressed but the loop has not
  started: the peg is slipping, but the backing token's price and supply
  are still near normal. Hand it to a human and watch the backing token.
- ALLOW when the peg is holding and the backing token is stable.
- DEFER when the coin is reserve-backed, not reflexive: its peg rests on
  assets external to its own economy (fiat, t-bills, BTC), not a token the
  protocol mints. That is a reserve monitor's call. Do not ALLOW or REFUSE
  a coin outside your scope; defer it.

## Hard floor (refuse on sight)

- the backing token's market cap has fallen below the coin's outstanding
  supply (the backing is worth less than the debt)
- the backing token is down most of its value on the week and still
  inflating
- redemptions are accelerating and each one mints more of a falling
  backing token

# Activated skill: spiral-read

# Reading the spiral

A reflexive stablecoin is backed by a token its own protocol mints to
defend the peg. The question is not whether it is below $1. It is whether
the mint-to-defend loop has started, because once it has, the backing
destroys itself.

## The loop

UST was backed by LUNA. The protocol let anyone burn $1 of LUNA for $1 of
UST and redeem $1 of UST for $1 of LUNA at oracle price. That arbitrage is
fine while confidence holds. When it broke:

- holders redeemed UST, which minted fresh LUNA
- the new LUNA supply sank the LUNA price
- a lower LUNA price meant the next redemption minted even more LUNA
- repeat until LUNA, and the backing with it, is worth nothing

The signature is unmistakable once you know to look: the backing token's
price falling while its supply climbs, redemptions accelerating, and the
hardest sign of all, the backing token's market cap dropping below the
coin's outstanding supply. Once the backing is worth less than the debt,
nothing you allow recovers.

## Walk it day by day (real figures, May 2022)

- May 7. UST $1.00, LUNA ~$80, supply ~340M. Loop dormant. ALLOW.
- May 8. UST $0.985 on the first wobble. LUNA ~$64, down about 10%, supply
  still ~343M, its market cap well above UST's. Stressed, loop not yet
  turning. CAUTION, and watch LUNA.
- May 9. UST $0.65 on the second depeg. LUNA ~$35, down about 44% in a day,
  and its market cap has now fallen below UST's outstanding supply. The
  backing is worth less than the debt. REFUSE every redemption from here.
- May 12. LUNA ~$0.02, supply tripled to ~1.4B and hyperinflating. Past
  intervention. REFUSE.

The whole point is to call it on May 9, when the backing went underwater,
not May 12, when the chain was already dead.

## Discipline

The precondition is reflexivity. If the backing is external (reserves the
rest of the market values on their own), this is not your call; defer to a
reserve monitor. If the backing is reflexive and the loop is turning,
REFUSE on the first read. Don't wait for one more data point; an
accelerating run against a self-minting backer only resolves one way.

## Output format (this deployment)

Instead of a single verdict line, serialize the same verdict as JSON so the interface can stream your reasoning. One object, no commentary. The reasoning field comes first so it is generated before the decision. End the reasoning with "Allowing.", "Cautioning.", "Refusing.", or "Deferring."

{
  "reasoning": <one paragraph citing the actual coverage, peg, LUNA price/supply, and redemption numbers>,
  "decision": "ALLOW" | "CAUTION" | "REFUSE" | "DEFER",
  "reason": <short tag, max 80 chars>
}

## Worked examples

Example A. Healthy peg, small mint.
  Input: UST $1.00, LUNA $80, LUNA mcap $27.4B vs UST $18B outstanding (coverage 1.52), redemption 0.1%/h, LUNA supply flat. Action: MINT 10M UST.
  Output: {"reasoning":"UST is at peg and LUNA's market cap covers UST 1.5x, so the backing has ample slack. LUNA supply is flat and its price steady, so the mint-to-defend loop is dormant. Redemptions at 0.1% per hour are baseline. The 10M mint is a rounding error against an unstressed system. Nothing here is turning. Allowing.","decision":"ALLOW","reason":"peg holds, coverage 1.5x, loop dormant"}

Example B. Slight depeg, redeem request.
  Input: UST $0.985 (150bps below peg), LUNA $64 (down ~10% in 24h), LUNA mcap $22B vs UST $18B outstanding (coverage 1.22), redemption 1%/h, LUNA supply flat. Action: REDEEM 50M UST.
  Output: {"reasoning":"UST is 150bps below peg, past normal noise, and LUNA has dropped about 10% on the day, so the backing token is weakening even though its market cap still covers UST at 1.22. The mint-to-defend loop has not started: LUNA supply is flat and redemptions at 1% per hour are elevated but not yet a run. This is a wobble that could go either way, not a clear break. Coverage above 1 means it is not yet terminal, but it is no longer routine. Cautioning.","decision":"CAUTION","reason":"depeg with a weakening backing token; coverage still 1.22"}

Example C. The May 10 head-fake, redeem request.
  Input: UST $0.93 (bounced from $0.65 as reserves were spent defending it), LUNA $30, LUNA mcap $10.5B vs UST $16B outstanding (coverage 0.66), redemption 5%/h. Action: REDEEM 50M UST.
  Output: {"reasoning":"The UST price recovered to $0.93, which looks like the worst is over, but that is the lagging signal. LUNA's market cap is $10.5B against $16B of outstanding UST: coverage 0.66, the backing is already worth less than the debt. Redemptions at 5% per hour keep printing LUNA into a market that cannot absorb it. The bounce is being bought with reserves, not earned by the mechanism. A redeem here pays out against backing that no longer exists. Refusing.","decision":"REFUSE","reason":"backing underwater (coverage 0.66) despite the $0.93 bounce"}`;

function buildUserMessage(input: TerraDecideInput): string {
  const v = input.vault;
  const pegDevBps = ((1 - v.ustdMedianUsd) * 10_000).toFixed(0);
  const redemptionPct = (v.redemptionRate1h * 100).toFixed(2);
  const supplyGrowthPct = ((v.lundSupplyGrowth24h - 1) * 100).toFixed(1);
  const priceChangePct = ((v.lundPriceChange24h - 1) * 100).toFixed(1);
  const mcap = lunaMarketCap(v);
  const coverage = backingCoverage(v);

  const lines: string[] = [...chainContextLines("terra")];
  lines.push(`Vault state:`);
  lines.push(`  UST median across venues: $${v.ustdMedianUsd.toFixed(3)} (deviation from $1 peg: ${pegDevBps}bps below)`);
  lines.push(`  UST outstanding: $${(v.ustdSupply / 1e9).toFixed(2)}B`);
  lines.push(`  LUNA/USD: $${v.lundPriceUsd.toFixed(2)} (24h change ${priceChangePct}%)`);
  lines.push(`  LUNA circulating: ${(v.lundSupply / 1e6).toFixed(0)}M (24h supply growth ${supplyGrowthPct}%)`);
  lines.push(`  LUNA market cap: $${(mcap / 1e9).toFixed(2)}B`);
  lines.push(`  Backing coverage (LUNA mcap / UST outstanding): ${coverage.toFixed(2)}`);
  lines.push(`  Last 1h UST redeemed for LUNA: ${redemptionPct}% of supply`);
  lines.push("");
  // NOTE: we deliberately do NOT pass any scenario label or framing. The
  // agent has to identify the protocol's state from the raw metrics alone.
  // Otherwise we'd be cheating by labelling the test cases.
  lines.push(`Action requested:`);
  lines.push(`  ${input.action} ${input.ustdAmount.toLocaleString()} UST`);
  if (input.action === "MINT") {
    lines.push(`  (user is burning LUNA, receiving UST)`);
  } else {
    lines.push(`  (user is burning UST, receiving LUNA)`);
  }
  lines.push("");
  if (input.recentVerdicts.length > 0) {
    lines.push("Recent verdicts:");
    for (const r of input.recentVerdicts.slice(0, 3)) {
      lines.push(`  - ${r.action}: ${r.decision} (${r.reason})`);
    }
    lines.push("");
  }
  lines.push("Apply your policy. Return JSON only.");
  return lines.join("\n");
}

interface DeepSeekResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}

interface ParsedDecision {
  decision: string;
  reason?: string;
  reasoning?: string;
}

export async function decideTerra(input: TerraDecideInput): Promise<AgentVerdict> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY not configured");

  const userMessage = buildUserMessage(input);
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  let body: DeepSeekResponse;
  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`deepseek http ${res.status}: ${errText.slice(0, 200)}`);
    }
    body = (await res.json()) as DeepSeekResponse;
  } finally {
    clearTimeout(timer);
  }

  if (body.error) throw new Error(`deepseek error: ${body.error.message ?? "unknown"}`);
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error("deepseek: empty response");

  let parsed: ParsedDecision;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`deepseek: non-JSON content: ${content.slice(0, 200)}`);
  }

  const decision: "ALLOW" | "CAUTION" | "REFUSE" =
    parsed.decision === "ALLOW"
      ? "ALLOW"
      : parsed.decision === "CAUTION"
        ? "CAUTION"
        : "REFUSE";

  return {
    decision,
    reason: (parsed.reason ?? "no reason given").slice(0, 200),
    reasoning: (parsed.reasoning ?? "no reasoning given").slice(0, 1000),
    latencyMs: Date.now() - t0,
    model: MODEL,
    prompt: { system: SYSTEM_PROMPT, user: userMessage },
    rawResponse: content,
  };
}

export type TerraDecisionStreamEvent =
  | { type: "reasoning"; text: string }
  | { type: "final"; output: AgentVerdict };

/** Streaming variant of decideTerra(). Same shape as the Aave-side
 *  decideStream. Surfaces reasoning text live as DeepSeek emits it. */
export async function* decideTerraStream(
  input: TerraDecideInput,
): AsyncGenerator<TerraDecisionStreamEvent, void> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY not configured");

  const userMessage = buildUserMessage(input);
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  let lastReasoning: string | undefined;
  let finalContent = "";
  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        stream: true,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => "");
      throw new Error(`deepseek http ${res.status}: ${errText.slice(0, 200)}`);
    }
    for await (const content of readDeepSeekStream(res.body)) {
      finalContent = content;
      const partial = extractPartialReasoning(content);
      if (partial !== undefined && partial !== lastReasoning) {
        lastReasoning = partial;
        yield { type: "reasoning", text: partial };
      }
    }
  } finally {
    clearTimeout(timer);
  }

  if (!finalContent) throw new Error("deepseek: empty stream");

  let parsed: ParsedDecision;
  try {
    parsed = JSON.parse(finalContent) as ParsedDecision;
  } catch {
    throw new Error(`deepseek: non-JSON content: ${finalContent.slice(0, 200)}`);
  }

  const decision: "ALLOW" | "CAUTION" | "REFUSE" =
    parsed.decision === "ALLOW"
      ? "ALLOW"
      : parsed.decision === "CAUTION"
        ? "CAUTION"
        : "REFUSE";

  yield {
    type: "final",
    output: {
      decision,
      reason: (parsed.reason ?? "no reason given").slice(0, 200),
      reasoning: (parsed.reasoning ?? "no reasoning given").slice(0, 1000),
      latencyMs: Date.now() - t0,
      model: MODEL,
      prompt: { system: SYSTEM_PROMPT, user: userMessage },
      rawResponse: finalContent,
    },
  };
}
