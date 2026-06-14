// Shared "Try it" chrome so every agent demo's primary action — actually
// interacting with the agent — reads the same and is impossible to miss:
// a labeled card, real button chips for the presets, and a filled submit.
// Mirrors the market demos' ScenarioControls.

import type { ReactNode } from "react";

export function TryItHeader({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="rounded-md bg-coral px-2 py-1 font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-white">
        Try it
      </span>
      <span className="text-[13.5px] text-fg-dim">{children}</span>
    </div>
  );
}

export type TryItPreset = { label: string; onClick: () => void };

export function TryItForm({
  prompt,
  presets,
  presetLabel = "or try:",
  submitLabel,
  submitDisabled,
  onSubmit,
  children,
}: {
  prompt: ReactNode;
  presets: TryItPreset[];
  presetLabel?: string;
  submitLabel: string;
  submitDisabled?: boolean;
  onSubmit: () => void;
  children: ReactNode;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="rounded-xl border border-border bg-surface/60 p-4 sm:p-5"
    >
      <TryItHeader>{prompt}</TryItHeader>
      {children}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {presets.length > 0 && (
            <span className="text-[12px] text-fg-mute">{presetLabel}</span>
          )}
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={p.onClick}
              className="btn !px-3 !py-1.5 !text-[11.5px]"
            >
              {p.label}
            </button>
          ))}
        </div>
        <button
          type="submit"
          disabled={submitDisabled}
          className="cta-ink inline-flex items-center gap-2 px-5 py-2.5 text-[13px] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
