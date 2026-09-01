import { NextResponse } from "next/server";
import { runAnalysis } from "@/lib/analysis";

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
  const rawToken = parsedBody.githubToken;
  const githubToken =
    typeof rawToken === "string" && rawToken.trim().length > 0
      ? rawToken.trim()
      : undefined;

  const outcome = await runAnalysis({ repoUrl: parsedBody.repoUrl, githubToken });

  if (outcome.ok) {
    return NextResponse.json(outcome.data);
  }

  const { error } = outcome;

  if (error.code === "RATE_LIMITED") {
    const retryAfterSeconds = error.retryAfterSeconds ?? 60;
    return NextResponse.json(
      {
        error: {
          code: "RATE_LIMITED",
          message: error.message,
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
          message: error.message,
        },
      },
      { status: 404 }
    );
  }

  return NextResponse.json(
    {
      error: {
        code: error.code,
        message: error.message,
      },
    },
    { status: 502 }
  );
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
