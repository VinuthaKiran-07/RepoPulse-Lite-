"use client";

interface ErrorBannerProps {
  code: string;
  message: string;
  repoUrl?: string;
  retryAfterSeconds?: number;
  onRetry: () => void;
  onDismiss: () => void;
}

function headline(code: string): { title: string; hint?: string } {
  switch (code) {
    case "INVALID_URL":
      return {
        title: "That doesn't look like a public GitHub repository URL.",
        hint: "Expected format: https://github.com/{owner}/{repo}",
      };
    case "REPO_NOT_FOUND":
      return {
        title: "Repository not found or private.",
        hint: "Double-check the spelling, or make sure the repository is public.",
      };
    case "RATE_LIMITED":
      return {
        title: "GitHub API rate limit reached.",
        hint: "Add a personal access token in the form above for 5,000 req/h, or wait for the limit to reset.",
      };
    case "NETWORK_ERROR":
      return {
        title: "Could not reach the server.",
        hint: "Check your connection and try again.",
      };
    default:
      return {
        title: "Something went wrong while analyzing the repository.",
        hint: "GitHub may be having issues — please try again shortly.",
      };
  }
}

export default function ErrorBanner({
  code,
  message,
  repoUrl,
  retryAfterSeconds,
  onRetry,
  onDismiss,
}: ErrorBannerProps) {
  const { title, hint } = headline(code);
  const minutes =
    retryAfterSeconds !== undefined ? Math.max(1, Math.ceil(retryAfterSeconds / 60)) : null;

  return (
    <section
      role="alert"
      className="flex flex-col gap-3 rounded-2xl border border-red-300 bg-red-50 p-5 dark:border-red-500/40 dark:bg-red-950/40 sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-red-800 dark:text-red-300">{title}</h2>
          <p className="mt-1 text-xs text-red-700 dark:text-red-400">{message}</p>
          {hint !== undefined && (
            <p className="mt-1 text-xs text-red-600/80 dark:text-red-400/70">{hint}</p>
          )}
          {minutes !== null && (
            <p className="mt-1 text-xs font-medium text-red-700 dark:text-red-400">
              Rate limit resets in about {minutes} min.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss error"
          className="shrink-0 rounded-full px-2 text-lg leading-none text-red-700 transition-colors hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-900/50"
        >
          ×
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg bg-red-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-500"
        >
          {repoUrl !== undefined ? "Retry analysis" : "Try again"}
        </button>
        <a
          href="https://github.com/settings/tokens/new?description=RepoPulse%20Lite&scopes="
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-red-300 px-4 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-900/40"
        >
          Create a GitHub token
        </a>
      </div>
    </section>
  );
}
