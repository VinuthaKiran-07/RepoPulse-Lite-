// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import TierDonut from "@/components/TierDonut";

describe("TierDonut", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows the placeholder when all tiers are zero", () => {
    render(<TierDonut tiers={{ tier1: 0, tier2: 0, tier3: 0 }} />);
    expect(screen.getByText(/no commits in window/i)).toBeInTheDocument();
  });

  it("renders the total commit count in the center overlay", () => {
    render(<TierDonut tiers={{ tier1: 70, tier2: 20, tier3: 10 }} />);
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText(/^commits$/i)).toBeInTheDocument();
  });

  it("renders per-tier counts and percentages", () => {
    render(<TierDonut tiers={{ tier1: 50, tier2: 30, tier3: 20 }} />);
    expect(screen.getByText(/Tier 1 · Routine/)).toBeInTheDocument();
    expect(screen.getByText(/Tier 2 · Moderate/)).toBeInTheDocument();
    expect(screen.getByText(/Tier 3 · High-risk/)).toBeInTheDocument();
    expect(screen.getByText("50 · 50%")).toBeInTheDocument();
    expect(screen.getByText("30 · 30%")).toBeInTheDocument();
    expect(screen.getByText("20 · 20%")).toBeInTheDocument();
  });
});
