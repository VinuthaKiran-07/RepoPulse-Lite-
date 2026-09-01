import { fetchRepoTelemetry, computeAuthorStats } from "@/lib/github/client";
import { GithubError, toGithubError } from "@/lib/github/errors";
import { validateGithubUrl } from "@/lib/github/url-validator";
import { computeHealthScore } from "@/lib/scoring/engine";
import type { AnalyzeResponse } from "@/lib/api-types";

export type AnalyzeInput = {
  repoUrl: string;
  githubToken?: string;
};

export type AnalyzeErrorCode =
  | "INVALID_URL"
  | "REPO_NOT_FOUND"
  | "RATE_LIMITED"
  | "UPSTREAM_ERROR"
  | "NETWORK_ERROR"
  | "BAD_RESPONSE"
  | "UNKNOWN";

export type AnalyzeError = {
  code: AnalyzeErrorCode;
  message: string;
  retryAfterSeconds?: number;
};

export type AnalyzeOutcome =
  | { ok: true; data: AnalyzeResponse }
  | { ok: false; error: AnalyzeError };

export async function runAnalysis(input: AnalyzeInput): Promise<AnalyzeOutcome> {
  const validation = validateGithubUrl(input.repoUrl);
  if (!validation.ok) {
    return {
      ok: false,
      error: { code: "INVALID_URL", message: validation.reason },
    };
  }

  const token =
    typeof input.githubToken === "string" && input.githubToken.trim().length > 0
      ? input.githubToken.trim()
      : undefined;

  try {
    const telemetry = await fetchRepoTelemetry(validation.owner, validation.repo, {
      token,
      maxCommits: 100,
    });

    const analysis = computeHealthScore(telemetry.commits);

    const data: AnalyzeResponse = {
      repo: telemetry.meta,
      commits: telemetry.commits,
      authors: computeAuthorStats(telemetry.commits),
      fetchedAt: telemetry.fetchedAt,
      rateLimit: telemetry.rateLimit,
      score: analysis.score,
      band: analysis.band,
      metrics: analysis.metrics,
      tiers: analysis.tiers,
      anomalies: analysis.metrics.anomaly.flags,
    };

    return { ok: true, data };
  } catch (err) {
    const error = err instanceof GithubError ? err : toGithubError(err);
    console.error(
      "[analyze]",
      JSON.stringify({
        code: error.code,
        status: error.status,
        internalDetail: error.internalDetail,
      })
    );

    if (error.code === "RATE_LIMITED") {
      return {
        ok: false,
        error: {
          code: "RATE_LIMITED",
          message: error.safeMessage,
          retryAfterSeconds:
            error.retryAfterSeconds !== null ? error.retryAfterSeconds : 60,
        },
      };
    }

    return {
      ok: false,
      error: { code: error.code, message: error.safeMessage },
    };
  }
}
