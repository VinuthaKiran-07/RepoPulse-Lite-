import type { RepoMeta, CommitDetail, AuthorStat } from "@/lib/github/types";
import type { BandInfo, MetricBreakdown, AnomalyFlag } from "@/lib/scoring/types";

export interface AnalyzeRateLimit {
  remaining: number;
  limit: number;
  resetEpochSeconds: number;
}

export interface AnalyzeResponse {
  repo: RepoMeta;
  commits: CommitDetail[];
  authors: AuthorStat[];
  fetchedAt: string;
  rateLimit: AnalyzeRateLimit | null;
  score: number;
  band: BandInfo;
  metrics: MetricBreakdown;
  tiers: { tier1: number; tier2: number; tier3: number };
  anomalies: AnomalyFlag[];
}

export type AnalyzeErrorCode =
  | "INVALID_URL"
  | "REPO_NOT_FOUND"
  | "RATE_LIMITED"
  | "METHOD_NOT_ALLOWED"
  | "UPSTREAM_ERROR"
  | "NETWORK_ERROR"
  | "BAD_RESPONSE"
  | "UNKNOWN";

export interface AnalyzeError {
  code: AnalyzeErrorCode;
  message: string;
  retryAfterSeconds?: number;
}

export type AnalyzeResult =
  | { ok: true; data: AnalyzeResponse }
  | { ok: false; error: AnalyzeError };

export interface RateLimitSnapshot {
  remaining: number;
  limit: number;
  resetEpochSeconds: number;
}
