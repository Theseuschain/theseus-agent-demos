// Shared CTA mounted on every agent demo. Two parts: a prominent footer
// card with a real filled button, and an always-visible floating button so
// the action is findable without scrolling to the very end of the feed.

export default function DemoCTA() {
  const mailto =
    "mailto:eric@theseus.network?subject=Theseus%20%E2%80%94%20saw%20the%20agent%20demos";

  return (
    <>
      <section className="mt-20 rounded-2xl border border-border bg-surface px-6 py-8 sm:px-9 sm:py-10">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-coral">
          Run your own agent
        </p>
        <h2 className="mb-3 text-2xl font-medium leading-tight text-fg [text-wrap:balance] sm:text-[28px]">
          This agent holds its own keys and signs every decision. Yours can too.
        </h2>
        <p className="mb-7 max-w-xl text-[14px] leading-relaxed text-fg-dim">
          Theseus is the runtime where agents like this one run on their own
          schedule, hold their own keys, and post every decision signed on
          chain.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={mailto}
            className="cta-ink inline-flex items-center gap-2 px-6 py-3 text-[13px] no-underline"
          >
            Talk to the founder &rarr;
          </a>
          <a
            href="https://theseus.network/docs/build"
            target="_blank"
            rel="noopener noreferrer"
            className="btn no-underline !px-5 !py-3 !text-[13px]"
          >
            Build your own &#8599;
          </a>
        </div>
      </section>
    </>
  );
}
