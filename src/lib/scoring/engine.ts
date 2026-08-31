import type {
  BandInfo,
  ScoreInput,
  ScoreResult,
} from "@/lib/scoring/types";
import { tierDistribution } from "@/lib/scoring/tier-classifier";
import { computeHygiene } from "@/lib/scoring/hygiene";
import { computeChurn } from "@/lib/scoring/churn";
import { computeCadence } from "@/lib/scoring/cadence";
import { computeDiversity } from "@/lib/scoring/diversity";
import { computeAnomalies } from "@/lib/scoring/anomaly";

export const SCORE_WEIGHTS = {
  hygiene: 0.25,
  churn: 0.2,
  cadence: 0.2,
  diversity: 0.2,
} as const;

export const ANOMALY_PENALTY_CAP = 20;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function bandForScore(score: number): BandInfo {
  const clamped = clamp(score, 0, 100);
  if (clamped >= 80) {
    return { band: "excellent", label: "Excellent", color: "#22c55e" };
  }
  if (clamped >= 60) {
    return { band: "moderate", label: "Moderate", color: "#eab308" };
  }
  if (clamped >= 40) {
    return { band: "at_risk", label: "At Risk", color: "#f97316" };
  }
  return { band: "critical", label: "Critical", color: "#ef4444" };
}

export function computeHealthScore(commits: ScoreInput): ScoreResult {
  const hygiene = computeHygiene(commits);
  const churn = computeChurn(commits);
  const cadence = computeCadence(commits);
  const diversity = computeDiversity(commits);
  const anomaly = computeAnomalies(commits);

  const penalty = Math.min(anomaly.penalty, ANOMALY_PENALTY_CAP);
  const raw =
    SCORE_WEIGHTS.hygiene * hygiene.score +
    SCORE_WEIGHTS.churn * churn.score +
    SCORE_WEIGHTS.cadence * cadence.score +
    SCORE_WEIGHTS.diversity * diversity.score -
    penalty;

  const score = clamp(Math.round(raw), 0, 100);

  return {
    score,
    band: bandForScore(score),
    metrics: {
      hygiene,
      churn,
      cadence,
      diversity,
      anomaly,
    },
    tiers: tierDistribution(commits),
  };
}
