"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clearLlmSettings,
  loadLlmSettings,
  sanitizeLlmSettings,
  saveLlmSettings,
  type LlmSettings,
} from "@/lib/settings";

export interface UseLlmSettingsResult {
  settings: LlmSettings;
  hydrated: boolean;
  saveSettings: (next: LlmSettings) => void;
  clearSettings: () => void;
}

export function useLlmSettings(): UseLlmSettingsResult {
  const [settings, setSettings] = useState<LlmSettings>(() => sanitizeLlmSettings({}));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSettings(loadLlmSettings());
    setHydrated(true);
  }, []);

  const saveSettings = useCallback((next: LlmSettings) => {
    const clean = sanitizeLlmSettings(next);
    saveLlmSettings(clean);
    setSettings(clean);
  }, []);

  const clearSettings = useCallback(() => {
    clearLlmSettings();
    setSettings(sanitizeLlmSettings({}));
  }, []);

  return { settings, hydrated, saveSettings, clearSettings };
}
