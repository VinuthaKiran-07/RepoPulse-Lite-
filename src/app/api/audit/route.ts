import { NextResponse } from "next/server";
import type { AnalyzeResponse } from "@/lib/api-types";
import { chatCompletion } from "@/lib/llm/client";
import { LlmError, toLlmError } from "@/lib/llm/errors";
import { buildFallbackReport } from "@/lib/llm/fallback-report";
import { AUDIT_TEMPERATURE, buildAuditMessages } from "@/lib/llm/prompt";
import { buildAuditSnapshot, validateAuditSnapshot } from "@/lib/llm/snapshot";
import { DEFAULT_LLM_BASE_URL, DEFAULT_LLM_MODEL } from "@/lib/settings";
import { validateGithubUrl } from "@/lib/github/url-validator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

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

  const bodyRecord =
    typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
  const rawRepoUrl = bodyRecord?.repoUrl;

  if (typeof rawRepoUrl !== "string" || rawRepoUrl === "") {
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

  const validation = validateGithubUrl(rawRepoUrl);
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

  const rawAnalysis = bodyRecord?.analysis;
  if (typeof rawAnalysis !== "object" || rawAnalysis === null) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_SNAPSHOT",
          message: "Request body must include an analysis object.",
        },
      },
      { status: 400 }
    );
  }

  let snapshot;
  try {
    snapshot = buildAuditSnapshot(rawAnalysis as AnalyzeResponse);
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_SNAPSHOT",
          message: "The analysis payload was unreadable.",
        },
      },
      { status: 400 }
    );
  }

  const snapshotValidation = validateAuditSnapshot(snapshot);
  if (!snapshotValidation.ok) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_SNAPSHOT",
          message: snapshotValidation.reason,
        },
      },
      { status: 400 }
    );
  }

  const runtimeLlm =
    typeof bodyRecord?.llm === "object" && bodyRecord.llm !== null
      ? (bodyRecord.llm as Record<string, unknown>)
      : null;
  const runtimeBaseUrl = toTrimmedString(runtimeLlm?.baseUrl);
  const runtimeModel = toTrimmedString(runtimeLlm?.model);
  const runtimeApiKey = toTrimmedString(runtimeLlm?.apiKey);

  const envBaseUrl = (process.env.LLM_BASE_URL ?? "").trim();
  const envModel = (process.env.LLM_MODEL ?? "").trim();
  const envApiKey = (process.env.LLM_API_KEY ?? "").trim();

  const baseUrl = runtimeBaseUrl.startsWith("https://")
    ? runtimeBaseUrl
    : envBaseUrl.startsWith("https://")
      ? envBaseUrl
      : DEFAULT_LLM_BASE_URL;
  const model = runtimeModel.length > 0 ? runtimeModel : envModel.length > 0 ? envModel : DEFAULT_LLM_MODEL;
  const apiKey = runtimeApiKey.length > 0 ? runtimeApiKey : envApiKey;

  if (apiKey === "") {
    return NextResponse.json({
      mode: "fallback",
      report: buildFallbackReport(snapshotValidation.snapshot),
      model: null,
      reason:
        "No LLM provider key configured. Add one in Settings to unlock the full narrative audit.",
    });
  }

  try {
    const report = await chatCompletion(
      { baseUrl, model, apiKey },
      buildAuditMessages(snapshotValidation.snapshot),
      { temperature: AUDIT_TEMPERATURE }
    );
    return NextResponse.json({
      mode: "llm",
      report,
      model,
      reason: null,
    });
  } catch (err) {
    const error = err instanceof LlmError ? err : toLlmError(err);
    console.error(
      "[audit]",
      JSON.stringify({
        code: error.code,
        status: error.status,
        internalDetail: error.internalDetail,
      })
    );
    return NextResponse.json({
      mode: "fallback",
      report: buildFallbackReport(snapshotValidation.snapshot),
      model: null,
      reason: error.safeMessage,
    });
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
