import { demoMetadata } from "@/lib/demo-copy";
import PredictNav from "@/components/predict/PredictNav";
import SessionWrap from "@/components/predict/SessionWrap";

export const metadata = demoMetadata("predict");

export default function PredictLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionWrap>
      <div className="dark min-h-screen bg-bg text-fg [color-scheme:dark]">
        <PredictNav />
        {children}
        <footer className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-6 text-[12px] leading-relaxed text-fg-mute sm:px-5">
            <p>
              Theseus Predict is a testnet demo. Balances are play-money USDC with no
              cash value. Markets are created and settled by{" "}
              <a
                href="https://explorer.theseus.network/agents/5DCSpFkHzKd6G9LZ5ytjKLyPiUMYrofxpkEjuhNXTreRDfwq"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-border underline-offset-2 hover:text-fg"
              >
                Theseus agents
              </a>
              , which read the public record rather than a token vote. The price-history
              charts are illustrative. Nothing here is financial advice or an offer to trade.
            </p>
            <p className="mt-3 text-fg-dim">
              Built on{" "}
              <a href="https://theseus.network" target="_blank" rel="noopener noreferrer" className="text-fg underline decoration-border underline-offset-2 hover:text-coral">
                Theseus
              </a>
              , the L1 for sovereign AI agents, in collaboration with the Theseus team.
            </p>
          </div>
        </footer>
      </div>
    </SessionWrap>
  );
}
