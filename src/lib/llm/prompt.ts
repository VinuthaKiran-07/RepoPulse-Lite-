import type { AuditSnapshot, ChatMessage } from "@/lib/llm/types";

export const AUDIT_TEMPERATURE = 0.2;

export function buildAuditMessages(snapshot: AuditSnapshot): ChatMessage[] {
  const systemContent =
    "You are a senior engineering auditor preparing an executive risk report for repository stakeholders. You will receive a deterministic JSON snapshot of repository health metrics computed by RepoPulse Lite. Respond with a markdown report containing exactly these sections: '## Executive Summary' (2-4 sentences of risk assessment), '## Metric Audit' (one short paragraph each for hygiene, churn, cadence, diversity, and the anomaly penalty, citing the provided numbers), and '## Prioritized Recommendations' (3-6 numbered items, ordered by expected impact). Ground every claim in the snapshot. Never invent commits, names, or events that are not present in the data. Output only the report — no preamble or closing remarks.";

  const ordered = {
    repoFullName: snapshot.repoFullName,
    commitCount: snapshot.commitCount,
    windowDays: snapshot.windowDays,
    score: snapshot.score,
    bandLabel: snapshot.bandLabel,
    subScores: {
      hygiene: snapshot.subScores.hygiene,
      churn: snapshot.subScores.churn,
      cadence: snapshot.subScores.cadence,
      diversity: snapshot.subScores.diversity,
    },
    anomalyPenalty: snapshot.anomalyPenalty,
    tierCounts: {
      tier1: snapshot.tierCounts.tier1,
      tier2: snapshot.tierCounts.tier2,
      tier3: snapshot.tierCounts.tier3,
    },
    anomalies: snapshot.anomalies.map((anomaly) => ({
      type: anomaly.type,
      commitSha: anomaly.commitSha,
      magnitude: anomaly.magnitude,
      description: anomaly.description,
    })),
    authorCount: snapshot.authorCount,
    topAuthors: snapshot.topAuthors.map((author) => ({
      name: author.name,
      commits: author.commits,
    })),
    hygieneDetail: {
      conventionalShare: snapshot.hygieneDetail.conventionalShare,
      qualityMean: snapshot.hygieneDetail.qualityMean,
    },
    churnDetail: {
      additions: snapshot.churnDetail.additions,
      deletions: snapshot.churnDetail.deletions,
      avgCommitSize: snapshot.churnDetail.avgCommitSize,
    },
    cadenceDetail: {
      commitsPerDay: snapshot.cadenceDetail.commitsPerDay,
      gapCv: snapshot.cadenceDetail.gapCv,
    },
    diversityDetail: {
      entropy: snapshot.diversityDetail.entropy,
      normalizedEntropy: snapshot.diversityDetail.normalizedEntropy,
    },
  };

  const userContent = `RepoPulse Lite health snapshot for ${snapshot.repoFullName} (computed from the last ${snapshot.commitCount} commits):

${JSON.stringify(ordered)}

Produce the executive audit report now.`;

  return [
    { role: "system", content: systemContent },
    { role: "user", content: userContent },
  ];
}
