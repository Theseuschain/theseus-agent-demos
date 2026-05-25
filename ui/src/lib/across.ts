/**
 * Across Protocol API client. Returns recent filled deposits whose
 * destination chain is Base (chainId 8453) so the Bridge Guardian
 * can review actual cross-chain fills instead of just the three
 * synthetic attack-shape presets.
 *
 * Across is an intent-based, optimistic bridge: a relayer fronts
 * the destination-side assets immediately and is later reimbursed
 * after an off-chain optimistic dispute window. The Bridge
 * Guardian's BridgeState was modeled for validator-multisig
 * bridges (Ronin / Wormhole / Nomad shapes), so we synthesize a
 * "healthy" BridgeState here and carry the live Across-specific
 * fields (origin chain, amount, token, recipient, depositor, etc.)
 * in a separate liveFill payload that the LLM prompt prepends as
 * prose. The agent reads both the structured state AND the live
 * context, and reasons accordingly — fills that look normal get
 * ALLOWed, fills with anomalies (e.g. recipient differing from
 * depositor in an unusual way, very large amount, exotic origin)
 * get flagged in the reasoning.
 */

import { BridgeState, HEALTHY_BRIDGE } from "./bridge-scenario";

const ACROSS_API = "https://app.across.to/api/deposits";
const BASE_CHAIN_ID = 8453;

interface AcrossDepositRaw {
  id: number;
  depositId: string;
  originChainId: number;
  destinationChainId: number;
  depositor: string;
  recipient: string;
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  outputAmount: string;
  message: string;
  status: string;
  depositTxHash: string;
  depositBlockNumber: number;
  depositBlockTimestamp: string;
  fillBlockNumber: number;
  fillBlockTimestamp: string;
  fillTx: string;
  relayer: string;
  bridgeFeeUsd: string | null;
  inputPriceUsd: string | null;
  outputPriceUsd: string | null;
}

/** Friendly chain labels for the chain ids Across bridges to/from. */
const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  10: "Optimism",
  56: "BNB Chain",
  130: "Unichain",
  137: "Polygon",
  324: "zkSync Era",
  480: "World Chain",
  690: "Redstone",
  1135: "Lisk",
  1868: "Soneium",
  1923: "Swellchain",
  8453: "Base",
  34443: "Mode",
  41455: "Aleph Zero",
  42161: "Arbitrum",
  57073: "Ink",
  59144: "Linea",
  81457: "Blast",
  534352: "Scroll",
  7777777: "Zora",
};

/** USDC / WETH / USDT addresses on the chains Across most commonly bridges
 *  from, so we can show a friendly token symbol instead of raw hex. */
const TOKEN_SYMBOLS: Record<string, { symbol: string; decimals: number }> = {
  // USDC (canonical and bridged variants share symbol; decimals=6)
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": { symbol: "USDC", decimals: 6 },
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": { symbol: "USDC", decimals: 6 },
  "0xaf88d065e77c8cc2239327c5edb3a432268e5831": { symbol: "USDC", decimals: 6 },
  "0x0b2c639c533813f4aa9d7837caf62653d097ff85": { symbol: "USDC", decimals: 6 },
  "0x79a02482a880bce3f13e09da970dc34db4cd24d1": { symbol: "USDC.e", decimals: 6 },
  "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359": { symbol: "USDC", decimals: 6 },
  // WETH
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": { symbol: "WETH", decimals: 18 },
  "0x4200000000000000000000000000000000000006": { symbol: "WETH", decimals: 18 },
  "0x82af49447d8a07e3bd95bd0d56f35241523fbab1": { symbol: "WETH", decimals: 18 },
  "0x5300000000000000000000000000000000000004": { symbol: "WETH", decimals: 18 },
  // USDT
  "0xdac17f958d2ee523a2206206994597c13d831ec7": { symbol: "USDT", decimals: 6 },
  "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2": { symbol: "USDT", decimals: 6 },
  // DAI
  "0x6b175474e89094c44da98b954eedeac495271d0f": { symbol: "DAI", decimals: 18 },
};

function chainName(id: number): string {
  return CHAIN_NAMES[id] ?? `chainId ${id}`;
}

function tokenInfo(addr: string): { symbol: string; decimals: number } {
  return TOKEN_SYMBOLS[addr.toLowerCase()] ?? { symbol: "UNKNOWN", decimals: 18 };
}

/** Format a BigInt amount string using the token decimals. */
function fmtAmount(rawAmount: string, decimals: number): number {
  // BigInt-safe to a Number — fine for display; we lose precision below ~1e-9
  // but the demo only ever displays this rounded.
  try {
    const big = BigInt(rawAmount);
    const scale = BigInt(10) ** BigInt(decimals);
    const whole = big / scale;
    const frac = big % scale;
    return Number(whole) + Number(frac) / Number(scale);
  } catch {
    return Number(rawAmount) / Math.pow(10, decimals);
  }
}

export interface LiveBridgeFill {
  /** Stable id (the Across depositId, which is unique per origin chain). */
  fillId: string;
  /** Across internal numeric id (used as stable React key). */
  acrossId: number;
  /** Origin chain id (e.g. 1 for Ethereum). */
  originChainId: number;
  /** Friendly origin chain label. */
  originChain: string;
  /** Friendly destination label — always "Base" for this demo. */
  destinationChain: string;
  /** Token symbol bridged (e.g. "USDC", "WETH"). */
  tokenSymbol: string;
  /** Output amount in token units. */
  amountToken: number;
  /** Output amount in USD (best-effort from Across's reported price). */
  amountUsd: number;
  /** Address that deposited on the origin chain. */
  depositor: string;
  /** Recipient on the destination chain. */
  recipient: string;
  /** True when recipient differs from depositor (i.e. user is sending to
   *  someone else, not bridging to themselves). Common but worth surfacing. */
  recipientDiffersFromDepositor: boolean;
  /** ISO timestamp the deposit was observed on the origin chain. */
  depositTimeIso: string;
  /** ISO timestamp the fill landed on Base. */
  fillTimeIso: string;
  /** Seconds between deposit and fill (Across SLA-ish metric). */
  fillLatencySec: number;
  /** Tx hash of the fill on Base. */
  fillTxHash: string;
  /** Tx hash of the deposit on the origin chain. */
  depositTxHash: string;
  /** Etherscan-equivalent URL for the fill on Base. */
  fillTxUrl: string;
  /** Synthesized BridgeState (validator-multisig framing) — see file header. */
  bridgeState: BridgeState;
  /** Short label used as scenarioLabel on the timeline row. */
  label: string;
}

function basescanUrl(txHash: string): string {
  return `https://basescan.org/tx/${txHash}`;
}

/** Map an Across deposit to our LiveBridgeFill + synthesized BridgeState. */
function mapDeposit(d: AcrossDepositRaw): LiveBridgeFill {
  const { symbol, decimals } = tokenInfo(d.outputToken);
  const amountToken = fmtAmount(d.outputAmount, decimals);
  const priceUsd = d.outputPriceUsd ? Number(d.outputPriceUsd) : 0;
  const amountUsd = amountToken * priceUsd;

  const depositTs = Date.parse(d.depositBlockTimestamp);
  const fillTs = Date.parse(d.fillBlockTimestamp);
  const fillLatencySec = Math.max(0, Math.round((fillTs - depositTs) / 1000));
  const ageSec = Math.max(1, Math.round((Date.now() - fillTs) / 1000));

  // Synthesize a BridgeState that matches Across's actual security posture:
  // an optimistic bridge with no validator quorum. We use a healthy 9/9
  // signing baseline (because the relayer did relay), zero rotation, zero
  // slashing, and a small withdraw rate. We scale withdrawRate1h by amount
  // so a $10M fill nudges the reading up slightly without forcing REFUSE.
  // attestationAgeSec gets the time since the fill landed; replay-claimed
  // is always false because real Across fills are unique by depositId.
  const withdrawBoost = Math.min(0.04, amountUsd / 1_000_000_000); // amount-as-fraction-of-1B
  const bridgeState: BridgeState = {
    ...HEALTHY_BRIDGE,
    sourceHeight: d.depositBlockNumber || HEALTHY_BRIDGE.sourceHeight,
    finalizedHeight:
      (d.depositBlockNumber || HEALTHY_BRIDGE.sourceHeight) - 12,
    attestationAgeSec: ageSec,
    attestationAlreadyClaimed: false,
    withdrawRate1h: Number((0.002 + withdrawBoost).toFixed(4)),
  };

  const recipientDiffersFromDepositor =
    d.recipient.toLowerCase() !== d.depositor.toLowerCase();

  const originChain = chainName(d.originChainId);
  const label = `Across · ${originChain} → Base · ${
    amountToken < 1
      ? amountToken.toFixed(4)
      : amountToken < 1000
        ? amountToken.toFixed(2)
        : amountToken.toFixed(0)
  } ${symbol}`;

  return {
    fillId: `${d.originChainId}:${d.depositId}`,
    acrossId: d.id,
    originChainId: d.originChainId,
    originChain,
    destinationChain: "Base",
    tokenSymbol: symbol,
    amountToken,
    amountUsd,
    depositor: d.depositor,
    recipient: d.recipient,
    recipientDiffersFromDepositor,
    depositTimeIso: d.depositBlockTimestamp,
    fillTimeIso: d.fillBlockTimestamp,
    fillLatencySec,
    fillTxHash: d.fillTx,
    depositTxHash: d.depositTxHash,
    fillTxUrl: basescanUrl(d.fillTx),
    bridgeState,
    label,
  };
}

/** Fetches the most recent N filled Across deposits whose destination is
 *  Base. Falls back to throwing on network / non-200; the caller renders
 *  the error inline in the demo. */
export async function fetchRecentBaseFills(
  limit: number = 10,
): Promise<LiveBridgeFill[]> {
  const url = `${ACROSS_API}?destinationChainId=${BASE_CHAIN_ID}&limit=${limit}&status=filled`;
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    next: { revalidate: 120 }, // 2 min server cache
  });
  if (!res.ok) {
    throw new Error(`across ${res.status}`);
  }
  const json = (await res.json()) as AcrossDepositRaw[];
  if (!Array.isArray(json)) {
    throw new Error("across: unexpected response shape");
  }
  // Keep only fills with a token we can label and a non-zero priced amount,
  // so each row has a meaningful USD figure to show.
  return json
    .map(mapDeposit)
    .filter((f) => f.tokenSymbol !== "UNKNOWN" && f.amountUsd > 0)
    .slice(0, limit);
}
