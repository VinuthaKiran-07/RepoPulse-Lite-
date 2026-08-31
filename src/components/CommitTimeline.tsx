"use client";

import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CommitDetail } from "@/lib/github/types";

interface CommitTimelineProps {
  commits: CommitDetail[];
}

interface DayPoint {
  day: string;
  label: string;
  additions: number;
  deletions: number;
}

const TOOLTIP_STYLE = {
  backgroundColor: "#0a0a0a",
  border: "1px solid #262626",
  borderRadius: 8,
  color: "#ededed",
} as const;

const TOOLTIP_ITEM_STYLE = { color: "#ededed" } as const;
const TOOLTIP_LABEL_STYLE = { color: "#a3a3a3" } as const;

function dayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shortLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function CommitTimeline({ commits }: CommitTimelineProps) {
  const points = useMemo<DayPoint[]>(() => {
    const byDay = new Map<string, { date: Date; additions: number; deletions: number }>();
    for (const commit of commits) {
      const parsed = new Date(commit.authorDate);
      if (Number.isNaN(parsed.getTime())) {
        continue;
      }
      const key = dayKey(parsed);
      const existing = byDay.get(key);
      if (existing === undefined) {
        byDay.set(key, { date: parsed, additions: commit.additions, deletions: commit.deletions });
      } else {
        existing.additions += commit.additions;
        existing.deletions += commit.deletions;
      }
    }
    return Array.from(byDay.entries())
      .map(([day, value]) => ({
        day,
        label: shortLabel(value.date),
        additions: value.additions,
        deletions: value.deletions,
      }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }, [commits]);

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-50">
          Commit Activity Timeline
        </h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Daily additions vs deletions across the analysis window
        </p>
      </div>

      {points.length === 0 ? (
        <p className="mt-8 text-sm text-neutral-500 dark:text-neutral-400">
          No commits in window
        </p>
      ) : (
        <div className="mt-4 h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={points} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#737373" }}
                tickLine={false}
                axisLine={{ stroke: "#262626" }}
                minTickGap={24}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#737373" }}
                tickLine={false}
                axisLine={false}
                width={56}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                itemStyle={TOOLTIP_ITEM_STYLE}
                labelStyle={TOOLTIP_LABEL_STYLE}
              />
              <Area
                type="monotone"
                dataKey="additions"
                name="Additions"
                stroke="#22c55e"
                fill="#22c55e"
                fillOpacity={0.18}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="deletions"
                name="Deletions"
                stroke="#ef4444"
                fill="#ef4444"
                fillOpacity={0.14}
                strokeWidth={2}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
