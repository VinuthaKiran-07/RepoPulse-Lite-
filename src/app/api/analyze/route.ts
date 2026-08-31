import { NextResponse } from "next/server";
import {
  fetchRepoTelemetry,
  computeAuthorStats,
} from "@/lib/github/client";
import { GithubError, toGithubError } from "@/lib/github/errors";
import { validateGithubUrl } from "@/lib/github/url-validator";
import { computeHealthScore } from "@/lib/scoring/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_URL",
          message: "Request body must be valid JSON.",
        },
      },
      { status: 400 }
    );
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as Record<string, unknown>).repoUrl !== "string" ||
      (body as Record<string, unknown>).repoUrl === ""
  ) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_URL",
          message: "Request body must include a repoUrl string.",
        },
      },
      { status: 400 }
    );
  }

  const parsedBody = body as { repoUrl: string; githubToken?: unknown };
  const validation = validateGithubUrl(parsedBody.repoUrl);
  if (!validation.ok) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_URL",
          message: validation.reason,
        },
      },
      { status: 400 }
    );
  }

  const rawToken = parsedBody.githubToken;
  const token =
    typeof rawToken === "string" && rawToken.trim().length > 0
      ? rawToken.trim()
      : undefined;

  try {
    const telemetry = await fetchRepoTelemetry(validation.owner, validation.repo, {
      token,
      maxCommits: 100,
    });

    const analysis = computeHealthScore(telemetry.commits);

    return NextResponse.json({
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
    });
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
      const retryAfterSeconds =
        error.retryAfterSeconds !== null ? error.retryAfterSeconds : 60;
      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: error.safeMessage,
            retryAfterSeconds,
          },
        },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
      );
    }

    if (error.code === "REPO_NOT_FOUND") {
      return NextResponse.json(
        {
          error: {
            code: "REPO_NOT_FOUND",
            message: error.safeMessage,
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.safeMessage,
        },
      },
      { status: 502 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "Use POST with a JSON body.",
      },
    },
    { status: 405 }
  );
}
