import type { AnalyzeResponse } from "@/lib/api-types";
import type { CommitDetail } from "@/lib/github/types";

export function fixtureCommit(overrides: Partial<CommitDetail> = {}): CommitDetail {
  return {
    sha: "abc123def4567890abcdef1234567890abcdef12",
    message: "feat: add user authentication flow",
    authorName: "Dev One",
    authorLogin: "dev1",
    authorEmail: "dev1@example.com",
    authorDate: "2026-01-15T10:00:00Z",
    filesChanged: 2,
    additions: 40,
    deletions: 10,
    ...overrides,
  };
}

export function fixtureAnalyzeResponse(): AnalyzeResponse {
  return {
    repo: {
      owner: "octocat",
      repo: "hello-world",
      fullName: "octocat/hello-world",
      description: "A sample repository",
      stars: 1200,
      forks: 80,
      openIssues: 4,
      language: "TypeScript",
      defaultBranch: "main",
      pushedAt: "2026-01-20T00:00:00Z",
      isPrivate: false,
    },
    commits: [fixtureCommit()],
    authors: [{ login: "dev1", name: "Dev One", commits: 1, additions: 40, deletions: 10 }],
    fetchedAt: "2026-01-21T12:00:00Z",
    rateLimit: { remaining: 58, limit: 60, resetEpochSeconds: 1769510400 },
    score: 72,
    band: { band: "moderate", label: "Moderate", color: "#eab308" },
    metrics: {
      hygiene: { score: 85, conventionalShare: 1, qualityMean: 1 },
      churn: {
        score: 70,
        additions: 40,
        deletions: 10,
        addRatio: 0.8,
        fBloat: 1,
        fRegen: 0.75,
        fAtomic: 1,
        avgCommitSize: 50,
      },
      cadence: { score: 65, spanDays: 1, commitsPerDay: 1, fFreq: 0.45, gapCv: 0, fRegularity: 1 },
      diversity: {
        score: 6,
        authorCount: 1,
        entropy: 0,
        normalizedEntropy: 0,
        teamSizeTerm: 0.2,
      },
      anomaly: { penalty: 0, flags: [] },
    },
    tiers: { tier1: 1, tier2: 0, tier3: 0 },
    anomalies: [],
  };
}
