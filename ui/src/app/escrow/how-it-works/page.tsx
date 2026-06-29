import Link from "next/link";
import { demoMetadata } from "@/lib/demo-copy";

export const metadata = demoMetadata("escrow");

const STEPS = [
  { h: "Lock the funds", p: "The buyer puts the money in the contract and says what they want done." },
  { h: "Deliver the work", p: "The seller hands in the work, plus any files." },
  { h: "Release or dispute", p: "If the buyer is happy, they release the money. If not, it goes to the agents." },
  { h: "The agents settle it", p: "One agent makes the call, a second checks it, and the contract pays whoever is right." },
];

const FAQ = [
  { q: "Who holds the money?", a: "The contract does. From the moment it is locked until it is released, it is out of everyone's reach, including ours. The agent only ever signals a verdict; it never holds the keys." },
  { q: "What if the agents can’t decide?", a: "Either one can return UNRESOLVABLE when the brief is too vague to score or the work can’t be verified. The buyer is refunded and a human steps in. The agent never guesses to look decisive." },
  { q: "Can a deliverable trick the agents?", a: "It would have to fool two different models the same way, and any disagreement holds the funds for a person. The brief is fixed before the work arrives, so the goalposts can’t move." },
  { q: "Why not Kleros or escrow.com?", a: "Two independent models read the actual work in seconds and write their verdicts on-chain for anyone to check. Kleros runs a multi-day vote among staked jurors; escrow.com charges 3.25% and rules out of sight." },
];

export default function HowEscrowWorks() {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-12 sm:px-6">
      <Link href="/escrow" className="text-[13px] text-[#7E8696] transition-colors hover:text-white">&larr; Back</Link>

      <h1 className="mt-4 font-sans text-[32px] font-bold tracking-[-0.02em] text-white sm:text-[42px]">How it works</h1>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[#AAB2C5]">
        Lock the money up front, and it only reaches the seller when the work is actually done. Here is the whole flow,
        and what happens when there is a disagreement.
      </p>

      <section className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2">
        {STEPS.map((s, i) => (
          <div key={s.h}>
            <div className="text-[13px] font-semibold text-[#4d8df0]">{i + 1}</div>
            <h2 className="mt-2 text-[15px] font-semibold text-white">{s.h}</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[#8A93A6]">{s.p}</p>
          </div>
        ))}
      </section>

      <section className="mt-14 border-t border-white/[0.08] pt-10">
        <h2 className="font-sans text-[21px] font-bold leading-tight tracking-[-0.02em] text-white sm:text-[26px]">When the two agents disagree, no one gets paid.</h2>
        <p className="mt-5 text-[16px] leading-[1.75] text-[#AAB2C5]">
          A buyer orders a French translation of their homepage. The seller turns it in. The first agent reads it, thinks
          it&rsquo;s good, and votes to{" "}
          <span className="font-semibold text-[#34D399]/70 line-through decoration-[#EF4444] decoration-2">pay the seller</span>.
          A second agent, which never saw that call, notices a line lifted straight from English instead of real French,
          and votes to{" "}
          <span className="font-semibold text-[#EF4444]">refund the buyer</span>. They don&rsquo;t agree, so{" "}
          <span className="font-semibold text-[#FBBF24]">the money stays put</span> and a person makes the call. With one
          agent, the seller would already have been paid.
        </p>
      </section>

      <section className="mt-14 border-t border-white/[0.08] pt-10">
        <h2 className="text-[13px] font-semibold text-[#9AA3B2]">Common questions</h2>
        <div className="mt-6 grid gap-x-10 gap-y-7 sm:grid-cols-2">
          {FAQ.map((f) => (
            <div key={f.q}>
              <h3 className="text-[14px] font-semibold text-white">{f.q}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[#8A93A6]">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-14 border-t border-white/[0.08] pt-10">
        <Link href="/escrow#create" className="rounded-md bg-[#4d8df0] px-5 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-[#5f9bf5]">
          Create a deal
        </Link>
      </div>
    </main>
  );
}
