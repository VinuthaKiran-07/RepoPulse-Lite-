import { describe, it, expect } from "vitest";
import { commitQuality, computeHygiene } from "@/lib/scoring/hygiene";
import { makeCommit } from "@/lib/scoring/test-fixtures";

describe("commitQuality", () => {
  it("scores well-formed subjects as 1.0", () => {
    expect(commitQuality("feat: add user authentication flow")).toBe(1);
    expect(commitQuality("a subject of exactly good length here")).toBe(1);
  });

  it("scores vague subjects as 0", () => {
    expect(commitQuality("wip")).toBe(0);
    expect(commitQuality("WIP.")).toBe(0);
    expect(commitQuality("fix")).toBe(0);
    expect(commitQuality("update")).toBe(0);
    expect(commitQuality("minor")).toBe(0);
    expect(commitQuality("test")).toBe(0);
    expect(commitQuality("fix #123")).toBe(0);
    expect(commitQuality("update code")).toBe(0);
    expect(commitQuality("asdf")).toBe(0);
    expect(commitQuality("test123")).toBe(0);
  });

  it("scores short non-vague subjects in the 0.5 band", () => {
    expect(commitQuality("docs: update")).toBe(0.5);
    expect(commitQuality("fix bug now")).toBe(0.5);
  });

  it("scores overly long subjects in the 0.5 band then 0.25", () => {
    expect(commitQuality("x".repeat(120))).toBe(0.5);
    expect(commitQuality("x".repeat(121))).toBe(0.25);
    expect(commitQuality("y".repeat(73))).toBe(0.5);
  });

  it("scores sub-8-char non-vague subjects as 0.25", () => {
    expect(commitQuality("fix bug")).toBe(0.25);
    expect(commitQuality("abc def")).toBe(0.25);
  });
});

describe("computeHygiene", () => {
  it("returns zeros for empty input", () => {
    expect(computeHygiene([])).toEqual({ score: 0, conventionalShare: 0, qualityMean: 0 });
  });

  it("scores all-conventional informative commits at 100", () => {
    const commits = [
      makeCommit({ message: "feat: add user authentication flow" }),
      makeCommit({ message: "fix: handle empty repository response" }),
    ];
    const result = computeHygiene(commits);
    expect(result.score).toBe(100);
    expect(result.conventionalShare).toBe(1);
    expect(result.qualityMean).toBe(1);
  });

  it("computes the hybrid mean for mixed commits", () => {
    const commits = [
      makeCommit({ message: "feat: add user authentication flow" }),
      makeCommit({ message: "fix: handle empty repository response" }),
      makeCommit({ message: "wip" }),
    ];
    const result = computeHygiene(commits);
    expect(result.conventionalShare).toBeCloseTo(2 / 3, 10);
    expect(result.qualityMean).toBeCloseTo(2 / 3, 10);
    expect(result.score).toBeCloseTo((100 * (0.6 * 2 + 0.4 * 2)) / 3, 10);
  });

  it("scores a vague non-conventional window at 0", () => {
    const commits = [
      makeCommit({ message: "wip" }),
      makeCommit({ message: "fix" }),
    ];
    expect(computeHygiene(commits).score).toBe(0);
  });

  it("counts conventional share independently of quality", () => {
    const commits = [
      makeCommit({ message: "feat: ok" }),
      makeCommit({ message: "random long commit message here" }),
    ];
    const result = computeHygiene(commits);
    expect(result.conventionalShare).toBe(0.5);
    expect(result.qualityMean).toBe(0.75);
    expect(result.score).toBeCloseTo(100 * (0.6 * 1 + 0.4 * 0.5 + 0.6 * 0 + 0.4 * 1) / 2, 10);
    expect(result.score).toBeCloseTo(60, 10);
  });
});
