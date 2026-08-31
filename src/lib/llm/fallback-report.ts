import type { AuditSnapshot } from "@/lib/llm/types";

function formatNumber(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}

function weakSubScoreItems(snapshot: AuditSnapshot): string[] {
  const entries: Array<{ name: "hygiene" | "churn" | "cadence" | "diversity"; value: number }> = [
    { name: "hygiene", value: snapshot.subScores.hygiene },
    { name: "churn", value: snapshot.subScores.churn },
    { name: "cadence", value: snapshot.subScores.cadence },
    { name: "diversity", value: snapshot.subScores.diversity },
  ];
  entries.sort((a, b) => a.value - b.value || a.name.localeCompare(b.name));
  const items: string[] = [];
  for (const entry of entries) {
    if (entry.value >= 60) {
      continue;
    }
    if (entry.name === "hygiene") {
      items.push(
        `Adopt conventional commit messages (feat:, fix:, chore:, …) with informative 16–72 character subjects — hygiene is currently ${formatNumber(snapshot.subScores.hygiene)}/100.`
      );
    } else if (entry.name === "churn") {
      items.push(
        `Rebalance change profiles toward the 55–80% additive band and keep average commit size under 200 lines (currently ${formatNumber(snapshot.churnDetail.avgCommitSize)} lines).`
      );
    } else if (entry.name === "cadence") {
      items.push(
        `Smooth the delivery cadence — steady commits outperform bursts. Current velocity is ${formatNumber(snapshot.cadenceDetail.commitsPerDay)} commits/day with gap variability ${formatNumber(snapshot.cadenceDetail.gapCv)}.`
      );
    } else {
      items.push(
        `Reduce bus-factor risk by onboarding additional contributors — only ${snapshot.authorCount} author(s) appear in this window.`
      );
    }
  }
  return items;
}

function anomalyItems(snapshot: AuditSnapshot): string[] {
  const items: string[] = [];
  const seen = new Set<string>();
  for (const anomaly of snapshot.anomalies) {
    if (seen.has(anomaly.type)) {
      continue;
    }
    seen.add(anomaly.type);
    if (anomaly.type === "MASSIVE_REWRITE") {
      items.push("Split commits over 1,000 lines changed into smaller, reviewable units.");
    } else if (anomaly.type === "HIGH_RISK_DELETION") {
      items.push("Guard deletions over 500 lines behind tests or staged rollouts.");
    } else if (anomaly.type === "TIER3_CLUSTER") {
      items.push(
        `Shrink high-risk commits (5+ files or 250+ lines) — they make up ${snapshot.tierCounts.tier3} of ${snapshot.commitCount} commits.`
      );
    } else if (anomaly.type === "SINGLE_OWNER_RISK") {
      items.push("Institute cross-review of single-owner work to spread knowledge.");
    }
  }
  return items;
}

function buildRecommendations(snapshot: AuditSnapshot): string[] {
  const items = [...weakSubScoreItems(snapshot), ...anomalyItems(snapshot)];
  if (items.length === 0) {
    return [
      `Sustain current practices — the repository scores ${Math.round(snapshot.score)}/100 with no structural risk signals.`,
    ];
  }
  return items.slice(0, 6);
}

export function buildFallbackReport(snapshot: AuditSnapshot): string {
  const score = Math.round(snapshot.score);
  const penalty = formatNumber(snapshot.anomalyPenalty);

  const riskSignals =
    snapshot.anomalies.length > 0
      ? snapshot.anomalies
          .slice(0, 5)
          .map((anomaly) => `- [${anomaly.type}] ${anomaly.description}`)
          .join("\n")
      : "- No anomalies detected in this window.";

  const recommendations = buildRecommendations(snapshot)
    .map((item, index) => `${index + 1}. ${item}`)
    .join("\n");

  return `# Executive Audit — ${snapshot.repoFullName}

**Heuristic-only mode:** this report was generated deterministically by the RepoPulse Lite scoring engine without an LLM. Add a provider key in Settings to unlock the full narrative audit.

## Health Score: ${score}/100 — ${snapshot.bandLabel}

- Commit window (last ${snapshot.commitCount} commits)
- Hygiene: ${formatNumber(snapshot.subScores.hygiene)}/100
- Churn: ${formatNumber(snapshot.subScores.churn)}/100
- Cadence: ${formatNumber(snapshot.subScores.cadence)}/100
- Diversity: ${formatNumber(snapshot.subScores.diversity)}/100
- Anomaly penalty: −${penalty} pts

## Tier Distribution

- Routine changes: ${snapshot.tierCounts.tier1}
- Moderate changes: ${snapshot.tierCounts.tier2}
- High-risk changes: ${snapshot.tierCounts.tier3}

## Top Risk Signals

${riskSignals}

## Prioritized Recommendations

${recommendations}
`;
}
