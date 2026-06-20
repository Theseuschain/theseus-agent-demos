import { demoMetadata } from "@/lib/demo-copy";
import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import QuillDemo from "@/components/poa/QuillDemo";
import DemoCTA from "@/components/DemoCTA";

const POA_ID = "5PqW7xY4vK9bN2cR5tM8eA1dJ3fG6hL9oP4sZ7uX2wV5nQ";
const POA_URL = `https://theseus.network/poa/${POA_ID}`;

export const metadata = demoMetadata("quill");

export default function QuillPage() {
  return (
    <main className="min-h-screen bg-bg text-fg">
      <TopBar mode="mock" />
      <div className="poa-shell">
        <div className="mx-auto max-w-[640px] px-4 py-14 md:px-6">
          <div className="mb-10 flex items-baseline justify-between gap-4">
            <Link
              href="/"
              className="text-[11px] uppercase tracking-[0.18em] text-[var(--poa-ink-soft)] transition-colors hover:text-[var(--poa-ink)]"
            >
              ← directory
            </Link>
            <a
              href={POA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] uppercase tracking-[0.18em] text-[var(--poa-ink-soft)] transition-colors hover:text-[var(--poa-ink)]"
            >
              on chain ↗
            </a>
          </div>

          <p className="mb-14 text-[13.5px] leading-[1.7] text-[var(--poa-ink-soft)]">
            Quill is an AI co-author for legal drafting. Every passage is tagged
            with who wrote it, Quill or a human, so the record of authorship is
            checkable. Drop in a citation. Quill checks it against the real
            case-law record and flags anything made up, under Rule 11.
          </p>

          <QuillDemo />

          <DemoCTA />
        </div>
      </div>
    </main>
  );
}
