import type { CommitDetail } from "@/lib/github/types";
import type { CommitTier, TierClassification } from "@/lib/scoring/types";

export const CONVENTIONAL_TYPE_PATTERN =
  /^(feat|fix|refactor|docs|chore|test|style|perf|build|ci|revert)(\(.+\))?!?:/;

export function conventionalTypeOf(message: string): string | null {
  const subject = message.split("\n")[0].trim();
  const match = subject.match(CONVENTIONAL_TYPE_PATTERN);
  if (match === null) {
    return null;
  }
  const rest = subject.slice(match[0].length);
  if (rest.trim().length === 0) {
    return null;
  }
  return match[1];
}

export function isConventional(message: string): boolean {
  return conventionalTypeOf(message) !== null;
}

function isDocsOrChore(message: string): boolean {
  const type = conventionalTypeOf(message);
  return type === "docs" || type === "chore";
}

export function classifyCommit(commit: CommitDetail): TierClassification {
  const linesChanged = commit.additions + commit.deletions;
  const filesChanged = commit.filesChanged;
  const tier: CommitTier = (() => {
    if (linesChanged < 50 || isDocsOrChore(commit.message)) {
      return 1;
    }
    if (linesChanged > 250 || filesChanged >= 5) {
      return 3;
    }
    return 2;
  })();
  return {
    sha: commit.sha,
    tier,
    linesChanged,
    filesChanged,
    isConventionalType: conventionalTypeOf(commit.message) !== null,
  };
}

export function classifyCommits(commits: CommitDetail[]): TierClassification[] {
  return commits.map(classifyCommit);
}

export function tierDistribution(commits: CommitDetail[]): {
  tier1: number;
  tier2: number;
  tier3: number;
} {
  const distribution = { tier1: 0, tier2: 0, tier3: 0 };
  for (const classification of classifyCommits(commits)) {
    if (classification.tier === 1) {
      distribution.tier1 += 1;
    } else if (classification.tier === 2) {
      distribution.tier2 += 1;
    } else {
      distribution.tier3 += 1;
    }
  }
  return distribution;
}
