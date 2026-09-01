import { describe, it, expect } from "vitest";
import {
  ANOMALY_PENALTY_CAP,
  SCORE_WEIGHTS,
  bandForScore,
  computeHealthScore,
} from "@/lib/scoring/engine";
import type { CommitDetail } from "@/lib/github/types";
import { makeCommit, spacedDates } from "@/lib/scoring/test-fixtures";

describe("constants", () => {
  it("exposes the documented weights and cap", () => {
    expect(SCORE_WEIGHTS.hygiene).toBe(0.25);
    expect(SCORE_WEIGHTS.churn).toBe(0.2);
    expect(SCORE_WEIGHTS.cadence).toBe(0.2);
    expect(SCORE_WEIGHTS.diversity).toBe(0.2);
    expect(ANOMALY_PENALTY_CAP).toBe(20);
  });
});

describe("bandForScore", () => {
  it("maps boundaries to the spec bands", () => {
    expect(bandForScore(100).band).toBe("excellent");
    expect(bandForScore(80).band).toBe("excellent");
    expect(bandForScore(79).band).toBe("moderate");
    expect(bandForScore(60).band).toBe("moderate");
    expect(bandForScore(59).band).toBe("at_risk");
    expect(bandForScore(40).band).toBe("at_risk");
    expect(bandForScore(39).band).toBe("critical");
    expect(bandForScore(0).band).toBe("critical");
  });

  it("clamps out-of-range scores", () => {
    expect(bandForScore(-5).band).toBe("critical");
    expect(bandForScore(105).band).toBe("excellent");
  });

  it("carries label and color", () => {
    expect(bandForScore(90)).toEqual({ band: "excellent", label: "Excellent", color: "#22c55e" });
    expect(bandForScore(70)).toEqual({ band: "moderate", label: "Moderate", color: "#eab308" });
    expect(bandForScore(50)).toEqual({ band: "at_risk", label: "At Risk", color: "#f97316" });
    expect(bandForScore(10)).toEqual({ band: "critical", label: "Critical", color: "#ef4444" });
  });
});

describe("computeHealthScore", () => {
  it("returns a zeroed critical result for empty input", () => {
    const result = computeHealthScore([]);
    expect(result.score).toBe(0);
    expect(result.band.band).toBe("critical");
    expect(result.tiers).toEqual({ tier1: 0, tier2: 0, tier3: 0 });
    expect(result.metrics.hygiene.score).toBe(0);
    expect(result.metrics.churn.score).toBe(0);
    expect(result.metrics.cadence.score).toBe(0);
    expect(result.metrics.diversity.score).toBe(0);
    expect(result.metrics.anomaly.penalty).toBe(0);
    expect(result.metrics.anomaly.flags).toEqual([]);
  });

  it("is deterministic for identical input", () => {
    const commits: CommitDetail[] = Array.from({ length: 30 }, (_, i) =>
      makeCommit({
        sha: `s${i}`,
        message: i % 3 === 0 ? "wip" : "feat: extend scoring engine coverage",
        authorLogin: `dev${i % 4}`,
        authorDate: spacedDates(30, 10)[i],
        additions: (i * 37) % 900,
        deletions: (i * 11) % 90,
        filesChanged: (i % 7) + 1,
      })
    );
    const first = computeHealthScore(commits);
    const second = computeHealthScore(commits);
    expect(second).toEqual(first);
  });

  it("is invariant to input order apart from flag order", () => {
    const commits: CommitDetail[] = Array.from({ length: 24 }, (_, i) =>
      makeCommit({
        sha: `s${i}`,
        message: i % 4 === 0 ? "fix bug" : "refactor: tighten url validation rules",
        authorLogin: `dev${i % 3}`,
        authorDate: spacedDates(24, 18)[i],
        additions: (i * 53) % 1200,
        deletions: (i * 29) % 700,
        filesChanged: (i % 6) + 1,
      })
    );
    const original = computeHealthScore(commits);
    const shuffled = computeHealthScore([...commits].reverse());
    expect(shuffled.score).toBe(original.score);
    expect(shuffled.tiers).toEqual(original.tiers);
    expect(shuffled.metrics.hygiene).toEqual(original.metrics.hygiene);
    expect(shuffled.metrics.churn).toEqual(original.metrics.churn);
    expect(shuffled.metrics.cadence).toEqual(original.metrics.cadence);
    expect(shuffled.metrics.diversity).toEqual(original.metrics.diversity);
    expect(shuffled.metrics.anomaly.penalty).toBe(original.metrics.anomaly.penalty);
  });

  it("computes the composite from hand-derived sub-metric values", () => {
    const dates = spacedDates(25, 12);
    const commits: CommitDetail[] = Array.from({ length: 25 }, (_, i) =>
      makeCommit({
        sha: `s${i}`,
        message: "feat: add metric breakdown component",
        authorLogin: `dev${i % 5}`,
        authorName: `dev${i % 5}`,
        authorEmail: `dev${i % 5}@example.com`,
        authorDate: dates[i],
        additions: 60,
        deletions: 20,
        filesChanged: 2,
      })
    );

    const result = computeHealthScore(commits);

    expect(result.metrics.hygiene.score).toBe(100);
    expect(result.metrics.hygiene.conventionalShare).toBe(1);
    expect(result.metrics.hygiene.qualityMean).toBe(1);

    const expectedChurn = 100 * (0.5 * 1 + 0.25 * (1 - 200 / 600) + 0.25 * 1);
    expect(result.metrics.churn.score).toBeCloseTo(expectedChurn, 10);
    expect(result.metrics.churn.addRatio).toBeCloseTo(0.75, 10);

    const v = 25 / 12;
    const expectedFFreq = 2 / (1 + Math.exp(-2 * (v - 1.2)));
    expect(result.metrics.cadence.commitsPerDay).toBeCloseTo(v, 10);
    expect(result.metrics.cadence.fFreq).toBeCloseTo(expectedFFreq, 10);
    expect(result.metrics.cadence.fRegularity).toBe(1);
    const expectedCadence = Math.min(
      100,
      100 * (0.6 * expectedFFreq + 0.4 * 1)
    );
    expect(result.metrics.cadence.score).toBeCloseTo(expectedCadence, 10);

    expect(result.metrics.diversity.score).toBeCloseTo(100, 10);
    expect(result.metrics.diversity.authorCount).toBe(5);

    expect(result.metrics.anomaly.penalty).toBe(0);
    expect(result.metrics.anomaly.flags).toEqual([]);

    expect(result.tiers).toEqual({ tier1: 0, tier2: 25, tier3: 0 });

    const expectedRaw =
      SCORE_WEIGHTS.hygiene * 100 +
      SCORE_WEIGHTS.churn * expectedChurn +
      SCORE_WEIGHTS.cadence * expectedCadence +
      SCORE_WEIGHTS.diversity * 100 -
      0;
    const expectedScore = Math.min(Math.max(Math.round(expectedRaw), 0), 100);
    expect(result.score).toBe(expectedScore);
    expect(result.band.band).toBe("excellent");
  });

  it("clamps runaway sub-metric sums to the 0-100 range", () => {
    const dates = spacedDates(25, 1);
    const commits: CommitDetail[] = Array.from({ length: 25 }, (_, i) =>
      makeCommit({
        sha: `s${i}`,
        message: "feat: add metric breakdown component",
        authorLogin: `dev${i % 5}`,
        authorName: `dev${i % 5}`,
        authorEmail: `dev${i % 5}@example.com`,
        authorDate: dates[i],
        additions: 60,
        deletions: 20,
        filesChanged: 2,
      })
    );
    const result = computeHealthScore(commits);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("drives a chaotic single-owner repo into a low band", () => {
    const dates = spacedDates(20, 26);
    const commits: CommitDetail[] = Array.from({ length: 20 }, (_, i) =>
      makeCommit({
        sha: `s${i}`,
        message: i % 2 === 0 ? "wip" : "update",
        authorLogin: "solo",
        authorName: "solo",
        authorEmail: "solo@example.com",
        authorDate: dates[i],
        additions: i % 5 === 0 ? 2000 : 300,
        deletions: i % 7 === 0 ? 900 : 20,
        filesChanged: 8,
      })
    );
    const result = computeHealthScore(commits);
    expect(result.score).toBeLessThan(20);
    expect(result.band.band).toBe("critical");
    expect(result.metrics.anomaly.penalty).toBe(20);
    expect(
      result.metrics.anomaly.flags.map((f) => f.type)
    ).toContain("SINGLE_OWNER_RISK");
    expect(result.metrics.anomaly.flags.map((f) => f.type)).toContain("TIER3_CLUSTER");
    expect(result.tiers.tier3).toBe(20);
  });
});
