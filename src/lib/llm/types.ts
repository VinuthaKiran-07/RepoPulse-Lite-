export type LlmErrorCode =
  | "LLM_NOT_CONFIGURED"
  | "LLM_TIMEOUT"
  | "LLM_NETWORK_ERROR"
  | "LLM_UPSTREAM_ERROR"
  | "LLM_BAD_RESPONSE"
  | "LLM_EMPTY_CONTENT";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
}

export interface AuditSnapshot {
  repoFullName: string;
  commitCount: number;
  windowDays: number;
  score: number;
  bandLabel: string;
  subScores: {
    hygiene: number;
    churn: number;
    cadence: number;
    diversity: number;
  };
  anomalyPenalty: number;
  tierCounts: { tier1: number; tier2: number; tier3: number };
  anomalies: Array<{
    type: string;
    commitSha: string | null;
    magnitude: number;
    description: string;
  }>;
  authorCount: number;
  topAuthors: Array<{ name: string; commits: number }>;
  hygieneDetail: { conventionalShare: number; qualityMean: number };
  churnDetail: {
    additions: number;
    deletions: number;
    avgCommitSize: number;
  };
  cadenceDetail: { commitsPerDay: number; gapCv: number };
  diversityDetail: { entropy: number; normalizedEntropy: number };
}

export type AuditReportResult =
  | { mode: "llm"; report: string; model: string }
  | { mode: "fallback"; reason: string };
