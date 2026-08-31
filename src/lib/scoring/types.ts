import type { CommitDetail } from "@/lib/github/types";

export type CommitTier = 1 | 2 | 3;

export interface TierClassification {
  sha: string;
  tier: CommitTier;
  linesChanged: number;
  filesChanged: number;
  isConventionalType: boolean;
}

export type ScoreBand = "excellent" | "moderate" | "at_risk" | "critical";

export interface BandInfo {
  band: ScoreBand;
  label: string;
  color: string;
}

export type AnomalyType =
  | "MASSIVE_REWRITE"
  | "HIGH_RISK_DELETION"
  | "TIER3_CLUSTER"
  | "SINGLE_OWNER_RISK";

export interface AnomalyFlag {
  type: AnomalyType;
  commitSha: string | null;
  magnitude: number;
  description: string;
}

export interface HygieneResult {
  score: number;
  conventionalShare: number;
  qualityMean: number;
}

export interface ChurnResult {
  score: number;
  additions: number;
  deletions: number;
  addRatio: number;
  fBloat: number;
  fRegen: number;
  fAtomic: number;
  avgCommitSize: number;
}

export interface CadenceResult {
  score: number;
  spanDays: number;
  commitsPerDay: number;
  fFreq: number;
  gapCv: number;
  fRegularity: number;
}

export interface DiversityResult {
  score: number;
  authorCount: number;
  entropy: number;
  normalizedEntropy: number;
  teamSizeTerm: number;
}

export interface AnomalyResult {
  penalty: number;
  flags: AnomalyFlag[];
}

export interface MetricBreakdown {
  hygiene: HygieneResult;
  churn: ChurnResult;
  cadence: CadenceResult;
  diversity: DiversityResult;
  anomaly: AnomalyResult;
}

export interface ScoreResult {
  score: number;
  band: BandInfo;
  metrics: MetricBreakdown;
  tiers: {
    tier1: number;
    tier2: number;
    tier3: number;
  };
}

export type ScoreInput = CommitDetail[];
