import { describe, it, expect } from "vitest";
import { computeDiversity } from "@/lib/scoring/diversity";
import type { CommitDetail } from "@/lib/github/types";
import { makeCommit } from "@/lib/scoring/test-fixtures";

function byAuthors(spec: Array<{ login: string; count: number }>): CommitDetail[] {
  const commits: CommitDetail[] = [];
  for (const { login, count } of spec) {
    for (let i = 0; i < count; i += 1) {
      commits.push(
        makeCommit({
          sha: `${login}-${i}`,
          authorLogin: login,
          authorName: login,
          authorEmail: `${login}@example.com`,
        })
      );
    }
  }
  return commits;
}

describe("computeDiversity", () => {
  it("returns zeros for empty input", () => {
    expect(computeDiversity([])).toEqual({
      score: 0,
      authorCount: 0,
      entropy: 0,
      normalizedEntropy: 0,
      teamSizeTerm: 0,
    });
  });

  it("scores a single author near zero", () => {
    const result = computeDiversity(byAuthors([{ login: "solo", count: 25 }]));
    expect(result.authorCount).toBe(1);
    expect(result.entropy).toBe(0);
    expect(result.normalizedEntropy).toBe(0);
    expect(result.teamSizeTerm).toBeCloseTo(1 / 5, 10);
    expect(result.score).toBeCloseTo(100 * (0.7 * 0 + 0.3 * 0.2), 10);
    expect(result.score).toBeCloseTo(6, 10);
  });

  it("scores five evenly-active authors at 100", () => {
    const result = computeDiversity(
      byAuthors([
        { login: "a1", count: 4 },
        { login: "a2", count: 4 },
        { login: "a3", count: 4 },
        { login: "a4", count: 4 },
        { login: "a5", count: 4 },
      ])
    );
    expect(result.authorCount).toBe(5);
    expect(result.entropy).toBeCloseTo(Math.log2(5), 10);
    expect(result.normalizedEntropy).toBeCloseTo(1, 10);
    expect(result.teamSizeTerm).toBe(1);
    expect(result.score).toBeCloseTo(100, 10);
  });

  it("scores two balanced authors at 82", () => {
    const result = computeDiversity(
      byAuthors([
        { login: "a", count: 10 },
        { login: "b", count: 10 },
      ])
    );
    expect(result.authorCount).toBe(2);
    expect(result.entropy).toBeCloseTo(1, 10);
    expect(result.normalizedEntropy).toBeCloseTo(1, 10);
    expect(result.teamSizeTerm).toBeCloseTo(0.4, 10);
    expect(result.score).toBeCloseTo(100 * (0.7 * 1 + 0.3 * 0.4), 10);
    expect(result.score).toBeCloseTo(82, 10);
  });

  it("penalizes skewed author distributions", () => {
    const result = computeDiversity(byAuthors([{ login: "a", count: 19 }, { login: "b", count: 1 }]));
    expect(result.authorCount).toBe(2);
    const h = -(0.95 * Math.log2(0.95) + 0.05 * Math.log2(0.05));
    expect(result.entropy).toBeCloseTo(h, 10);
    expect(result.normalizedEntropy).toBeCloseTo(h / Math.log2(2), 10);
    expect(result.score).toBeCloseTo(100 * (0.7 * (h / Math.log2(2)) + 0.3 * 0.4), 10);
    expect(result.score).toBeLessThan(35);
  });

  it("falls back to email identity when login is absent", () => {
    const commits = [
      makeCommit({ authorLogin: null, authorEmail: "shared@example.com" }),
      makeCommit({ authorLogin: null, authorEmail: "shared@example.com" }),
      makeCommit({ authorLogin: null, authorEmail: "other@example.com" }),
      makeCommit({ authorLogin: null, authorEmail: "other@example.com" }),
    ];
    const result = computeDiversity(commits);
    expect(result.authorCount).toBe(2);
    expect(result.entropy).toBeCloseTo(1, 10);
  });

  it("collapses empty identities to a single unknown author", () => {
    const commits = [
      makeCommit({ authorLogin: null, authorEmail: "", authorName: "" }),
      makeCommit({ authorLogin: null, authorEmail: "", authorName: "" }),
    ];
    const result = computeDiversity(commits);
    expect(result.authorCount).toBe(1);
    expect(result.score).toBeCloseTo(100 * (0.3 * (1 / 5)), 10);
  });
});
