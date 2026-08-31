import type { LlmErrorCode } from "@/lib/llm/types";

export class LlmError extends Error {
  readonly code: LlmErrorCode;
  readonly status: number;
  readonly retryAfterSeconds: number | null;
  readonly safeMessage: string;
  readonly internalDetail: string;
  readonly cause?: unknown;

  constructor(params: {
    code: LlmErrorCode;
    status: number;
    safeMessage: string;
    internalDetail?: string;
    retryAfterSeconds?: number | null;
    cause?: unknown;
  }) {
    super(params.safeMessage);
    this.name = "LlmError";
    this.code = params.code;
    this.status = params.status;
    this.retryAfterSeconds = params.retryAfterSeconds ?? null;
    this.safeMessage = params.safeMessage;
    this.internalDetail = params.internalDetail ?? "";
    this.cause = params.cause;
  }
}

export function toLlmError(unknown: unknown): LlmError {
  if (unknown instanceof LlmError) {
    return unknown;
  }

  if (unknown instanceof TypeError) {
    return new LlmError({
      code: "LLM_NETWORK_ERROR",
      status: 502,
      safeMessage: "Unable to reach the LLM provider. Please try again shortly.",
      internalDetail: `Network failure: ${unknown.message}`,
      cause: unknown,
    });
  }

  if (unknown instanceof SyntaxError) {
    return new LlmError({
      code: "LLM_BAD_RESPONSE",
      status: 502,
      safeMessage: "The LLM provider returned an unreadable response.",
      internalDetail: `JSON parse failure: ${unknown.message}`,
      cause: unknown,
    });
  }

  if (unknown instanceof Error) {
    return new LlmError({
      code: "LLM_UPSTREAM_ERROR",
      status: 502,
      safeMessage:
        "An unexpected error occurred while contacting the LLM provider.",
      internalDetail: `${unknown.name}: ${unknown.message}`,
      cause: unknown,
    });
  }

  return new LlmError({
    code: "LLM_UPSTREAM_ERROR",
    status: 502,
    safeMessage:
      "An unexpected error occurred while contacting the LLM provider.",
    internalDetail: `Non-error thrown: ${String(unknown)}`,
  });
}
