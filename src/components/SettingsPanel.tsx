"use client";

import { useEffect, useState } from "react";
import { sanitizeLlmSettings, type LlmSettings } from "@/lib/settings";

interface SettingsPanelProps {
  settings: LlmSettings;
  onSave: (next: LlmSettings) => void;
  onClear: () => void;
}

const inputClassName =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-500 focus:ring-2 focus:ring-neutral-300 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-600 dark:focus:border-neutral-500 dark:focus:ring-neutral-600/40";

const labelClassName = "text-sm font-medium text-neutral-700 dark:text-neutral-300";

export default function SettingsPanel({ settings, onSave, onClear }: SettingsPanelProps) {
  const [open, setOpen] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [model, setModel] = useState(settings.model);
  const [apiKey, setApiKey] = useState(settings.apiKey);

  useEffect(() => {
    setBaseUrl(settings.baseUrl);
    setModel(settings.model);
    setApiKey(settings.apiKey);
  }, [settings.baseUrl, settings.model, settings.apiKey]);

  const trimmedBaseUrl = baseUrl.trim();
  const canSave = trimmedBaseUrl.startsWith("https://");
  const configured = settings.apiKey.trim().length > 0;

  function handleSave() {
    onSave(sanitizeLlmSettings({ baseUrl, model, apiKey }));
  }

  return (
    <div className="w-full flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-6">
      <div className="flex flex-col gap-2">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
          className="self-start text-sm font-semibold text-neutral-900 underline-offset-2 transition-colors hover:text-neutral-600 hover:underline dark:text-neutral-100 dark:hover:text-neutral-400"
        >
          LLM Settings
        </button>
        <p className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
          <span
            className={`inline-block size-2 rounded-full ${
              configured ? "bg-emerald-500" : "bg-amber-500"
            }`}
            aria-hidden="true"
          />
          {configured
            ? "Provider key configured — full LLM audits enabled"
            : "No provider key — audits run in heuristic-only mode"}
        </p>
      </div>

      {open && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="llm-base-url" className={labelClassName}>
              Base URL
            </label>
            <input
              id="llm-base-url"
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="https://api.groq.com/openai/v1"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              className={inputClassName}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="llm-model" className={labelClassName}>
              Model
            </label>
            <input
              id="llm-model"
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="llama-3.3-70b-versatile"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              className={inputClassName}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="llm-api-key" className={labelClassName}>
              API key
            </label>
            <div className="flex flex-col gap-1.5">
              <input
                id="llm-api-key"
                type={showApiKey ? "text" : "password"}
                autoComplete="off"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                className={inputClassName}
              />
              <button
                type="button"
                onClick={() => setShowApiKey((prev) => !prev)}
                className="self-start text-xs font-medium text-neutral-500 underline-offset-2 transition-colors hover:text-neutral-800 hover:underline dark:text-neutral-400 dark:hover:text-neutral-200"
              >
                {showApiKey ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!canSave}
              onClick={handleSave}
              className="rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300 sm:px-8"
            >
              Save settings
            </button>
            <button
              type="button"
              onClick={onClear}
              className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              Clear
            </button>
          </div>

          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Stored in this browser only. Sent per-request to generate audits; never persisted
            server-side and never logged.
          </p>
        </div>
      )}
    </div>
  );
}
