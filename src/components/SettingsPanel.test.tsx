// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import SettingsPanel from "@/components/SettingsPanel";
import { DEFAULT_LLM_BASE_URL, DEFAULT_LLM_MODEL, type LlmSettings } from "@/lib/settings";

const defaultSettings: LlmSettings = {
  baseUrl: DEFAULT_LLM_BASE_URL,
  model: DEFAULT_LLM_MODEL,
  apiKey: "",
};

describe("SettingsPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders collapsed with the heuristic-only status when apiKey is empty", () => {
    render(
      <SettingsPanel settings={defaultSettings} onSave={() => {}} onClear={() => {}} />
    );
    const toggle = screen.getByRole("button", { name: "LLM Settings" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText(/heuristic-only mode/i)).toBeInTheDocument();
  });

  it("shows the provider key configured status when apiKey is provided", () => {
    render(
      <SettingsPanel
        settings={{ ...defaultSettings, apiKey: "sk-test" }}
        onSave={() => {}}
        onClear={() => {}}
      />
    );
    expect(screen.getByText(/Provider key configured/i)).toBeInTheDocument();
  });

  it("expands on toggle and reveals the fields", async () => {
    const { userEvent } = await importUserEvent();
    render(
      <SettingsPanel settings={defaultSettings} onSave={() => {}} onClear={() => {}} />
    );
    const toggle = screen.getByRole("button", { name: "LLM Settings" });
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText(/Base URL/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Model/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/API key/i)).toBeInTheDocument();
  });

  it("calls onSave once with trimmed values", async () => {
    const { userEvent } = await importUserEvent();
    const onSave = vi.fn();
    render(<SettingsPanel settings={defaultSettings} onSave={onSave} onClear={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "LLM Settings" }));
    await userEvent.clear(screen.getByLabelText(/Base URL/i));
    await userEvent.clear(screen.getByLabelText(/Model/i));
    await userEvent.type(screen.getByLabelText(/Base URL/i), "https://api.example.com/v1  ");
    await userEvent.type(screen.getByLabelText(/Model/i), "  test-model  ");
    await userEvent.type(screen.getByLabelText(/API key/i), "sk-test  ");
    await userEvent.click(screen.getByRole("button", { name: "Save settings" }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({
      baseUrl: "https://api.example.com/v1",
      model: "test-model",
      apiKey: "sk-test",
    });
  });

  it("disables Save when the Base URL does not start with https://", async () => {
    const { userEvent } = await importUserEvent();
    const onSave = vi.fn();
    render(<SettingsPanel settings={defaultSettings} onSave={onSave} onClear={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "LLM Settings" }));
    const baseUrlInput = screen.getByLabelText(/Base URL/i);
    await userEvent.clear(baseUrlInput);
    await userEvent.type(baseUrlInput, "http://plain.example.com");
    const saveButton = screen.getByRole("button", { name: "Save settings" });
    expect(saveButton).toBeDisabled();
    await userEvent.click(saveButton);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("toggles the API key input between password and text", async () => {
    const { userEvent } = await importUserEvent();
    render(
      <SettingsPanel
        settings={{ ...defaultSettings, apiKey: "sk-test" }}
        onSave={() => {}}
        onClear={() => {}}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "LLM Settings" }));
    const apiKeyInput = screen.getByLabelText(/API key/i);
    expect(apiKeyInput).toHaveAttribute("type", "password");
    await userEvent.click(screen.getByRole("button", { name: "Show" }));
    expect(apiKeyInput).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide" })).toBeInTheDocument();
  });

  it("calls onClear from the Clear button", async () => {
    const { userEvent } = await importUserEvent();
    const onClear = vi.fn();
    render(
      <SettingsPanel settings={defaultSettings} onSave={() => {}} onClear={onClear} />
    );
    await userEvent.click(screen.getByRole("button", { name: "LLM Settings" }));
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});

async function importUserEvent() {
  const mod = await import("@testing-library/user-event");
  return { userEvent: mod.default.setup() };
}
