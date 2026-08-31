"use client";

import AnalyzeForm from "@/components/AnalyzeForm";
import MetricBreakdown from "@/components/MetricBreakdown";
import RepoSummaryCard from "@/components/RepoSummaryCard";
import ScoreGauge from "@/components/ScoreGauge";
import { useAnalyze } from "@/lib/use-analyze";

function errorHeadline(code: string): string {
  switch (code) {
    case "INVALID_URL":
      return "That doesn't look like a public GitHub repository URL.";
    case "REPO_NOT_FOUND":
      return "Repository not found or private. Check the URL or make the repository public.";
    case "RATE_LIMITED":
      return "GitHub rate limit reached — add a token in the form or wait a few minutes.";
    default:
      return "Something went wrong while analyzing the repository. Please try again.";
  }
}

export default function Home() {
  const { state, analyze } = useAnalyze();
  const loading = state.status === "loading";

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 sm:text-4xl">
          RepoPulse Lite
        </h1>
        <p className="max-w-2xl text-sm text-neutral-600 dark:text-neutral-400 sm:text-base">
          Deterministic GitHub repository health scoring with an LLM executive
          audit. Paste any public repository URL to analyze its pulse.
        </p>
      </header>

      <AnalyzeForm onAnalyze={analyze} loading={loading} />

      {state.status === "error" && (
        <section
          role="alert"
          className="mt-6 rounded-2xl border border-red-300 bg-red-50 p-5 dark:border-red-500/40 dark:bg-red-950/40"
        >
          <h2 className="text-sm font-semibold text-red-800 dark:text-red-300">
            {errorHeadline(state.code)}
          </h2>
          <p className="mt-1 text-xs text-red-700 dark:text-red-400">{state.message}</p>
          {state.retryAfterSeconds !== undefined && (
            <p className="mt-2 text-xs text-red-700 dark:text-red-400">
              Rate limit resets in about {Math.ceil(state.retryAfterSeconds / 60)} min.
            </p>
          )}
        </section>
      )}

      {state.status === "success" && (
        <div className="mt-6 flex flex-col gap-6">
          <RepoSummaryCard data={state.data} />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <ScoreGauge score={state.data.score} band={state.data.band} />
            <div className="lg:col-span-2">
              <MetricBreakdown metrics={state.data.metrics} />
            </div>
          </div>

          {/* TODO(phase-3.3): commit timeline, tier donut, author leaderboard */}
        </div>
      )}
    </main>
  );
}
