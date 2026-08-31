"use client";

import { useState, type FormEvent } from "react";
import { validateGithubUrl } from "@/lib/github/url-validator";

interface AnalyzeFormProps {
  onAnalyze: (repoUrl: string, token?: string) => void;
  loading: boolean;
  initialUrl?: string;
}

export default function AnalyzeForm({ onAnalyze, loading, initialUrl = "" }: AnalyzeFormProps) {
  const [repoUrl, setRepoUrl] = useState(initialUrl);
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [touched, setTouched] = useState(false);

  const trimmed = repoUrl.trim();
  const validation = trimmed.length > 0 ? validateGithubUrl(trimmed) : null;
  const urlError = validation !== null && !validation.ok ? validation.reason : null;
  const canSubmit = trimmed.length > 0 && validation?.ok === true && !loading;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      setTouched(true);
      return;
    }
    onAnalyze(trimmed, token.trim().length > 0 ? token.trim() : undefined);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-6"
      noValidate
    >
      <label htmlFor="repo-url" className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
        GitHub repository URL
      </label>
      <input
        id="repo-url"
        type="text"
        inputMode="url"
        autoComplete="off"
        spellCheck={false}
        placeholder="https://github.com/owner/repo"
        value={repoUrl}
        onChange={(event) => {
          setRepoUrl(event.target.value);
          setTouched(true);
        }}
        onBlur={() => setTouched(true)}
        aria-invalid={touched && urlError !== null}
        className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 ${
          touched && urlError !== null
            ? "border-red-400 focus:ring-red-300 dark:border-red-500 dark:focus:ring-red-500/40"
            : "border-neutral-300 focus:border-neutral-500 focus:ring-neutral-300 dark:border-neutral-700 dark:focus:border-neutral-500 dark:focus:ring-neutral-600/40"
        } bg-white text-neutral-900 placeholder:text-neutral-400 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-600`}
      />
      {touched && urlError !== null && (
        <p className="text-xs text-red-600 dark:text-red-400">{urlError}</p>
      )}

      <button
        type="button"
        onClick={() => setShowToken((prev) => !prev)}
        className="self-start text-xs font-medium text-neutral-500 underline-offset-2 transition-colors hover:text-neutral-800 hover:underline dark:text-neutral-400 dark:hover:text-neutral-200"
      >
        {showToken ? "Hide token field" : "Add a GitHub token (optional)"}
      </button>

      {showToken && (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="github-token"
            className="text-sm font-medium text-neutral-700 dark:text-neutral-300"
          >
            GitHub token
          </label>
          <input
            id="github-token"
            type="password"
            autoComplete="off"
            placeholder="ghp_… (raises rate limit to 5,000 req/h)"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-500 focus:ring-2 focus:ring-neutral-300 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-600 dark:focus:border-neutral-500 dark:focus:ring-neutral-600/40"
          />
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Sent per-request only, stored only in this browser tab, never persisted server-side.
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-1 w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300 sm:w-auto sm:self-start sm:px-8"
      >
        {loading ? "Analyzing…" : "Analyze"}
      </button>
    </form>
  );
}
