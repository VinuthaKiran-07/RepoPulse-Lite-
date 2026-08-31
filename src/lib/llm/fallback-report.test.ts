import { describe, expect, it } from "vitest";
import { buildFallbackReport } from "@/lib/llm/fallback-report";
import { buildAuditSnapshot } from "@/lib/llm/snapshot";
import type { AuditSnapshot } from "@/lib/llm/types";
import { fixtureAnalyzeResponse } from "@/lib/test-fixtures";

function snapshotWith(overrides: Partial<AuditSnapshot> = {}): AuditSnapshot {
  return { ...buildAuditSnapshot(fixtureAnalyzeResponse()), ...overrides };
}

describe("buildFallbackReport", () => {
  it("renders the core structure of the report", () => {
    const report = buildFallbackReport(snapshotWith());
    expect(report).toContain("Heuristic-only mode");
    expect(report).toContain("octocat/hello-world");
    expect(report).toContain("Moderate");
    expect(report).toContain("## Prioritized Recommendations");
    expect(report).toContain("## Health Score: 72/100");
  });

  it("is deterministic across calls", () => {
    const snapshot = snapshotWith();
    expect(buildFallbackReport(snapshot)).toBe(buildFallbackReport(snapshot));
  });

  it("never contains a pipe character", () => {
    const report = buildFallbackReport(
      snapshotWith({
        anomalies: [
          {
            type: "MASSIVE_REWRITE",
            commitSha: "abc123",
            magnitude: 1200,
            description: "One commit rewrote 1,200 lines.",
          },
        ],
      })
    );
    expect(report).not.toContain("|");
  });

  it("advises conventional commits when hygiene is weak", () => {
    const report = buildFallbackReport(
      snapshotWith({
        score: 40,
        subScores: { hygiene: 30, churn: 70, cadence: 65, diversity: 6 },
      })
    );
    expect(report).toContain("Adopt conventional commit messages");
  });

  it("produces the sustain item when everything is healthy", () => {
    const report = buildFallbackReport(
      snapshotWith({
        score: 92,
        bandLabel: "Excellent",
        subScores: { hygiene: 88, churn: 84, cadence: 86, diversity: 80 },
        anomalyPenalty: 0,
        anomalies: [],
      })
    );
    expect(report).toContain("Sustain current practices");
    expect(report).toContain("92/100");
  });

  it("maps MASSIVE_REWRITE anomalies to split-commit advice", () => {
    const report = buildFallbackReport(
      snapshotWith({
        anomalies: [
          {
            type: "MASSIVE_REWRITE",
            commitSha: null,
            magnitude: 1800,
            description: "A commit changed 1,800 lines.",
          },
        ],
      })
    );
    expect(report).toContain("Split commits over 1,000 lines changed");
    expect(report).toContain("[MASSIVE_REWRITE]");
  });

  it("caps recommendations at 6 items", () => {
    const report = buildFallbackReport(
      snapshotWith({
        subScores: { hygiene: 10, churn: 20, cadence: 30, diversity: 40 },
        anomalies: [
          { type: "MASSIVE_REWRITE", commitSha: null, magnitude: 1, description: "a" },
          { type: "HIGH_RISK_DELETION", commitSha: null, magnitude: 1, description: "b" },
          { type: "TIER3_CLUSTER", commitSha: null, magnitude: 1, description: "c" },
          { type: "SINGLE_OWNER_RISK", commitSha: null, magnitude: 1, description: "d" },
        ],
      })
    );
    const numberedItems = report
      .split("## Prioritized Recommendations")[1]
      .trim()
      .split("\n")
      .filter((line) => /^\d+\./.test(line.trim()));
    expect(numberedItems).toHaveLength(6);
  });
});
