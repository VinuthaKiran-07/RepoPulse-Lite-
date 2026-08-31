import type { AnalyzeResponse } from "@/lib/api-types";
import type { AuditSnapshot } from "@/lib/llm/types";

export function buildAuditSnapshot(data: AnalyzeResponse): AuditSnapshot {
  return {
    repoFullName: data.repo.fullName,
    commitCount: data.commits.length,
    windowDays: data.metrics.cadence.spanDays,
    score: data.score,
    bandLabel: data.band.label,
    subScores: {
      hygiene: data.metrics.hygiene.score,
      churn: data.metrics.churn.score,
      cadence: data.metrics.cadence.score,
      diversity: data.metrics.diversity.score,
    },
    anomalyPenalty: data.metrics.anomaly.penalty,
    tierCounts: {
      tier1: data.tiers.tier1,
      tier2: data.tiers.tier2,
      tier3: data.tiers.tier3,
    },
    anomalies: data.metrics.anomaly.flags.slice(0, 10).map((flag) => ({
      type: flag.type,
      commitSha: flag.commitSha,
      magnitude: flag.magnitude,
      description: flag.description,
    })),
    authorCount: data.metrics.diversity.authorCount,
    topAuthors: [...data.authors]
      .sort((a, b) => b.commits - a.commits)
      .slice(0, 5)
      .map((author) => ({
        name: author.name || author.login,
        commits: author.commits,
      })),
    hygieneDetail: {
      conventionalShare: data.metrics.hygiene.conventionalShare,
      qualityMean: data.metrics.hygiene.qualityMean,
    },
    churnDetail: {
      additions: data.metrics.churn.additions,
      deletions: data.metrics.churn.deletions,
      avgCommitSize: data.metrics.churn.avgCommitSize,
    },
    cadenceDetail: {
      commitsPerDay: data.metrics.cadence.commitsPerDay,
      gapCv: data.metrics.cadence.gapCv,
    },
    diversityDetail: {
      entropy: data.metrics.diversity.entropy,
      normalizedEntropy: data.metrics.diversity.normalizedEntropy,
    },
  };
}

export function validateAuditSnapshot(
  input: unknown
): { ok: true; snapshot: AuditSnapshot } | { ok: false; reason: string } {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, reason: "snapshot must be a non-null object" };
  }
  const candidate = input as Record<string, unknown>;

  const repoFullName = candidate.repoFullName;
  if (
    typeof repoFullName !== "string" ||
    repoFullName.length < 1 ||
    repoFullName.length > 200
  ) {
    return {
      ok: false,
      reason: "repoFullName must be a string between 1 and 200 characters",
    };
  }

  const commitCount = candidate.commitCount;
  if (
    typeof commitCount !== "number" ||
    !Number.isInteger(commitCount) ||
    commitCount < 0
  ) {
    return { ok: false, reason: "commitCount must be an integer >= 0" };
  }

  const windowDays = candidate.windowDays;
  if (
    typeof windowDays !== "number" ||
    !Number.isFinite(windowDays) ||
    windowDays < 0
  ) {
    return { ok: false, reason: "windowDays must be a finite number >= 0" };
  }

  const score = candidate.score;
  if (
    typeof score !== "number" ||
    !Number.isFinite(score) ||
    score < 0 ||
    score > 100
  ) {
    return { ok: false, reason: "score must be a finite number in [0,100]" };
  }

  const bandLabel = candidate.bandLabel;
  if (
    typeof bandLabel !== "string" ||
    bandLabel.length < 1 ||
    bandLabel.length > 50
  ) {
    return {
      ok: false,
      reason: "bandLabel must be a string between 1 and 50 characters",
    };
  }

  const rawSubScores = candidate.subScores;
  if (typeof rawSubScores !== "object" || rawSubScores === null) {
    return { ok: false, reason: "subScores must be an object" };
  }
  const subScoresRecord = rawSubScores as Record<string, unknown>;
  for (const key of ["hygiene", "churn", "cadence", "diversity"]) {
    const value = subScoresRecord[key];
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > 100
    ) {
      return {
        ok: false,
        reason: `subScores.${key} must be a finite number in [0,100]`,
      };
    }
  }

  const anomalyPenalty = candidate.anomalyPenalty;
  if (
    typeof anomalyPenalty !== "number" ||
    !Number.isFinite(anomalyPenalty) ||
    anomalyPenalty < 0 ||
    anomalyPenalty > 20
  ) {
    return {
      ok: false,
      reason: "anomalyPenalty must be a finite number in [0,20]",
    };
  }

  const rawTierCounts = candidate.tierCounts;
  if (typeof rawTierCounts !== "object" || rawTierCounts === null) {
    return { ok: false, reason: "tierCounts must be an object" };
  }
  const tierCountsRecord = rawTierCounts as Record<string, unknown>;
  for (const key of ["tier1", "tier2", "tier3"]) {
    const value = tierCountsRecord[key];
    if (
      typeof value !== "number" ||
      !Number.isInteger(value) ||
      value < 0
    ) {
      return { ok: false, reason: `tierCounts.${key} must be an integer >= 0` };
    }
  }

  const rawAnomalies = candidate.anomalies;
  if (!Array.isArray(rawAnomalies) || rawAnomalies.length > 10) {
    return {
      ok: false,
      reason: "anomalies must be an array with at most 10 items",
    };
  }
  for (const anomaly of rawAnomalies) {
    if (typeof anomaly !== "object" || anomaly === null) {
      return { ok: false, reason: "each anomaly must be a non-null object" };
    }
    const anomalyRecord = anomaly as Record<string, unknown>;
    const type = anomalyRecord.type;
    if (typeof type !== "string" || type.length > 40) {
      return {
        ok: false,
        reason: "anomaly.type must be a string of at most 40 characters",
      };
    }
    const commitSha = anomalyRecord.commitSha;
    if (commitSha !== null && (typeof commitSha !== "string" || commitSha.length > 40)) {
      return {
        ok: false,
        reason: "anomaly.commitSha must be null or a string of at most 40 characters",
      };
    }
    const magnitude = anomalyRecord.magnitude;
    if (typeof magnitude !== "number" || !Number.isFinite(magnitude) || magnitude < 0) {
      return {
        ok: false,
        reason: "anomaly.magnitude must be a finite number >= 0",
      };
    }
    const description = anomalyRecord.description;
    if (typeof description !== "string" || description.length > 200) {
      return {
        ok: false,
        reason: "anomaly.description must be a string of at most 200 characters",
      };
    }
  }

  const authorCount = candidate.authorCount;
  if (
    typeof authorCount !== "number" ||
    !Number.isInteger(authorCount) ||
    authorCount < 0
  ) {
    return { ok: false, reason: "authorCount must be an integer >= 0" };
  }

  const rawTopAuthors = candidate.topAuthors;
  if (!Array.isArray(rawTopAuthors) || rawTopAuthors.length > 5) {
    return {
      ok: false,
      reason: "topAuthors must be an array with at most 5 items",
    };
  }
  for (const author of rawTopAuthors) {
    if (typeof author !== "object" || author === null) {
      return { ok: false, reason: "each top author must be a non-null object" };
    }
    const authorRecord = author as Record<string, unknown>;
    const name = authorRecord.name;
    if (typeof name !== "string" || name.length > 100) {
      return {
        ok: false,
        reason: "top author name must be a string of at most 100 characters",
      };
    }
    const commits = authorRecord.commits;
    if (typeof commits !== "number" || !Number.isInteger(commits) || commits < 0) {
      return {
        ok: false,
        reason: "top author commits must be an integer >= 0",
      };
    }
  }

  const detailSpecs: Array<[string, string[]]> = [
    ["hygieneDetail", ["conventionalShare", "qualityMean"]],
    ["churnDetail", ["additions", "deletions", "avgCommitSize"]],
    ["cadenceDetail", ["commitsPerDay", "gapCv"]],
    ["diversityDetail", ["entropy", "normalizedEntropy"]],
  ];
  for (const [detailKey, valueKeys] of detailSpecs) {
    const rawDetail = candidate[detailKey];
    if (typeof rawDetail !== "object" || rawDetail === null) {
      return { ok: false, reason: `${detailKey} must be an object` };
    }
    const detailRecord = rawDetail as Record<string, unknown>;
    for (const valueKey of valueKeys) {
      const value = detailRecord[valueKey];
      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        Math.abs(value) > 1e9
      ) {
        return {
          ok: false,
          reason: `${detailKey}.${valueKey} must be a finite number with absolute value <= 1e9`,
        };
      }
    }
  }

  return { ok: true, snapshot: input as AuditSnapshot };
}
