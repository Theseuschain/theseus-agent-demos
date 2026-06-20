import Link from "next/link";
import { demoMetadata } from "@/lib/demo-copy";

export const metadata = demoMetadata("guardian");

export default function GuardianLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark min-h-screen bg-[#070B16] text-white [color-scheme:dark]">
      <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#070B16]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/guardian" className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] shadow-[0_4px_16px_rgba(99,102,241,0.4)]">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l7 3v6c0 4-3 6.5-7 9-4-2.5-7-5-7-9V6z" />
              </svg>
            </span>
            <span className="text-[15px] font-semibold tracking-tight text-white">Guardian</span>
          </Link>
          <Link href="/" className="text-[13px] text-[#AAB2C5] transition-colors hover:text-white">
            All demos
          </Link>
        </div>
      </header>
      {children}
      <footer className="border-t border-white/[0.07]">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <p className="max-w-2xl text-[12px] leading-relaxed text-[#6B7488]">
            Guardian is an advisory review by a Theseus agent. It reads a pending action and gives a
            verdict; it does not execute or block anything. Always verify addresses out of band before
            signing. Nothing here is financial or security advice.
          </p>
        </div>
      </footer>
    </div>
  );
}
