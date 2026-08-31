"use client";

import type { AnalyzeResponse } from "@/lib/api-types";

function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

function formatDate(iso: string | null): string {
  if (iso === null) {
    return "—";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
      {children}
    </span>
  );
}

export default function RepoSummaryCard({ data }: { data: AnalyzeResponse }) {
  const { repo, commits, fetchedAt } = data;

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
          {repo.fullName}
        </h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {repo.description ?? "No description provided."}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Chip>⭐ {formatCount(repo.stars)} stars</Chip>
        <Chip>🍴 {formatCount(repo.forks)} forks</Chip>
        <Chip>🐞 {formatCount(repo.openIssues)} open issues</Chip>
        {repo.language !== null && <Chip>💻 {repo.language}</Chip>}
        <Chip>🌿 {repo.defaultBranch || "default branch"}</Chip>
        <Chip>🕒 Last push {formatDate(repo.pushedAt)}</Chip>
        <Chip>📦 {formatCount(commits.length)} commits analyzed</Chip>
      </div>

      <p className="mt-4 text-xs text-neutral-400 dark:text-neutral-500">
        Fetched {new Date(fetchedAt).toLocaleString("en-US")}
      </p>
    </section>
  );
}
