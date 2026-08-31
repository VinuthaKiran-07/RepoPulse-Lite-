import { describe, it, expect } from "vitest";
import { computeCadence } from "@/lib/scoring/cadence";
import { makeCommit } from "@/lib/scoring/test-fixtures";

function commitsAt(dates: string[]) {
  return dates.map((d, i) => makeCommit({ sha: `s${i}`, authorDate: d }));
}

describe("computeCadence", () => {
  it("returns zeros for empty input", () => {
    expect(computeCadence([])).toEqual({
      score: 0,
      spanDays: 0,
      commitsPerDay: 0,
      fFreq: 0,
      gapCv: 0,
      fRegularity: 0,
    });
  });

  it("scores a steady daily cadence with zero gap variance", () => {
    const commits = commitsAt([
      "2026-01-01T00:00:00Z",
      "2026-01-02T00:00:00Z",
      "2026-01-03T00:00:00Z",
      "2026-01-04T00:00:00Z",
      "2026-01-05T00:00:00Z",
    ]);
    const result = computeCadence(commits);
    expect(result.spanDays).toBe(4);
    expect(result.commitsPerDay).toBeCloseTo(5 / 4, 10);
    expect(result.fFreq).toBeCloseTo(2 / (1 + Math.exp(-2 * (5 / 4 - 1.2))), 10);
    expect(result.gapCv).toBe(0);
    expect(result.fRegularity).toBe(1);
    expect(result.score).toBeCloseTo(100 * (0.6 * (2 / (1 + Math.exp(-2 * (5 / 4 - 1.2)))) + 0.4 * 1), 10);
  });

  it("penalizes burst-then-silence patterns", () => {
    const commits = commitsAt([
      "2026-01-01T00:00:00Z",
      "2026-01-01T01:00:00Z",
      "2026-01-01T02:00:00Z",
      "2026-01-10T00:00:00Z",
      "2026-01-20T00:00:00Z",
    ]);
    const result = computeCadence(commits);
    expect(result.spanDays).toBeCloseTo(19, 10);
    expect(result.commitsPerDay).toBeCloseTo(5 / 19, 10);

    const gaps = [1, 1, 214, 240];
    const mean = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    const variance = gaps.reduce((s, g) => s + (g - mean) * (g - mean), 0) / gaps.length;
    const cv = Math.sqrt(variance) / mean;
    expect(result.gapCv).toBeCloseTo(cv, 10);
    expect(result.fRegularity).toBeCloseTo(1 - cv / 2, 10);

    const fFreq = 2 / (1 + Math.exp(-2 * (5 / 19 - 1.2)));
    expect(result.fFreq).toBeCloseTo(fFreq, 10);
    expect(result.score).toBeCloseTo(100 * (0.6 * fFreq + 0.4 * (1 - cv / 2)), 10);
    expect(result.score).toBeLessThan(40);
  });

  it("forces span to at least one day for a single commit", () => {
    const result = computeCadence([makeCommit()]);
    expect(result.spanDays).toBe(1);
    expect(result.commitsPerDay).toBe(1);
    expect(result.fFreq).toBeCloseTo(2 / (1 + Math.exp(-2 * (1 - 1.2))), 10);
    expect(result.gapCv).toBe(0);
    expect(result.fRegularity).toBe(1);
    expect(result.score).toBeCloseTo(100 * (0.6 * (2 / (1 + Math.exp(-2 * (1 - 1.2)))) + 0.4 * 1), 10);
  });

  it("treats duplicate timestamps as zero gaps", () => {
    const commits = commitsAt([
      "2026-01-01T00:00:00Z",
      "2026-01-02T00:00:00Z",
      "2026-01-02T00:00:00Z",
      "2026-01-02T00:00:00Z",
      "2026-01-03T00:00:00Z",
    ]);
    const result = computeCadence(commits);
    const gaps = [24, 0, 0, 24];
    const mean = 12;
    const variance = gaps.reduce((s, g) => s + (g - mean) * (g - mean), 0) / gaps.length;
    const cv = Math.sqrt(variance) / mean;
    expect(result.gapCv).toBeCloseTo(cv, 10);
  });

  it("is order-independent (newest-first input equals oldest-first input)", () => {
    const ascending = commitsAt([
      "2026-01-01T00:00:00Z",
      "2026-01-02T06:00:00Z",
      "2026-01-04T12:00:00Z",
      "2026-01-05T00:00:00Z",
    ]);
    const descending = [...ascending].reverse();
    expect(computeCadence(descending)).toEqual(computeCadence(ascending));
  });

  it("treats unparseable dates as epoch zero deterministically", () => {
    const commits = commitsAt(["not-a-date", "1970-01-02T00:00:00Z"]);
    const result = computeCadence(commits);
    expect(result.spanDays).toBeCloseTo(1, 10);
    expect(result.commitsPerDay).toBeCloseTo(2, 10);
    expect(result.gapCv).toBe(0);
    expect(result.fRegularity).toBe(1);
  });
});
