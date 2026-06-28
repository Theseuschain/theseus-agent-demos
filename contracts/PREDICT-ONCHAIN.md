# Theseus Predict — on-chain trading (Base Sepolia)

Real, wallet-based trading for Theseus Predict. Decisions stay on Theseus (agents
make the markets and the adjudicator resolves them); the money lives on an EVM
testnet. Collateral is the existing **eUSDC faucet token**
(`0x6aaBC0dBC77Bb5F79781D42E2F58F1312bEf607B`, 6 decimals, public `mint`).

- Contract: `src/TheseusPredictionMarket.sol` — one contract, many binary
  markets, Gnosis fixed-product (CPMM) pricing. Buy YES/NO, the agent calls
  `resolve()`, winners `redeem()` 1 eUSDC per winning share.
- Frontend: when `NEXT_PUBLIC_PREDICT_MARKET` is set, the market detail page
  swaps the play-money panel for `OnChainTradePanel` (connect wallet, get test
  eUSDC, approve, buy, redeem). Unset, the app stays in play-money mode.

## 1. Validate

```
cd contracts
forge test --match-contract TheseusPredictionMarket -vv
```

All 7 tests pass (open 50/50, buy moves price + costs collateral, slippage and
only-agent guards, resolve/redeem pays winners only, solvency for either side).

## 2. Deploy (with the agent key)

The agent EOA (`AGENT_EVM_ADDRESS`) is the sole opener/resolver. It deploys the
contract, mints itself eUSDC, and opens a starter set of markets (ids 5200-5209,
2,000 eUSDC each).

```
AGENT_EVM_ADDRESS=0xF40294f810DD786E705f20D67075DDa9a7f87F8f \
forge script script/DeployTheseusPredictionMarket.s.sol \
  --rpc-url https://sepolia.base.org --broadcast --private-key $AGENT_PK
```

The deployed address is printed and written to
`deployments/TheseusPredictionMarket.txt`.

## 3. Turn it on in the app

Set in `ui/.env.local` (and in Vercel for the preview):

```
NEXT_PUBLIC_PREDICT_MARKET=0x<deployed address>
```

Redeploy the app. Market detail pages now trade on-chain: connect a wallet, mint
test eUSDC from the faucet link, buy YES/NO, and redeem after the agent resolves.

## Resolution

`resolve(id, outcome)` is `onlyAgent`. Wire the adjudicator agent's verdict to
call it (the same agent EOA that deploys), so settlement on-chain matches the
verdict the adjudicator reads off the public record.
