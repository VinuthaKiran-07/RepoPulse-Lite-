export type GithubErrorCode =
  | "REPO_NOT_FOUND"
  | "RATE_LIMITED"
  | "UPSTREAM_ERROR"
  | "NETWORK_ERROR"
  | "BAD_RESPONSE";

export class GithubError extends Error {
  readonly code: GithubErrorCode;
  readonly status: number;
  readonly retryAfterSeconds: number | null;
  readonly safeMessage: string;
  readonly internalDetail: string;
  readonly cause?: unknown;

  constructor(params: {
    code: GithubErrorCode;
    status: number;
    safeMessage: string;
    internalDetail?: string;
    retryAfterSeconds?: number | null;
    cause?: unknown;
  }) {
    super(params.safeMessage);
    this.name = "GithubError";
    this.code = params.code;
    this.status = params.status;
    this.retryAfterSeconds = params.retryAfterSeconds ?? null;
    this.safeMessage = params.safeMessage;
    this.internalDetail = params.internalDetail ?? "";
    this.cause = params.cause;
  }
}

export function toGithubError(unknown: unknown): GithubError {
  if (unknown instanceof GithubError) {
    return unknown;
  }

  if (unknown instanceof TypeError) {
    return new GithubError({
      code: "NETWORK_ERROR",
      status: 502,
      safeMessage: "Unable to reach GitHub. Please try again shortly.",
      internalDetail: `Network failure: ${unknown.message}`,
      cause: unknown,
    });
  }

  if (unknown instanceof SyntaxError) {
    return new GithubError({
      code: "BAD_RESPONSE",
      status: 502,
      safeMessage: "GitHub returned an unreadable response. Please try again shortly.",
      internalDetail: `JSON parse failure: ${unknown.message}`,
      cause: unknown,
    });
  }

  if (unknown instanceof Error) {
    return new GithubError({
      code: "UPSTREAM_ERROR",
      status: 502,
      safeMessage: "An unexpected error occurred while fetching data from GitHub.",
      internalDetail: `${unknown.name}: ${unknown.message}`,
      cause: unknown,
    });
  }

  return new GithubError({
    code: "UPSTREAM_ERROR",
    status: 502,
    safeMessage: "An unexpected error occurred while fetching data from GitHub.",
    internalDetail: `Non-error thrown: ${String(unknown)}`,
  });
}
