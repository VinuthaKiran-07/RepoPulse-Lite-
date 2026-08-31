"use client";

import { useCallback, useState } from "react";
import AnalyzeForm from "@/components/AnalyzeForm";
import AnomalyFeed from "@/components/AnomalyFeed";
import AuthorLeaderboard from "@/components/AuthorLeaderboard";
import CommitTimeline from "@/components/CommitTimeline";
import DashboardSkeleton from "@/components/DashboardSkeleton";
import ErrorBanner from "@/components/ErrorBanner";
import MetricBreakdown from "@/components/MetricBreakdown";
import RepoSummaryCard from "@/components/RepoSummaryCard";
import ScoreGauge from "@/components/ScoreGauge";
import TierDonut from "@/components/TierDonut";
import { useAnalyze } from "@/lib/use-analyze";

export default function Home() {
  const { state, analyze } = useAnalyze();
  const loading = state.status === "loading";
  const [dismissedError, setDismissedError] = useState(false);

  const handleAnalyze = useCallback(
    (repoUrl: string, token?: string) => {
      setDismissedError(false);
      analyze(repoUrl, token);
    },
    [analyze]
  );

  const showError =
    state.status === "error" && !dismissedError;

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

      <AnalyzeForm onAnalyze={handleAnalyze} loading={loading} />

      {loading && (
        <div className="mt-6">
          <DashboardSkeleton />
        </div>
      )}

      {showError && (
        <div className="mt-6">
          <ErrorBanner
            code={state.code}
            message={state.message}
            repoUrl={state.repoUrl}
            retryAfterSeconds={state.retryAfterSeconds}
            onRetry={() => {
              setDismissedError(false);
              analyze(state.repoUrl);
            }}
            onDismiss={() => setDismissedError(true)}
          />
        </div>
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

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <CommitTimeline commits={state.data.commits} />
            </div>
            <TierDonut tiers={state.data.tiers} />
          </div>

          <AuthorLeaderboard
            authors={state.data.authors}
            totalCommits={state.data.commits.length}
          />

          <AnomalyFeed flags={state.data.anomalies} />
        </div>
      )}
    </main>
  );
}
