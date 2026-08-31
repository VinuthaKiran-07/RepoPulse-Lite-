import type { CommitDetail } from "@/lib/github/types";
import type { DiversityResult } from "@/lib/scoring/types";

export function computeDiversity(commits: CommitDetail[]): DiversityResult {
  if (commits.length === 0) {
    return {
      score: 0,
      authorCount: 0,
      entropy: 0,
      normalizedEntropy: 0,
      teamSizeTerm: 0,
    };
  }

  const countsByKey = new Map<string, number>();
  for (const commit of commits) {
    const identity =
      commit.authorLogin ?? commit.authorEmail ?? commit.authorName;
    const key = identity.length > 0 ? identity : "unknown";
    const existing = countsByKey.get(key);
    if (existing === undefined) {
      countsByKey.set(key, 1);
    } else {
      countsByKey.set(key, existing + 1);
    }
  }

  const n = commits.length;
  const k = countsByKey.size;

  let entropy = 0;
  for (const count of countsByKey.values()) {
    const p = count / n;
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }

  const normalizedEntropy = entropy / Math.log2(Math.max(k, 2));
  const teamSizeTerm = Math.min(Math.max(k / 5, 0), 1);
  const score = 100 * (0.7 * normalizedEntropy + 0.3 * teamSizeTerm);

  return {
    score,
    authorCount: k,
    entropy,
    normalizedEntropy,
    teamSizeTerm,
  };
}
