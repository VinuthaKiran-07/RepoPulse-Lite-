"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

interface TierDonutProps {
  tiers: { tier1: number; tier2: number; tier3: number };
}

const TOOLTIP_STYLE = {
  backgroundColor: "#0a0a0a",
  border: "1px solid #262626",
  borderRadius: 8,
  color: "#ededed",
} as const;

const TOOLTIP_ITEM_STYLE = { color: "#ededed" } as const;

interface TierSlice {
  name: string;
  value: number;
  fill: string;
  description: string;
}

export default function TierDonut({ tiers }: TierDonutProps) {
  const slices: TierSlice[] = [
    {
      name: "Tier 1 · Routine",
      value: tiers.tier1,
      fill: "#22c55e",
      description: "small or docs/chore commits",
    },
    {
      name: "Tier 2 · Moderate",
      value: tiers.tier2,
      fill: "#eab308",
      description: "50–250 lines, under 5 files",
    },
    {
      name: "Tier 3 · High-risk",
      value: tiers.tier3,
      fill: "#ef4444",
      description: "250+ lines or 5+ files",
    },
  ];

  const total = tiers.tier1 + tiers.tier2 + tiers.tier3;

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-50">
          Commit Risk Tiers
        </h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Classified by lines changed and files touched per commit
        </p>
      </div>

      {total === 0 ? (
        <p className="mt-8 text-sm text-neutral-500 dark:text-neutral-400">
          No commits in window
        </p>
      ) : (
        <>
          <div className="relative mt-4 h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  itemStyle={TOOLTIP_ITEM_STYLE}
                />
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="58%"
                  outerRadius="82%"
                  paddingAngle={2}
                  cornerRadius={4}
                  strokeWidth={0}
                >
                  {slices.map((slice) => (
                    <Cell key={slice.name} fill={slice.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-extrabold tabular-nums text-neutral-900 dark:text-neutral-50">
                {total}
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                commits
              </span>
            </div>
          </div>

          <ul className="mt-4 flex flex-col gap-2">
            {slices.map((slice) => (
              <li
                key={slice.name}
                className="flex items-center justify-between gap-2 rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-800/50"
              >
                <span className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: slice.fill }}
                    aria-hidden
                  />
                  <span className="text-xs font-medium text-neutral-800 dark:text-neutral-200">
                    {slice.name}
                  </span>
                </span>
                <span className="text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
                  {slice.value} · {Math.round((slice.value / total) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
