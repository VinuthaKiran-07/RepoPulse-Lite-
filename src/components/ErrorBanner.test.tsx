// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import ErrorBanner from "@/components/ErrorBanner";

describe("ErrorBanner", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders an INVALID_URL headline with format hint", () => {
    render(
      <ErrorBanner
        code="INVALID_URL"
        message="host must be github.com"
        onRetry={() => {}}
        onDismiss={() => {}}
      />
    );
    expect(
      screen.getByText(/doesn't look like a public GitHub repository URL/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/host must be github.com/)).toBeInTheDocument();
    expect(screen.getByText(/https:\/\/github.com\/\{owner\}\/\{repo\}/i)).toBeInTheDocument();
  });

  it("shows the retry countdown for RATE_LIMITED", () => {
    render(
      <ErrorBanner
        code="RATE_LIMITED"
        message="GitHub API rate limit reached."
        retryAfterSeconds={900}
        onRetry={() => {}}
        onDismiss={() => {}}
      />
    );
    expect(screen.getByText(/rate limit resets in about 15 min/i)).toBeInTheDocument();
  });

  it("calls onRetry when the retry button is clicked", async () => {
    const onRetry = vi.fn();
    render(
      <ErrorBanner
        code="REPO_NOT_FOUND"
        message="not found"
        onRetry={onRetry}
        onDismiss={() => {}}
      />
    );
    const userEvent = await importUserEvent();
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("calls onDismiss when the dismiss button is clicked", async () => {
    const onDismiss = vi.fn();
    render(
      <ErrorBanner
        code="NETWORK_ERROR"
        message="network down"
        onDismiss={onDismiss}
        onRetry={() => {}}
      />
    );
    const userEvent = await importUserEvent();
    await userEvent.click(screen.getByRole("button", { name: /dismiss error/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

async function importUserEvent() {
  const mod = await import("@testing-library/user-event");
  return mod.default.setup();
}
