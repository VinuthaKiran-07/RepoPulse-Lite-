"use client";

import MarkdownReport from "@/components/MarkdownReport";

export interface AuditSectionProps {
  status: "idle" | "generating" | "success" | "error";
  report: string | null;
  mode: "llm" | "fallback" | null;
  model: string | null;
  reason: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  hasLlmKey: boolean;
  onGenerate: () => void;
}

export default function AuditSection({
  status,
  report,
  mode,
  model,
  reason,
  errorCode,
  errorMessage,
  hasLlmKey,
  onGenerate,
}: AuditSectionProps) {
  const generating = status === "generating";
  const label = generating
    ? "Generating…"
    : hasLlmKey
      ? "Generate LLM Executive Audit"
      : "Generate Audit (Heuristic-only)";

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
          Executive Audit
        </h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          AI-generated risk assessment with prioritized recommendations.
        </p>
        {!hasLlmKey && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            No provider key configured — the report will use deterministic
            heuristic-only mode.
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onGenerate}
        disabled={generating}
        aria-label="Generate executive audit"
        className="mt-4 w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300 sm:w-auto sm:self-start sm:px-8"
      >
        {label}
      </button>

      {status === "generating" && (
        <div role="status" aria-label="Generating audit report" className="mt-4 flex flex-col gap-3">
          <div className="h-3 w-3/4 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-3 w-full animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
        </div>
      )}

      {status === "error" && (
        <div
          role="alert"
          className="mt-4 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-500/40 dark:bg-red-950/40"
        >
          <p className="text-sm text-red-700 dark:text-red-400">
            {errorMessage ?? "The audit could not be generated."}
          </p>
          {errorCode !== null && (
            <span className="self-start rounded-md border border-red-200 bg-white px-2 py-0.5 font-mono text-[10px] text-red-700 dark:border-red-500/40 dark:bg-neutral-950 dark:text-red-400">
              {errorCode}
            </span>
          )}
          <div>
            <button
              type="button"
              onClick={onGenerate}
              aria-label="Retry audit generation"
              className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300 sm:w-auto sm:self-start sm:px-8"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {status === "success" && (
        <div className="mt-4">
          {mode === "fallback" && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/30 dark:bg-amber-900/30">
              <p className="text-sm text-amber-800 dark:text-amber-300">
                <strong className="font-semibold">Heuristic-only mode</strong>{" "}
                {reason ?? "No LLM provider key configured."}
              </p>
            </div>
          )}
          {mode === "llm" && (
            <div className="mb-4">
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-400">
                LLM Audit{model !== null ? ` · ${model}` : ""}
              </span>
            </div>
          )}
          {report !== null ? <MarkdownReport content={report} /> : null}
        </div>
      )}
    </section>
  );
}
