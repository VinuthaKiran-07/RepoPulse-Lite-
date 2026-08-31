// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import AnomalyFeed from "@/components/AnomalyFeed";
import type { AnomalyFlag } from "@/lib/scoring/types";

function flag(overrides: Partial<AnomalyFlag> = {}): AnomalyFlag {
  return {
    type: "MASSIVE_REWRITE",
    commitSha: "abc123def4567890abcdef1234567890abcdef12",
    magnitude: 1200,
    description: "1200 lines changed in a single commit",
    ...overrides,
  };
}

describe("AnomalyFeed", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the clean state when there are no flags", () => {
    render(<AnomalyFeed flags={[]} />);
    expect(screen.getByText(/no anomalies detected/i)).toBeInTheDocument();
  });

  it("renders one row per flag with type labels", () => {
    render(
      <AnomalyFeed
        flags={[
          flag(),
          flag({
            type: "HIGH_RISK_DELETION",
            commitSha: "fff1234fff1234fff1234fff1234fff1234fff1",
            magnitude: 700,
            description: "700 deletions in a single commit",
          }),
          flag({
            type: "TIER3_CLUSTER",
            commitSha: null,
            magnitude: 45,
            description: "45 of 100 commits are high-risk (Tier 3) — 45% of window",
          }),
          flag({
            type: "SINGLE_OWNER_RISK",
            commitSha: null,
            magnitude: 30,
            description: "all 30 commits authored by a single contributor",
          }),
        ]}
      />
    );
    expect(screen.getByText(/Massive rewrite/i)).toBeInTheDocument();
    expect(screen.getByText(/High-risk deletion/i)).toBeInTheDocument();
    expect(screen.getByText(/Tier-3 cluster/i)).toBeInTheDocument();
    expect(screen.getByText(/Single owner/i)).toBeInTheDocument();
    expect(screen.getByText(/45% of window/)).toBeInTheDocument();
  });

  it("links flagged commits to github", () => {
    render(<AnomalyFeed flags={[flag()]} />);
    const link = screen.getByRole("link", { name: /abc123def4/i });
    expect(link).toHaveAttribute(
      "href",
      "https://github.com/search?q=sha:abc123def4567890abcdef1234567890abcdef12"
    );
  });

  it("omits the commit link for window-level flags", () => {
    render(
      <AnomalyFeed flags={[flag({ type: "SINGLE_OWNER_RISK", commitSha: null })]} />
    );
    expect(screen.queryByRole("link", { name: /sha/i })).not.toBeInTheDocument();
  });
});
