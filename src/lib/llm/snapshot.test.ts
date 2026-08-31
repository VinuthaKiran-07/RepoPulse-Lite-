import { describe, expect, it } from "vitest";
import { fixtureAnalyzeResponse } from "@/lib/test-fixtures";
import { buildAuditSnapshot, validateAuditSnapshot } from "@/lib/llm/snapshot";
import type { AnalyzeResponse } from "@/lib/api-types";
import type { AnomalyFlag } from "@/lib/scoring/types";

function makeAnomaly(index: number): AnomalyFlag {
  return {
    type: "MASSIVE_REWRITE",
    commitSha: `sha-${index}`,
    magnitude: 1500 + index,
    description: `Anomaly ${index}`,
  };
}

describe("buildAuditSnapshot", () => {
  it("maps the fixture response into a snapshot", () => {
    const snapshot = buildAuditSnapshot(fixtureAnalyzeResponse());
    expect(snapshot.repoFullName).toBe("octocat/hello-world");
    expect(snapshot.commitCount).toBe(1);
    expect(snapshot.score).toBe(72);
    expect(snapshot.bandLabel).toBe("Moderate");
    expect(snapshot.subScores).toEqual({
      hygiene: 85,
      churn: 70,
      cadence: 65,
      diversity: 6,
    });
    expect(snapshot.windowDays).toBe(1);
    expect(snapshot.tierCounts).toEqual({ tier1: 1, tier2: 0, tier3: 0 });
    expect(snapshot.authorCount).toBe(1);
    expect(snapshot.topAuthors).toEqual([{ name: "Dev One", commits: 1 }]);
    expect(snapshot.hygieneDetail).toEqual({ conventionalShare: 1, qualityMean: 1 });
    expect(snapshot.churnDetail).toEqual({ additions: 40, deletions: 10, avgCommitSize: 50 });
    expect(snapshot.cadenceDetail).toEqual({ commitsPerDay: 1, gapCv: 0 });
    expect(snapshot.diversityDetail).toEqual({ entropy: 0, normalizedEntropy: 0 });
  });

  it("caps anomalies at 10", () => {
    const data = fixtureAnalyzeResponse();
    data.metrics.anomaly.flags = Array.from({ length: 15 }, (_, i) => makeAnomaly(i));
    const snapshot = buildAuditSnapshot(data);
    expect(snapshot.anomalies).toHaveLength(10);
    expect(snapshot.anomalies[0].description).toBe("Anomaly 0");
    expect(snapshot.anomalies[9].description).toBe("Anomaly 9");
  });

  it("caps topAuthors at 5 sorted by commit count", () => {
    const data: AnalyzeResponse = fixtureAnalyzeResponse();
    data.authors = Array.from({ length: 8 }, (_, i) => ({
      login: `dev${i}`,
      name: `Dev ${i}`,
      commits: i,
      additions: 0,
      deletions: 0,
    }));
    data.authors.push({ login: "top", name: "Top Dev", commits: 99, additions: 0, deletions: 0 });
    const snapshot = buildAuditSnapshot(data);
    expect(snapshot.topAuthors).toHaveLength(5);
    expect(snapshot.topAuthors[0]).toEqual({ name: "Top Dev", commits: 99 });
    expect(snapshot.topAuthors[1]).toEqual({ name: "Dev 7", commits: 7 });
    expect(snapshot.topAuthors[4]).toEqual({ name: "Dev 4", commits: 4 });
  });

  it("falls back to the login when the author name is empty", () => {
    const data: AnalyzeResponse = fixtureAnalyzeResponse();
    data.authors = [{ login: "dev1", name: "", commits: 3, additions: 0, deletions: 0 }];
    const snapshot = buildAuditSnapshot(data);
    expect(snapshot.topAuthors).toEqual([{ name: "dev1", commits: 3 }]);
  });
});

describe("validateAuditSnapshot", () => {
  it("accepts a valid snapshot built from the fixture", () => {
    const snapshot = buildAuditSnapshot(fixtureAnalyzeResponse());
    const result = validateAuditSnapshot(snapshot);
    expect(result).toEqual({ ok: true, snapshot });
  });

  it("rejects non-object input", () => {
    const result = validateAuditSnapshot(null);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });

  it("rejects an out-of-range score", () => {
    const snapshot = buildAuditSnapshot(fixtureAnalyzeResponse());
    const result = validateAuditSnapshot({ ...snapshot, score: 101 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });

  it("rejects a non-numeric score", () => {
    const snapshot = buildAuditSnapshot(fixtureAnalyzeResponse());
    const result = validateAuditSnapshot({ ...snapshot, score: "82" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });

  it("rejects a missing subScores object", () => {
    const snapshot = buildAuditSnapshot(fixtureAnalyzeResponse());
    const result = validateAuditSnapshot({ ...snapshot, subScores: undefined });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });

  it("rejects an anomalies array with 11 entries", () => {
    const snapshot = buildAuditSnapshot(fixtureAnalyzeResponse());
    snapshot.anomalies = Array.from({ length: 11 }, (_, i) => ({
      type: "MASSIVE_REWRITE",
      commitSha: null,
      magnitude: 1,
      description: `Anomaly ${i}`,
    }));
    const result = validateAuditSnapshot(snapshot);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });

  it("rejects an oversized anomaly description", () => {
    const snapshot = buildAuditSnapshot(fixtureAnalyzeResponse());
    snapshot.anomalies = [
      {
        type: "MASSIVE_REWRITE",
        commitSha: null,
        magnitude: 1,
        description: "a".repeat(201),
      },
    ];
    const result = validateAuditSnapshot(snapshot);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });

  it("rejects negative tier counts", () => {
    const snapshot = buildAuditSnapshot(fixtureAnalyzeResponse());
    const result = validateAuditSnapshot({
      ...snapshot,
      tierCounts: { tier1: -1, tier2: 0, tier3: 0 },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });
});
