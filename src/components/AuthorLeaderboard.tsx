"use client";

import { useState } from "react";
import type { AuthorStat } from "@/lib/github/types";

interface AuthorLeaderboardProps {
  authors: AuthorStat[];
  totalCommits: number;
}

const MAX_ROWS = 5;

function avatarUrl(login: string): string {
  return `https://github.com/${encodeURIComponent(login)}.png?size=64`;
}

function isEmailLike(login: string): boolean {
  return login.includes("@");
}

export default function AuthorLeaderboard({ authors, totalCommits }: AuthorLeaderboardProps) {
  const [failedAvatars, setFailedAvatars] = useState<Record<string, boolean>>({});
  const top = authors.slice(0, MAX_ROWS);
  const remaining = authors.length - top.length;

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-50">
          Author Leaderboard
        </h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Commit share across the analysis window
        </p>
      </div>

      {top.length === 0 ? (
        <p className="mt-8 text-sm text-neutral-500 dark:text-neutral-400">No author data</p>
      ) : (
        <ol className="mt-4 flex flex-col gap-3">
          {top.map((author, index) => {
            const share = totalCommits > 0 ? (author.commits / totalCommits) * 100 : 0;
            const avatarFailed = failedAvatars[author.login] === true || isEmailLike(author.login);
            return (
              <li key={author.login} className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <span className="w-5 text-center text-xs font-semibold tabular-nums text-neutral-400 dark:text-neutral-500">
                    {index + 1}
                  </span>
                  {avatarFailed ? (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-xs font-bold uppercase text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
                      {author.login.slice(0, 2)}
                    </div>
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element -- remote github avatar with runtime fallback */
                    <img
                      src={avatarUrl(author.login)}
                      alt={`${author.login} avatar`}
                      loading="lazy"
                      className="h-9 w-9 shrink-0 rounded-full"
                      onError={() =>
                        setFailedAvatars((prev) => ({ ...prev, [author.login]: true }))
                      }
                    />)}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-xs font-medium text-neutral-900 dark:text-neutral-100">
                      {author.login}
                    </p>
                    <p className="truncate text-[11px] text-neutral-500 dark:text-neutral-400">
                      {author.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                      {author.commits} commit{author.commits === 1 ? "" : "s"}
                    </p>
                    <p className="text-[11px] tabular-nums text-neutral-500 dark:text-neutral-400">
                      {share.toFixed(1)}%
                    </p>
                  </div>
                </div>
                <div className="ml-8 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                  <div
                    className="h-full rounded-full bg-neutral-700 dark:bg-neutral-300"
                    style={{ width: `${Math.min(share, 100)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {remaining > 0 && (
        <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
          +{remaining} more author{remaining === 1 ? "" : "s"} in window
        </p>
      )}
    </section>
  );
}
