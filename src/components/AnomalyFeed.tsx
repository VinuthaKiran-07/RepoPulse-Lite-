"use client";

import type { AnomalyFlag } from "@/lib/scoring/types";

interface AnomalyFeedProps {
  flags: AnomalyFlag[];
}

const FLAG_META: Record<
  AnomalyFlag["type"],
  { label: string; icon: string; color: string; hint: string }
> = {
  MASSIVE_REWRITE: {
    label: "Massive rewrite",
    icon: "💥",
    color: "#ef4444",
    hint: "1,000+ lines changed in a single commit",
  },
  HIGH_RISK_DELETION: {
    label: "High-risk deletion",
    icon: "🔥",
    color: "#f97316",
    hint: "500+ lines deleted in a single commit",
  },
  TIER3_CLUSTER: {
    label: "Tier-3 cluster",
    icon: "⚠️",
    color: "#eab308",
    hint: "high-risk commits dominate the window",
  },
  SINGLE_OWNER_RISK: {
    label: "Single owner",
    icon: "👤",
    color: "#eab308",
    hint: "one contributor owns the whole window (bus factor)",
  },
};

export default function AnomalyFeed({ flags }: AnomalyFeedProps) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-50">
          Anomaly Feed
        </h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Structural risk events detected in the window — these directly reduce
          the composite score
        </p>
      </div>

      {flags.length === 0 ? (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 dark:border-green-500/30 dark:bg-green-950/30">
          <span aria-hidden>✅</span>
          <p className="text-sm text-green-700 dark:text-green-400">
            No anomalies detected — the window looks structurally clean.
          </p>
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-2" role="list">
          {flags.map((flag, index) => {
            const meta = FLAG_META[flag.type];
            return (
              <li
                key={`${flag.type}-${flag.commitSha ?? "window"}-${index}`}
                className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-800/50"
              >
                <span className="mt-0.5 text-lg leading-none" aria-hidden>
                  {meta.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p
                      className="text-sm font-semibold"
                      style={{ color: meta.color }}
                    >
                      {meta.label}
                    </p>
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                      {meta.hint}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-300">
                    {flag.description}
                  </p>
                  {flag.commitSha !== null && (
                    <a
                      href={`https://github.com/search?q=sha:${flag.commitSha}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block font-mono text-[11px] text-neutral-500 underline-offset-2 hover:text-neutral-800 hover:underline dark:text-neutral-400 dark:hover:text-neutral-200"
                    >
                      {flag.commitSha.slice(0, 10)}…
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
