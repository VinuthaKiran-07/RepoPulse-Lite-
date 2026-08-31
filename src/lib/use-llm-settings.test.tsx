// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, render, renderHook } from "@testing-library/react";
import { useLlmSettings, type UseLlmSettingsResult } from "@/lib/use-llm-settings";
import {
  DEFAULT_LLM_BASE_URL,
  DEFAULT_LLM_MODEL,
  LLM_SETTINGS_STORAGE_KEY,
} from "@/lib/settings";

describe("useLlmSettings", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("starts with defaults and hydrated false", () => {
    const seen: UseLlmSettingsResult[] = [];
    function Probe() {
      seen.push(useLlmSettings());
      return null;
    }
    render(<Probe />);
    expect(seen[0].settings).toEqual({
      baseUrl: DEFAULT_LLM_BASE_URL,
      model: DEFAULT_LLM_MODEL,
      apiKey: "",
    });
    expect(seen[0].hydrated).toBe(false);
    expect(seen[seen.length - 1].hydrated).toBe(true);
  });

  it("sets hydrated true after mount", () => {
    const { result } = renderHook(() => useLlmSettings());
    expect(result.current.hydrated).toBe(true);
  });

  it("loads seeded values from localStorage after mount", () => {
    window.localStorage.setItem(
      LLM_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        baseUrl: "https://api.example.com/v1",
        model: "seeded-model",
        apiKey: "sk-seeded",
      })
    );
    const { result } = renderHook(() => useLlmSettings());
    expect(result.current.settings).toEqual({
      baseUrl: "https://api.example.com/v1",
      model: "seeded-model",
      apiKey: "sk-seeded",
    });
  });

  it("saveSettings updates state and localStorage", () => {
    const { result } = renderHook(() => useLlmSettings());
    act(() => {
      result.current.saveSettings({
        baseUrl: "  https://api.example.com/v1  ",
        model: "test-model",
        apiKey: "sk-test",
      });
    });
    expect(result.current.settings).toEqual({
      baseUrl: "https://api.example.com/v1",
      model: "test-model",
      apiKey: "sk-test",
    });
    expect(JSON.parse(window.localStorage.getItem(LLM_SETTINGS_STORAGE_KEY) ?? "{}")).toEqual({
      baseUrl: "https://api.example.com/v1",
      model: "test-model",
      apiKey: "sk-test",
    });
  });

  it("clearSettings resets state and localStorage", () => {
    window.localStorage.setItem(
      LLM_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        baseUrl: "https://api.example.com/v1",
        model: "seeded-model",
        apiKey: "sk-seeded",
      })
    );
    const { result } = renderHook(() => useLlmSettings());
    expect(result.current.settings.apiKey).toBe("sk-seeded");
    act(() => {
      result.current.clearSettings();
    });
    expect(result.current.settings).toEqual({
      baseUrl: DEFAULT_LLM_BASE_URL,
      model: DEFAULT_LLM_MODEL,
      apiKey: "",
    });
    expect(window.localStorage.getItem(LLM_SETTINGS_STORAGE_KEY)).toBeNull();
  });
});
