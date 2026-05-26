# Polymarket Adjudicator (`/adjudicate`)

**Resolves prediction markets with native LLM web search.** The agent reads a real Polymarket question, runs live web search to find evidence, and emits a resolution with citations.

## Failure shape

Polymarket's adjudication disputes (multiple, 2024–2025). A binary outcome is only as good as the source it reads. Disputes typically arise when the contract's pre-declared source goes silent, contradicts itself, or has been gamed by the question's framing.

## What the agent reads

- A live Polymarket market via the Gamma API (`/markets/<id>`)
- Whatever the LLM finds via Claude's native `web_search_20250305` tool

## Decision

Sonnet 4.6 with web_search. Reads the market's question + close date, searches for the underlying fact, returns one of YES / NO / UNRESOLVABLE with a written rationale and the URLs it consulted. The contract stores the resolution + the dossier hash; the dossier blob has the verbatim search trace.

## Code map

- Contract: `contracts/src/PredictionMarketAdjudicator.sol`
- Market client: `ui/src/lib/polymarket.ts`
- LLM call (SSE streaming): `ui/src/app/api/adjudicate/route.ts`
- UI: `ui/src/app/adjudicate/page.tsx`

## Try it

[demo-agents.theseus.network/adjudicate](https://demo-agents.theseus.network/adjudicate). Pick a preset market or paste a Polymarket URL; the agent streams its reasoning live and posts the resolution to chain.

## On-chain

Resolutions are written to [PredictionMarketAdjudicator](https://sepolia.basescan.org/address/0xd14A0963D48B944463F3fE6e776C11e09101bE40). The contract's `touchedMarketCount()` is read by the home stats strip.
