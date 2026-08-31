export type AuditMode = "llm" | "fallback";

export interface AuditResponse {
  mode: AuditMode;
  report: string;
  model: string | null;
  reason: string | null;
}

export type AuditErrorCode =
  | "INVALID_URL"
  | "INVALID_SNAPSHOT"
  | "METHOD_NOT_ALLOWED"
  | "NETWORK_ERROR"
  | "BAD_RESPONSE"
  | "UNKNOWN";

export interface AuditError {
  code: AuditErrorCode;
  message: string;
}

export type AuditResult =
  | { ok: true; data: AuditResponse }
  | { ok: false; error: AuditError };

export type AuditState =
  | { status: "idle" }
  | { status: "generating" }
  | { status: "success"; data: AuditResponse }
  | { status: "error"; code: string; message: string };
