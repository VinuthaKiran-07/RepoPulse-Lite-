import { describe, it, expect } from "vitest";
import {
  classifyCommit,
  classifyCommits,
  conventionalTypeOf,
  isConventional,
  tierDistribution,
} from "@/lib/scoring/tier-classifier";
import { makeCommit, makeCommits } from "@/lib/scoring/test-fixtures";

describe("conventionalTypeOf", () => {
  it("extracts the conventional type", () => {
    expect(conventionalTypeOf("feat: add login")).toBe("feat");
    expect(conventionalTypeOf("fix(auth): null check")).toBe("fix");
    expect(conventionalTypeOf("chore!: drop legacy hook")).toBe("chore");
  });

  it("rejects non-conventional subjects", () => {
    expect(conventionalTypeOf("Fix: capital type")).toBeNull();
    expect(conventionalTypeOf("feat:")).toBeNull();
    expect(conventionalTypeOf("feat:   ")).toBeNull();
    expect(conventionalTypeOf("not a conventional message")).toBeNull();
    expect(conventionalTypeOf("feature: add login")).toBeNull();
  });

  it("reads only the first line of multi-line messages", () => {
    expect(conventionalTypeOf("feat: subject line\n\nbody text")).toBe("feat");
  });

  it("isConventional mirrors conventionalTypeOf", () => {
    expect(isConventional("refactor(db): split pool")).toBe(true);
    expect(isConventional("refactor db pool")).toBe(false);
  });
});

describe("classifyCommit", () => {
  it("classifies small commits as tier 1", () => {
    expect(classifyCommit(makeCommit({ additions: 20, deletions: 9 })).tier).toBe(1);
    expect(classifyCommit(makeCommit({ additions: 25, deletions: 24 })).tier).toBe(1);
  });

  it("docs and chore commits are tier 1 regardless of size", () => {
    const docs = classifyCommit(makeCommit({ message: "docs: update readme", additions: 9000, deletions: 500 }));
    expect(docs.tier).toBe(1);
    const chore = classifyCommit(makeCommit({ message: "chore(deps): bump all", additions: 500, deletions: 500 }));
    expect(chore.tier).toBe(1);
  });

  it("classifies 50-250 line commits with few files as tier 2", () => {
    expect(classifyCommit(makeCommit({ additions: 50, deletions: 0, filesChanged: 1 })).tier).toBe(2);
    expect(classifyCommit(makeCommit({ additions: 125, deletions: 125, filesChanged: 4 })).tier).toBe(2);
    expect(classifyCommit(makeCommit({ additions: 250, deletions: 0, filesChanged: 4 })).tier).toBe(2);
  });

  it("classifies over-250-line or 5-file commits as tier 3", () => {
    expect(classifyCommit(makeCommit({ additions: 251, deletions: 0, filesChanged: 1 })).tier).toBe(3);
    expect(classifyCommit(makeCommit({ additions: 50, deletions: 0, filesChanged: 5 })).tier).toBe(3);
  });

  it("reports linesChanged, filesChanged and conventional flag", () => {
    const c = classifyCommit(makeCommit({ additions: 60, deletions: 20, filesChanged: 3 }));
    expect(c.linesChanged).toBe(80);
    expect(c.filesChanged).toBe(3);
    expect(c.isConventionalType).toBe(true);
    expect(c.sha).toBe("abc123");
  });
});

describe("classifyCommits", () => {
  it("preserves input order", () => {
    const commits = [
      makeCommit({ sha: "a", additions: 10 }),
      makeCommit({ sha: "b", additions: 300 }),
      makeCommit({ sha: "c", message: "docs: tweak", additions: 60 }),
    ];
    const result = classifyCommits(commits);
    expect(result.map((r) => r.sha)).toEqual(["a", "b", "c"]);
    expect(result.map((r) => r.tier)).toEqual([1, 3, 1]);
  });
});

describe("tierDistribution", () => {
  it("counts commits per tier", () => {
    const commits = [
      ...makeCommits(3, { additions: 10, deletions: 5 }),
      ...makeCommits(2, { additions: 100, deletions: 50 }),
      ...makeCommits(1, { additions: 400, deletions: 0 }),
    ];
    expect(tierDistribution(commits)).toEqual({ tier1: 3, tier2: 2, tier3: 1 });
  });

  it("returns zeros for empty input", () => {
    expect(tierDistribution([])).toEqual({ tier1: 0, tier2: 0, tier3: 0 });
  });
});
