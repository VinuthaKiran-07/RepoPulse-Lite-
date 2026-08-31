"use client";

import {
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
} from "recharts";

interface ScoreGaugeProps {
  score: number;
  band: { label: string; color: string };
}

export default function ScoreGauge({ score, band }: ScoreGaugeProps) {
  const data = [{ name: "score", value: score, fill: band.color }];

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-50">
          Composite Health Score
        </h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          0–100 · weighted blend of hygiene, churn, cadence and diversity minus
          the anomaly penalty
        </p>
      </div>

      <div className="relative mt-2 h-56 w-full" role="img" aria-label={`Health score ${score} out of 100, ${band.label}`}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            data={data}
            innerRadius="66%"
            outerRadius="100%"
            startAngle={180}
            endAngle={0}
            barSize={22}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
            <RadialBar
              dataKey="value"
              angleAxisId={0}
              cornerRadius={10}
              background={{ fill: "rgba(120, 120, 128, 0.15)" }}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-end pb-8">
          <span className="text-5xl font-extrabold tabular-nums" style={{ color: band.color }}>
            {score}
          </span>
          <span className="text-sm font-semibold" style={{ color: band.color }}>
            {band.label}
          </span>
        </div>
      </div>
    </section>
  );
}
