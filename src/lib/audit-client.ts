import type { AuditResult, AuditResponse, AuditErrorCode } from "@/lib/audit-types";

const NETWORK_FRIENDLY_MESSAGE =
  "Could not reach the server. Check your connection and try again.";

const KNOWN_CODES: ReadonlySet<string> = new Set([
  "INVALID_URL",
  "INVALID_SNAPSHOT",
  "METHOD_NOT_ALLOWED",
  "NETWORK_ERROR",
  "BAD_RESPONSE",
  "UNKNOWN",
]);

function toErrorCode(value: unknown): AuditErrorCode {
  if (typeof value === "string" && KNOWN_CODES.has(value)) {
    return value as AuditErrorCode;
  }
  return "UNKNOWN";
}

async function parseErrorPayload(response: Response): Promise<AuditResult> {
  let code: AuditErrorCode = "UNKNOWN";
  let message = "Something went wrong while generating the audit report.";

  try {
    const body = (await response.json()) as {
      error?: { code?: unknown; message?: unknown };
    };
    if (typeof body.error?.message === "string" && body.error.message.length > 0) {
      message = body.error.message;
    }
    code = toErrorCode(body.error?.code);
  } catch {
    return { ok: false, error: { code: "BAD_RESPONSE", message: NETWORK_FRIENDLY_MESSAGE } };
  }

  return { ok: false, error: { code, message } };
}

function isAuditResponse(value: unknown): value is AuditResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    (candidate.mode === "llm" || candidate.mode === "fallback") &&
    typeof candidate.report === "string" &&
    candidate.report.length > 0 &&
    (candidate.model === null || typeof candidate.model === "string") &&
    (candidate.reason === null || typeof candidate.reason === "string")
  );
}

export async function requestAudit(
  repoUrl: string,
  analysis: unknown,
  options?: {
    llm?: { baseUrl: string; model: string; apiKey: string };
    signal?: AbortSignal;
  }
): Promise<AuditResult> {
  let response: Response;
  try {
    response = await fetch("/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        repoUrl,
        analysis,
        ...(options?.llm ? { llm: options.llm } : {}),
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
    if (!isAuditResponse(data)) {
      return {
        ok: false,
        error: { code: "BAD_RESPONSE", message: "The server returned an unreadable response." },
      };
    }
    return { ok: true, data };
  } catch {
    return {
      ok: false,
      error: { code: "BAD_RESPONSE", message: "The server returned an unreadable response." },
    };
  }
}
