// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import RepoSummaryCard from "@/components/RepoSummaryCard";
import MetricBreakdown from "@/components/MetricBreakdown";
import AuthorLeaderboard from "@/components/AuthorLeaderboard";
import DashboardSkeleton from "@/components/DashboardSkeleton";
import { fixtureAnalyzeResponse } from "@/lib/test-fixtures";

afterEach(() => {
  cleanup();
});

describe("RepoSummaryCard", () => {
  it("renders repo metadata chips and window size", () => {
    render(<RepoSummaryCard data={fixtureAnalyzeResponse()} />);
    expect(screen.getByText("octocat/hello-world")).toBeInTheDocument();
    expect(screen.getByText(/A sample repository/)).toBeInTheDocument();
    expect(screen.getByText(/1,200 stars/)).toBeInTheDocument();
    expect(screen.getByText(/80 forks/)).toBeInTheDocument();
    expect(screen.getByText(/4 open issues/)).toBeInTheDocument();
    expect(screen.getByText(/1 commit/i)).toBeInTheDocument();
  });

  it("falls back to a no-description message", () => {
    const data = fixtureAnalyzeResponse();
    data.repo.description = null;
    render(<RepoSummaryCard data={data} />);
    expect(screen.getByText(/No description provided/i)).toBeInTheDocument();
  });
});

describe("MetricBreakdown", () => {
  it("renders all five metric cards with weights and key stats", () => {
    render(<MetricBreakdown metrics={fixtureAnalyzeResponse().metrics} />);
    expect(screen.getByText("Commit Hygiene")).toBeInTheDocument();
    expect(screen.getByText("Code Churn Balance")).toBeInTheDocument();
    expect(screen.getByText("Cadence & Velocity")).toBeInTheDocument();
    expect(screen.getByText("Author Diversity")).toBeInTheDocument();
    expect(screen.getByText("Anomaly Penalty")).toBeInTheDocument();
    expect(screen.getAllByText(/weight 0\.\d{2}/i)).toHaveLength(4);
    expect(screen.getByText("−0 pts")).toBeInTheDocument();
  });

  it("shows penalty points and flag count", () => {
    const data = fixtureAnalyzeResponse();
    data.metrics.anomaly = {
      penalty: 12,
      flags: [
        {
          type: "MASSIVE_REWRITE",
          commitSha: "abc",
          magnitude: 1500,
          description: "1500 lines changed",
        },
        {
          type: "SINGLE_OWNER_RISK",
          commitSha: null,
          magnitude: 20,
          description: "single owner",
        },
      ],
    };
    render(<MetricBreakdown metrics={data.metrics} />);
    expect(screen.getByText("−12 pts")).toBeInTheDocument();
    expect(screen.getByText(/2 flags detected/i)).toBeInTheDocument();
  });
});

describe("AuthorLeaderboard", () => {
  it("renders top 5 authors with share and overflow count", () => {
    const authors = Array.from({ length: 7 }, (_, i) => ({
      login: `dev${i + 1}`,
      name: `Dev ${i + 1}`,
      commits: 10 - i,
      additions: 100,
      deletions: 20,
    }));
    render(<AuthorLeaderboard authors={authors} totalCommits={49} />);
    expect(screen.getByText("dev1")).toBeInTheDocument();
    expect(screen.getByText("dev5")).toBeInTheDocument();
    expect(screen.queryByText("dev6")).not.toBeInTheDocument();
    expect(screen.getByText(/\+2 more authors in window/i)).toBeInTheDocument();
    expect(screen.getByText(/10 commits/)).toBeInTheDocument();
    expect(screen.getByText(/20\.4%/)).toBeInTheDocument();
  });

  it("shows the empty placeholder when there are no authors", () => {
    render(<AuthorLeaderboard authors={[]} totalCommits={0} />);
    expect(screen.getByText(/No author data/i)).toBeInTheDocument();
  });
});

describe("DashboardSkeleton", () => {
  it("renders pulsing placeholder blocks without crashing", () => {
    const { container } = render(<DashboardSkeleton />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(4);
  });
});
