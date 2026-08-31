export interface LlmSettings {
  baseUrl: string;
  model: string;
  apiKey: string;
}

export const DEFAULT_LLM_BASE_URL = "https://api.groq.com/openai/v1";
export const DEFAULT_LLM_MODEL = "llama-3.3-70b-versatile";
export const LLM_SETTINGS_STORAGE_KEY = "repopulse.llm.settings.v1";

export function sanitizeLlmSettings(input: unknown): LlmSettings {
  const record =
    typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  const rawBaseUrl = typeof record.baseUrl === "string" ? record.baseUrl.trim() : "";
  const rawModel = typeof record.model === "string" ? record.model.trim() : "";
  const rawApiKey = typeof record.apiKey === "string" ? record.apiKey.trim() : "";
  const baseUrl = rawBaseUrl.startsWith("https://") ? rawBaseUrl : DEFAULT_LLM_BASE_URL;
  const model = rawModel.length > 0 ? rawModel : DEFAULT_LLM_MODEL;
  return { baseUrl, model, apiKey: rawApiKey };
}

export function loadLlmSettings(): LlmSettings {
  if (typeof window === "undefined") {
    return sanitizeLlmSettings({});
  }
  try {
    const raw = window.localStorage.getItem(LLM_SETTINGS_STORAGE_KEY);
    return raw === null ? sanitizeLlmSettings({}) : sanitizeLlmSettings(JSON.parse(raw));
  } catch {
    return sanitizeLlmSettings({});
  }
}

export function saveLlmSettings(settings: LlmSettings): void {
  try {
    window.localStorage.setItem(
      LLM_SETTINGS_STORAGE_KEY,
      JSON.stringify(sanitizeLlmSettings(settings))
    );
  } catch {}
}

export function clearLlmSettings(): void {
  try {
    window.localStorage.removeItem(LLM_SETTINGS_STORAGE_KEY);
  } catch {}
}
