// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import AnalyzeForm from "@/components/AnalyzeForm";

describe("AnalyzeForm", () => {
  afterEach(() => {
    cleanup();
  });

  it("disables submit while empty", () => {
    render(<AnalyzeForm onAnalyze={() => {}} loading={false} />);
    const button = screen.getByRole("button", { name: "Analyze" });
    expect(button).toBeDisabled();
  });

  it("shows a validation hint for an invalid URL after typing", async () => {
    const { userEvent } = await importUserEvent();
    render(<AnalyzeForm onAnalyze={() => {}} loading={false} />);
    const input = screen.getByLabelText(/GitHub repository URL/i);
    await userEvent.type(input, "not-a-github-url");
    expect(
      await screen.findByText(/only https:\/\/ URLs are allowed/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analyze" })).toBeDisabled();
  });

  it("enables submit for a valid URL and calls onAnalyze", async () => {
    const { userEvent } = await importUserEvent();
    const onAnalyze = vi.fn();
    render(<AnalyzeForm onAnalyze={onAnalyze} loading={false} />);
    const input = screen.getByLabelText(/GitHub repository URL/i);
    await userEvent.type(input, "https://github.com/octocat/hello-world");
    const button = screen.getByRole("button", { name: "Analyze" });
    expect(button).toBeEnabled();
    await userEvent.click(button);
    expect(onAnalyze).toHaveBeenCalledWith("https://github.com/octocat/hello-world", undefined);
  });

  it("reveals the token field via the toggle and passes the token", async () => {
    const { userEvent } = await importUserEvent();
    const onAnalyze = vi.fn();
    render(<AnalyzeForm onAnalyze={onAnalyze} loading={false} />);
    await userEvent.click(screen.getByText(/Add a GitHub token/i));
    const tokenInput = screen.getByLabelText(/GitHub token/i);
    await userEvent.type(tokenInput, "tok");
    await userEvent.type(
      screen.getByLabelText(/GitHub repository URL/i),
      "https://github.com/octocat/hello-world"
    );
    await userEvent.click(screen.getByRole("button", { name: "Analyze" }));
    expect(onAnalyze).toHaveBeenCalledWith("https://github.com/octocat/hello-world", "tok");
  });

  it("shows analyzing state and blocks resubmission while loading", async () => {
    const { userEvent } = await importUserEvent();
    const onAnalyze = vi.fn();
    render(<AnalyzeForm onAnalyze={onAnalyze} loading={true} />);
    const input = screen.getByLabelText(/GitHub repository URL/i);
    await userEvent.type(input, "https://github.com/octocat/hello-world");
    const button = screen.getByRole("button", { name: /Analyzing…/i });
    expect(button).toBeDisabled();
    expect(onAnalyze).not.toHaveBeenCalled();
  });

  it("submits via Enter key", async () => {
    const { userEvent } = await importUserEvent();
    const onAnalyze = vi.fn();
    render(<AnalyzeForm onAnalyze={onAnalyze} loading={false} />);
    const input = screen.getByLabelText(/GitHub repository URL/i);
    await userEvent.type(input, "https://github.com/octocat/hello-world{Enter}");
    expect(onAnalyze).toHaveBeenCalledWith("https://github.com/octocat/hello-world", undefined);
  });
});

async function importUserEvent() {
  const mod = await import("@testing-library/user-event");
  return { userEvent: mod.default.setup() };
}
