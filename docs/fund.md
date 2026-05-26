# Sovereign Fund (`/fund`)

**Autonomous agent-owned paper portfolio.** $100k notional, self-scheduled, no human caller. The agent ticks every N seconds, reads the live market, and decides whether to rebalance.

## What this proves

The Sovereign Fund is the smallest demo of "agent that nobody pokes." Most agent demos in 2026 are still human-triggered — a user clicks a button, the agent runs, the user sees a verdict. This one runs against the clock. The on-chain row exists because the agent decided it was time, not because anyone asked.

## What the agent reads

- Live ETH price = median of Coinbase, Binance, Uniswap (via the existing venue libs in `ui/src/lib/venues/`)
- 24h + 7d returns from CoinGecko `/coins/ethereum/market_chart?days=7&interval=daily`
- Annualized realized vol = stdev(log-returns) × √365 from the 7d series

## Decision

Tick-level: HOLD, REBALANCE_UP, REBALANCE_DOWN. The fund holds USDC + ETH; rebalances move the ETH share between 30% and 70% based on vol-adjusted momentum. Sandbox, not real funds.

## Code map

- Contract: `contracts/src/SovereignFund.sol`
- Live market: `ui/src/lib/live-market.ts`
- Scenario state: `ui/src/lib/fund-scenario.ts` (`FUND_PRESETS` + `applyFundLiveMarket`)
- Live data route: `ui/src/app/api/fund/live-market/route.ts`
- UI: `ui/src/app/fund/page.tsx`, `ui/src/components/fund/FundScenarioControls.tsx`

## Try it

[demo-agents.theseus.network/fund](https://demo-agents.theseus.network/fund). Click "live ETH" to load the current market; hit Tick to ask the agent for a decision. The button is intentionally prominent so the "agent that nobody pokes" framing comes across.

## On-chain

Ticks are written to [SovereignFund](https://sepolia.basescan.org/address/0x3e1cEd606571A35c43DA11a3b21C051690Bd926a). `tickCount()` is the cumulative tick number.
