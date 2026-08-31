import { describe, it, expect } from "vitest";
import { bloatFactor, computeChurn } from "@/lib/scoring/churn";
import { makeCommits } from "@/lib/scoring/test-fixtures";

describe("bloatFactor", () => {
  it("returns 1.0 inside the ideal band", () => {
    expect(bloatFactor(0.55)).toBe(1);
    expect(bloatFactor(0.8)).toBe(1);
    expect(bloatFactor(0.7)).toBe(1);
  });

  it("clamps to 0.4 at the falloff anchors and beyond", () => {
    expect(bloatFactor(0.15)).toBeCloseTo(0.4, 10);
    expect(bloatFactor(0.95)).toBeCloseTo(0.4, 10);
    expect(bloatFactor(0.1)).toBe(0.4);
    expect(bloatFactor(1.0)).toBe(0.4);
    expect(bloatFactor(0)).toBe(0.4);
  });

  it("interpolates linearly outside the band", () => {
    expect(bloatFactor(0.35)).toBeCloseTo(0.4 + (0.35 - 0.15) * 1.5, 10);
    expect(bloatFactor(0.35)).toBeCloseTo(0.7, 10);
    expect(bloatFactor(0.875)).toBeCloseTo(1 - (0.875 - 0.8) * 4, 10);
    expect(bloatFactor(0.875)).toBeCloseTo(0.7, 10);
  });
});

describe("computeChurn", () => {
  it("returns zeros for empty input", () => {
    expect(computeChurn([])).toEqual({
      score: 0,
      additions: 0,
      deletions: 0,
      addRatio: 0,
      fBloat: 0,
      fRegen: 0,
      fAtomic: 0,
      avgCommitSize: 0,
    });
  });

  it("rewards balanced additive windows", () => {
    const commits = makeCommits(10, { additions: 60, deletions: 20 });
    const result = computeChurn(commits);
    expect(result.additions).toBe(600);
    expect(result.deletions).toBe(200);
    expect(result.addRatio).toBeCloseTo(600 / 800, 10);
    expect(result.fBloat).toBe(1);
    expect(result.fRegen).toBeCloseTo(1 - 200 / 600, 10);
    expect(result.avgCommitSize).toBe(80);
    expect(result.fAtomic).toBe(1);
    expect(result.score).toBeCloseTo(100 * (0.5 * 1 + 0.25 * (1 - 200 / 600) + 0.25 * 1), 10);
    expect(result.score).toBeCloseTo(91.6666666667, 8);
  });

  it("penalizes deletion-heavy windows", () => {
    const commits = makeCommits(10, { additions: 10, deletions: 500 });
    const result = computeChurn(commits);
    expect(result.addRatio).toBeCloseTo(100 / 5100, 10);
    expect(result.fBloat).toBe(0.4);
    expect(result.fRegen).toBe(0);
    expect(result.avgCommitSize).toBe(510);
    expect(result.fAtomic).toBeCloseTo(1 - (510 - 200) / 800, 10);
    expect(result.score).toBeCloseTo(100 * (0.5 * 0.4 + 0.25 * 0 + 0.25 * (1 - 310 / 800)), 10);
    expect(result.score).toBeCloseTo(35.3125, 8);
  });

  it("handles zero-churn windows deterministically", () => {
    const commits = makeCommits(3, { additions: 0, deletions: 0 });
    const result = computeChurn(commits);
    expect(result.addRatio).toBe(0);
    expect(result.fBloat).toBe(0.4);
    expect(result.fRegen).toBe(1);
    expect(result.fAtomic).toBe(1);
    expect(result.score).toBeCloseTo(70, 10);
  });

  it("applies the atomic falloff for oversized average commits", () => {
    const commits = makeCommits(4, { additions: 190, deletions: 10 });
    const result = computeChurn(commits);
    expect(result.avgCommitSize).toBe(200);
    expect(result.fAtomic).toBe(1);
    expect(computeChurn(makeCommits(4, { additions: 1000, deletions: 0 })).fAtomic).toBeCloseTo(1 - 800 / 800, 10);
    expect(computeChurn(makeCommits(4, { additions: 1000, deletions: 0 })).fAtomic).toBe(0);
  });
});
