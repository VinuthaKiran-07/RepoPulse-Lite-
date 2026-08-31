import type { CommitDetail } from "@/lib/github/types";
import type { AnomalyFlag, AnomalyResult } from "@/lib/scoring/types";
import { tierDistribution } from "@/lib/scoring/tier-classifier";

function authorKey(commit: CommitDetail): string {
  const key = commit.authorLogin ?? commit.authorEmail ?? commit.authorName;
  return key.length > 0 ? key : "unknown";
}

export function computeAnomalies(commits: CommitDetail[]): AnomalyResult {
  if (commits.length === 0) {
    return { penalty: 0, flags: [] };
  }

  let penalty = 0;
  const flags: AnomalyFlag[] = [];
  const authors = new Set<string>();

  for (const commit of commits) {
    authors.add(authorKey(commit));
    const linesChanged = commit.additions + commit.deletions;
    if (linesChanged > 1000) {
      penalty += 8;
      flags.push({
        type: "MASSIVE_REWRITE",
        commitSha: commit.sha,
        magnitude: linesChanged,
        description: `${linesChanged} lines changed in a single commit`,
      });
    }
    if (commit.deletions > 500) {
      penalty += 4;
      flags.push({
        type: "HIGH_RISK_DELETION",
        commitSha: commit.sha,
        magnitude: commit.deletions,
        description: `${commit.deletions} deletions in a single commit`,
      });
    }
  }

  const n = commits.length;
  const { tier3 } = tierDistribution(commits);
  if (n > 0 && tier3 > 0 && tier3 / n > 0.4) {
    penalty += 2 * tier3;
    const pct = Math.round((tier3 / n) * 100);
    flags.push({
      type: "TIER3_CLUSTER",
      commitSha: null,
      magnitude: tier3,
      description: `${tier3} of ${n} commits are high-risk (Tier 3) — ${pct}% of window`,
    });
  }

  if (authors.size === 1 && n >= 20) {
    penalty += 3;
    flags.push({
      type: "SINGLE_OWNER_RISK",
      commitSha: null,
      magnitude: n,
      description: `all ${n} commits authored by a single contributor`,
    });
  }

  return { penalty: Math.round(Math.min(penalty, 20)), flags };
}
