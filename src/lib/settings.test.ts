// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearLlmSettings,
  loadLlmSettings,
  sanitizeLlmSettings,
  saveLlmSettings,
  DEFAULT_LLM_BASE_URL,
  DEFAULT_LLM_MODEL,
  LLM_SETTINGS_STORAGE_KEY,
} from "@/lib/settings";

describe("sanitizeLlmSettings", () => {
  it("returns defaults for an empty object", () => {
    expect(sanitizeLlmSettings({})).toEqual({
      baseUrl: DEFAULT_LLM_BASE_URL,
      model: DEFAULT_LLM_MODEL,
      apiKey: "",
    });
  });

  it("returns defaults for empty and whitespace strings", () => {
    expect(sanitizeLlmSettings({ baseUrl: "   ", model: "", apiKey: "  " })).toEqual({
      baseUrl: DEFAULT_LLM_BASE_URL,
      model: DEFAULT_LLM_MODEL,
      apiKey: "",
    });
  });

  it("trims values", () => {
    expect(
      sanitizeLlmSettings({
        baseUrl: "  https://api.example.com/v1  ",
        model: "  test-model  ",
        apiKey: "  sk-test  ",
      })
    ).toEqual({
      baseUrl: "https://api.example.com/v1",
      model: "test-model",
      apiKey: "sk-test",
    });
  });

  it("replaces an http:// base URL with the default", () => {
    expect(sanitizeLlmSettings({ baseUrl: "http://api.example.com/v1" }).baseUrl).toBe(
      DEFAULT_LLM_BASE_URL
    );
  });

  it("keeps a valid https base URL", () => {
    expect(sanitizeLlmSettings({ baseUrl: "https://api.example.com/v1" }).baseUrl).toBe(
      "https://api.example.com/v1"
    );
  });

  it("falls back to defaults for a non-object", () => {
    expect(sanitizeLlmSettings("nope")).toEqual({
      baseUrl: DEFAULT_LLM_BASE_URL,
      model: DEFAULT_LLM_MODEL,
      apiKey: "",
    });
  });
});

describe("loadLlmSettings", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns defaults when storage is empty", () => {
    expect(loadLlmSettings()).toEqual({
      baseUrl: DEFAULT_LLM_BASE_URL,
      model: DEFAULT_LLM_MODEL,
      apiKey: "",
    });
  });

  it("returns saved values after save", () => {
    saveLlmSettings({
      baseUrl: "https://api.example.com/v1",
      model: "test-model",
      apiKey: "sk-test",
    });
    expect(loadLlmSettings()).toEqual({
      baseUrl: "https://api.example.com/v1",
      model: "test-model",
      apiKey: "sk-test",
    });
  });

  it("sanitizes invalid stored values on save and load", () => {
    saveLlmSettings({ baseUrl: "http://insecure.example.com", model: "  ", apiKey: " k " });
    expect(loadLlmSettings()).toEqual({
      baseUrl: DEFAULT_LLM_BASE_URL,
      model: DEFAULT_LLM_MODEL,
      apiKey: "k",
    });
  });

  it("returns defaults for corrupt JSON in storage", () => {
    window.localStorage.setItem(LLM_SETTINGS_STORAGE_KEY, "{not json");
    expect(loadLlmSettings()).toEqual({
      baseUrl: DEFAULT_LLM_BASE_URL,
      model: DEFAULT_LLM_MODEL,
      apiKey: "",
    });
  });

  it("falls back to defaults for an unknown shape", () => {
    window.localStorage.setItem(LLM_SETTINGS_STORAGE_KEY, JSON.stringify({ unexpected: true }));
    expect(loadLlmSettings()).toEqual({
      baseUrl: DEFAULT_LLM_BASE_URL,
      model: DEFAULT_LLM_MODEL,
      apiKey: "",
    });
  });
});

describe("clearLlmSettings", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("removes the stored settings so load returns defaults", () => {
    saveLlmSettings({
      baseUrl: "https://api.example.com/v1",
      model: "test-model",
      apiKey: "sk-test",
    });
    clearLlmSettings();
    expect(window.localStorage.getItem(LLM_SETTINGS_STORAGE_KEY)).toBeNull();
    expect(loadLlmSettings()).toEqual({
      baseUrl: DEFAULT_LLM_BASE_URL,
      model: DEFAULT_LLM_MODEL,
      apiKey: "",
    });
  });
});
