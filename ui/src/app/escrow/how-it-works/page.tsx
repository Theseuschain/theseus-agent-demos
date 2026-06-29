import Link from "next/link";
import { demoMetadata } from "@/lib/demo-copy";

export const metadata = demoMetadata("escrow");

const STEPS = [
  { h: "Lock the funds", p: "The buyer locks the money in the contract and writes what the seller must deliver." },
  { h: "Deliver the work", p: "The seller submits the work and any files." },
  { h: "Release or dispute", p: "If the buyer is satisfied, they release the money. If not, the AI agents decide." },
  { h: "The agents settle it", p: "One agent decides, a second agent checks that decision, and the contract pays whoever is right." },
];

const FAQ = [
  { q: "Who holds the money?", a: "The contract does. From the moment it is locked until it is released, no one can withdraw it, including us. The agent only records a decision; it never has access to the money." },
  { q: "What if the agents can’t decide?", a: "Either agent can return UNRESOLVABLE when the brief is too vague to evaluate or the work cannot be verified. The buyer is refunded and a person decides instead. The agent does not guess." },
  { q: "Can someone get a bad result approved?", a: "They would have to mislead two independent AI models in the same way. If the two disagree, the money is held for a person to decide. The brief is fixed before the work is submitted, so the requirements cannot change afterward." },
  { q: "Why not Kleros or escrow.com?", a: "Two independent AI models review the actual work in seconds and save their decisions for anyone to read. Kleros runs a multi-day vote among token holders. escrow.com charges 3.25% and decides privately." },
];

export default function HowEscrowWorks() {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-12 sm:px-6">
      <Link href="/escrow" className="text-[13px] text-[#7E8696] transition-colors hover:text-white">&larr; Back</Link>

      <h1 className="mt-4 font-sans text-[32px] font-bold tracking-[-0.02em] text-white sm:text-[42px]">How it works</h1>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[#AAB2C5]">
        The buyer locks the money up front, and the seller is only paid when the work is done. Here is the whole process,
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
          A buyer orders a French translation of their homepage. The seller submits it. The first agent reviews it, finds
          it acceptable, and decides to{" "}
          <span className="font-semibold text-[#34D399]/70 line-through decoration-[#EF4444] decoration-2">pay the seller</span>.
          A second agent, which never saw that decision, finds a line copied directly from English instead of written in
          French, and decides to{" "}
          <span className="font-semibold text-[#EF4444]">refund the buyer</span>. Because they disagree,{" "}
          <span className="font-semibold text-[#FBBF24]">the money is not released</span> and a person decides instead.
          With only one agent, the seller would already have been paid.
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
