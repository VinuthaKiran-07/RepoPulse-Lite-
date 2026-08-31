import { describe, it, expect } from "vitest";
import { computeAnomalies } from "@/lib/scoring/anomaly";
import { makeCommit, makeCommits } from "@/lib/scoring/test-fixtures";

describe("computeAnomalies", () => {
  it("returns zero penalty for empty input", () => {
    expect(computeAnomalies([])).toEqual({ penalty: 0, flags: [] });
  });

  it("flags massive atomic rewrites at +8", () => {
    const commits = [
      makeCommit({ sha: "big", additions: 600, deletions: 500 }),
      ...makeCommits(3, { additions: 10, deletions: 5, filesChanged: 1 }),
    ];
    const result = computeAnomalies(commits);
    expect(result.penalty).toBe(8);
    expect(result.flags).toHaveLength(1);
    expect(result.flags[0].type).toBe("MASSIVE_REWRITE");
    expect(result.flags[0].magnitude).toBe(1100);
    expect(result.flags[0].commitSha).toBe("big");
  });

  it("flags high-risk deletions at +4", () => {
    const commits = [
      makeCommit({ sha: "del", additions: 10, deletions: 501 }),
      ...makeCommits(3, { additions: 10, deletions: 5, filesChanged: 1 }),
    ];
    const result = computeAnomalies(commits);
    expect(result.penalty).toBe(4);
    expect(result.flags).toHaveLength(1);
    expect(result.flags[0].type).toBe("HIGH_RISK_DELETION");
  });

  it("does not flag deletions at exactly the 500 boundary", () => {
    const commits = [
      makeCommit({ sha: "edge", additions: 10, deletions: 500 }),
      ...makeCommits(3, { additions: 10, deletions: 5, filesChanged: 1 }),
    ];
    const result = computeAnomalies(commits);
    expect(result.penalty).toBe(0);
    expect(result.flags).toHaveLength(0);
  });

  it("stacks both flags when a rewrite is also deletion-heavy", () => {
    const commits = [
      makeCommit({ sha: "both", additions: 600, deletions: 600 }),
      ...makeCommits(3, { additions: 10, deletions: 5, filesChanged: 1 }),
    ];
    const result = computeAnomalies(commits);
    expect(result.penalty).toBe(12);
    expect(result.flags.map((f) => f.type)).toEqual(["MASSIVE_REWRITE", "HIGH_RISK_DELETION"]);
  });

  it("flags tier-3 clusters above 40 percent share", () => {
    const commits = makeCommits(5, { additions: 300, deletions: 0, filesChanged: 2 });
    const result = computeAnomalies(commits);
    expect(result.penalty).toBe(10);
    expect(result.flags).toHaveLength(1);
    expect(result.flags[0].type).toBe("TIER3_CLUSTER");
    expect(result.flags[0].magnitude).toBe(5);
  });

  it("does not flag a tier-3 cluster at exactly 40 percent", () => {
    const commits = [
      ...makeCommits(2, { additions: 300, deletions: 0 }),
      ...makeCommits(3, { additions: 10, deletions: 0 }),
    ];
    const result = computeAnomalies(commits);
    expect(result.penalty).toBe(0);
    expect(result.flags).toHaveLength(0);
  });

  it("flags chronic single-owner risk at 20+ commits", () => {
    const result = computeAnomalies(makeCommits(20, { additions: 10, deletions: 0 }));
    expect(result.penalty).toBe(3);
    expect(result.flags).toHaveLength(1);
    expect(result.flags[0].type).toBe("SINGLE_OWNER_RISK");
    expect(result.flags[0].magnitude).toBe(20);
  });

  it("does not flag single-owner risk below 20 commits", () => {
    const result = computeAnomalies(makeCommits(19, { additions: 10, deletions: 0 }));
    expect(result.penalty).toBe(0);
    expect(result.flags).toHaveLength(0);
  });

  it("caps the total penalty at 20", () => {
    const commits = [
      makeCommit({ sha: "a", additions: 2000, deletions: 0, filesChanged: 1 }),
      makeCommit({ sha: "b", additions: 2000, deletions: 0, filesChanged: 1 }),
      makeCommit({ sha: "c", additions: 2000, deletions: 0, filesChanged: 1 }),
      ...makeCommits(5, { additions: 5, deletions: 5, filesChanged: 1 }),
    ];
    const result = computeAnomalies(commits);
    expect(result.penalty).toBe(20);
    expect(result.flags).toHaveLength(3);
    expect(result.flags.every((f) => f.type === "MASSIVE_REWRITE")).toBe(true);
  });

  it("orders flags deterministically: per-commit, cluster, single-owner", () => {
    const commits = [
      ...makeCommits(21, { additions: 10, deletions: 5, filesChanged: 1, authorLogin: "solo", authorEmail: "solo@example.com", authorName: "solo" }),
      makeCommit({ sha: "big", additions: 1200, deletions: 700, filesChanged: 1, authorLogin: "solo", authorEmail: "solo@example.com", authorName: "solo" }),
    ];
    const result = computeAnomalies(commits);
    expect(result.flags.map((f) => f.type)).toEqual([
      "MASSIVE_REWRITE",
      "HIGH_RISK_DELETION",
      "SINGLE_OWNER_RISK",
    ]);
  });
});
