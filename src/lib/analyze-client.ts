import type { AnalyzeResult, AnalyzeResponse, AnalyzeErrorCode } from "@/lib/api-types";

const NETWORK_FRIENDLY_MESSAGE =
  "Could not reach the server. Check your connection and try again.";

const KNOWN_CODES: ReadonlySet<string> = new Set([
  "INVALID_URL",
  "REPO_NOT_FOUND",
  "RATE_LIMITED",
  "METHOD_NOT_ALLOWED",
  "UPSTREAM_ERROR",
  "NETWORK_ERROR",
  "BAD_RESPONSE",
]);

function toErrorCode(value: unknown): AnalyzeErrorCode {
  if (typeof value === "string" && KNOWN_CODES.has(value)) {
    return value as AnalyzeErrorCode;
  }
  return "UNKNOWN";
}

function toRetrySeconds(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.ceil(value);
  }
  return undefined;
}

async function parseErrorPayload(response: Response): Promise<AnalyzeResult> {
  let code: AnalyzeErrorCode = "UNKNOWN";
  let message = "Something went wrong while analyzing the repository.";
  let retryAfterSeconds: number | undefined;

  try {
    const body = (await response.json()) as {
      error?: { code?: unknown; message?: unknown; retryAfterSeconds?: unknown };
    };
    if (typeof body.error?.message === "string" && body.error.message.length > 0) {
      message = body.error.message;
    }
    code = toErrorCode(body.error?.code);
    retryAfterSeconds = toRetrySeconds(body.error?.retryAfterSeconds);
  } catch {
    return { ok: false, error: { code: "BAD_RESPONSE", message: NETWORK_FRIENDLY_MESSAGE } };
  }

  return { ok: false, error: { code, message, retryAfterSeconds } };
}

export async function analyzeRepo(
  repoUrl: string,
  options?: { githubToken?: string; signal?: AbortSignal }
): Promise<AnalyzeResult> {
  let response: Response;
  try {
    response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        repoUrl,
        ...(options?.githubToken ? { githubToken: options.githubToken } : {}),
      }),
      signal: options?.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw err;
    }
    return {
      ok: false,
      error: { code: "NETWORK_ERROR", message: NETWORK_FRIENDLY_MESSAGE },
    };
  }

  if (!response.ok) {
    return parseErrorPayload(response);
  }

  try {
    const data = (await response.json()) as unknown;
    if (
      typeof data !== "object" ||
      data === null ||
      typeof (data as Record<string, unknown>).score !== "number"
    ) {
      return {
        ok: false,
        error: { code: "BAD_RESPONSE", message: "The server returned an unreadable response." },
      };
    }
    return { ok: true, data: data as AnalyzeResponse };
  } catch {
    return {
      ok: false,
      error: { code: "BAD_RESPONSE", message: "The server returned an unreadable response." },
    };
  }
}
