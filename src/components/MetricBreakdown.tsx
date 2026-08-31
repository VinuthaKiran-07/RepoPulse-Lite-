"use client";

import type { MetricBreakdown as MetricBreakdownType } from "@/lib/scoring/types";

function scoreColor(score: number): string {
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#eab308";
  if (score >= 40) return "#f97316";
  return "#ef4444";
}

function fmt(value: number): string {
  return value.toFixed(1);
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function fmtCount(value: number): string {
  return value.toLocaleString("en-US");
}

interface MetricCardProps {
  title: string;
  weight: string;
  score: number;
  rows: Array<{ label: string; value: string }>;
}

function MetricCard({ title, weight, score, rows }: MetricCardProps) {
  const color = scoreColor(score);
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
          {title}
        </h3>
        <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-medium text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400">
          weight {weight}
        </span>
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-2xl font-bold tabular-nums" style={{ color }}>
          {fmt(score)}
        </span>
        <span className="text-xs text-neutral-400 dark:text-neutral-500">/ 100</span>
      </div>

      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(Math.max(score, 0), 100)}%`, backgroundColor: color }}
        />
      </div>

      <dl className="mt-3 flex flex-col gap-1.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-2">
            <dt className="text-xs text-neutral-500 dark:text-neutral-400">{row.label}</dt>
            <dd className="text-xs font-medium tabular-nums text-neutral-800 dark:text-neutral-200">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function MetricBreakdown({ metrics }: { metrics: MetricBreakdownType }) {
  const { hygiene, churn, cadence, diversity, anomaly } = metrics;
  const flagCount = anomaly.flags.length;

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-50">
          Metric Breakdown
        </h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Every sub-score is normalized 0–100 before being weighted into the
          composite
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MetricCard
          title="Commit Hygiene"
          weight="0.25"
          score={hygiene.score}
          rows={[
            { label: "Conventional commits", value: percent(hygiene.conventionalShare) },
            { label: "Message quality mean", value: fmt(hygiene.qualityMean * 100) },
          ]}
        />
        <MetricCard
          title="Code Churn Balance"
          weight="0.20"
          score={churn.score}
          rows={[
            { label: "Additions / deletions", value: `${fmtCount(churn.additions)} / ${fmtCount(churn.deletions)}` },
            { label: "Add ratio", value: percent(churn.addRatio) },
            { label: "Avg commit size", value: `${fmt(churn.avgCommitSize)} lines` },
          ]}
        />
        <MetricCard
          title="Cadence & Velocity"
          weight="0.20"
          score={cadence.score}
          rows={[
            { label: "Commits per day", value: fmt(cadence.commitsPerDay) },
            { label: "Window span", value: `${fmt(cadence.spanDays)} days` },
            { label: "Gap variability (CV)", value: fmt(cadence.gapCv) },
          ]}
        />
        <MetricCard
          title="Author Diversity"
          weight="0.20"
          score={diversity.score}
          rows={[
            { label: "Contributors", value: `${diversity.authorCount}` },
            { label: "Normalized entropy", value: percent(diversity.normalizedEntropy) },
          ]}
        />
      </div>

      <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-950/30">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-red-800 dark:text-red-300">
            Anomaly Penalty
          </h3>
          <span className="rounded-full border border-red-200 bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:border-red-500/40 dark:bg-red-900/50 dark:text-red-300">
            subtractive · cap 20
          </span>
        </div>
        <div className="mt-3 flex items-baseline justify-between">
          <span className="text-2xl font-bold tabular-nums text-red-700 dark:text-red-400">
            −{anomaly.penalty} pts
          </span>
          <span className="text-xs text-red-600/70 dark:text-red-400/80">
            {flagCount} flag{flagCount === 1 ? "" : "s"} detected
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-red-200/60 dark:bg-red-900/40">
          <div
            className="h-full rounded-full bg-red-500"
            style={{ width: `${Math.min((anomaly.penalty / 20) * 100, 100)}%` }}
          />
        </div>
      </div>
    </section>
  );
}
