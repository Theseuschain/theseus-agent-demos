/**
 * Curated prediction-market questions for the prediction market
 * adjudicator demo.
 *
 * Mirrors the input shape of the resolver_oracle.ship agent in
 * github.com/Theseuschain/the-prediction-market: multi-option markets
 * with explicit options, resolution criteria, and a verification
 * source. The agent gathers its own evidence at runtime by calling
 * Anthropic's web_search tool, the same way the on-chain SHIP agent
 * calls web_search / fetch_url / get_price.
 */

export interface Citation {
  url: string;
  title: string;
}

export interface PredictionMarket {
  id: string;
  /** Numeric market_id matching the resolver_oracle's expected input. */
  marketId: number;
  /** Optional Polymarket-style category, just for the UI. */
  category: string;
  /** The market question. */
  question: string;
  /** The options the agent picks among (0-indexed). */
  options: string[];
  /** Hard deadline for resolution (human-readable, shown in UI). */
  deadline: string;
  /** Parseable ISO form of the deadline. Used for programmatic
   *  "is the deadline in the future?" checks. End-of-day in UTC. */
  deadlineISO: string;
  /** Plain-English description of how the market should be resolved. */
  resolutionCriteria: string;
  /** Where the agent should look for ground truth (drives search
   *  strategy: which sources to prioritize). */
  resolutionSource: string;
  /** What the actual market resolved to (if known). The
   *  `winningOption` is the 0-based index into `options`. */
  actualResolution?: {
    winningOption: number;
    note: string;
  };
  /** For genuinely contested markets that should resolve to UNRESOLVABLE:
   *  context on the real-world dispute, shown alongside the verdict. */
  outcomeNote?: string;
}

export const MARKETS: PredictionMarket[] = [
  // Criterion discipline on a well-defined, public metric. "Flop" is the
  // on-record verdict of the review press, with a clear majority threshold,
  // not the mood. The agent has to read the verdict off the sources and
  // resolve only if there is a real majority either way.
  {
    id: "iphone-air-flop",
    marketId: 1003,
    category: "Culture",
    question: "Will the iPhone Air launch flop?",
    options: ["YES (flopped)", "NO (did not flop)"],
    deadline: "December 31, 2025",
    deadlineISO: "2025-12-31",
    resolutionCriteria:
      "'Flop' is judged by the on-record verdict of the professional review press within 90 days of launch. Resolves YES if a clear majority of major outlets (The Verge, WSJ, CNET, Engadget, Tom's Guide, and peers) conclude the product underperformed or recommend against it. Resolves NO if a clear majority are positive. Sales rumors, resale prices, and social-media noise are signals but do not settle it. If the published reviews are genuinely split with no clear majority either way, the market does not resolve.",
    resolutionSource: "Professional product reviews from major outlets",
  },
  // Clean commit, YES: criteria clearly met, primary sources name the outcome.
  {
    id: "openai-gpt5-2025",
    marketId: 1001,
    category: "Tech",
    question: "Will OpenAI release a model named GPT-5 by end of 2025?",
    options: ["YES (released)", "NO (not released)"],
    deadline: "December 31, 2025",
    deadlineISO: "2025-12-31",
    resolutionCriteria:
      "A model with the official public name 'GPT-5' must be released by December 31, 2025. Internal codenames don't count. Research previews don't count unless the public-facing name is GPT-5. Release means publicly available to API or ChatGPT users, not just announced.",
    resolutionSource: "OpenAI announcements and the OpenAI API model registry",
    actualResolution: {
      winningOption: 0,
      note: "Polymarket resolved YES on Aug 7, 2025.",
    },
  },
  // The refuse showcase. Well-defined criterion, but the authority the market
  // names (the NBER) hasn't ruled and won't for a year or more. No public
  // source can settle it, so the disciplined verdict is UNRESOLVABLE.
  {
    id: "us-recession-2025",
    marketId: 1008,
    category: "Economy",
    question: "Did the US enter a recession in 2025?",
    options: ["YES (recession began in 2025)", "NO (no recession in 2025)"],
    deadline: "December 31, 2025",
    deadlineISO: "2025-12-31",
    resolutionCriteria:
      "The National Bureau of Economic Research (NBER) is the official arbiter of US recessions. Resolves YES only if the NBER has dated a recession with a peak (start) month in calendar year 2025. Resolves NO only if the NBER has explicitly stated that no recession began in 2025. Two-quarters-of-negative-GDP rules of thumb, bank forecasts, and media calls do not settle it; only an NBER determination does.",
    resolutionSource: "The NBER Business Cycle Dating Committee",
    outcomeNote:
      "The NBER dates recessions only in hindsight, typically six to eighteen months after the fact, and rarely issues a 'no recession' statement at all. With no NBER determination either way, no source can settle the criterion. A resolver that commits here is substituting its own GDP read for the arbiter the market named. UNRESOLVABLE is the honest call until the committee rules.",
  },
  // Premature: deadline still ahead. The agent refuses to forecast; the UI
  // declines to run it at all.
  {
    id: "spacex-mars-2029",
    marketId: 1007,
    category: "Science",
    question: "Will SpaceX land humans on Mars before 2030?",
    options: ["YES (landed)", "NO (did not)"],
    deadline: "December 31, 2029",
    deadlineISO: "2029-12-31",
    resolutionCriteria:
      "Resolves YES if a SpaceX vehicle lands at least one living human on the surface of Mars before January 1, 2030, confirmed by SpaceX and independent tracking. An uncrewed landing does not count, and a crewed launch that has not yet landed does not count.",
    resolutionSource: "SpaceX announcements and independent spaceflight tracking",
  },
];

export function findMarket(id: string): PredictionMarket | undefined {
  return MARKETS.find((m) => m.id === id);
}
