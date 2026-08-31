import type { CommitDetail } from "@/lib/github/types";
import type { ChurnResult } from "@/lib/scoring/types";

export function bloatFactor(r: number): number {
  if (r < 0.15) return 0.4;
  if (r < 0.55) return 0.4 + (r - 0.15) * (0.6 / 0.4);
  if (r <= 0.8) return 1.0;
  if (r <= 0.95) return 1.0 - (r - 0.8) * (0.6 / 0.15);
  return 0.4;
}

export function computeChurn(commits: CommitDetail[]): ChurnResult {
  const n = commits.length;
  if (n === 0) {
    return {
      score: 0,
      additions: 0,
      deletions: 0,
      addRatio: 0,
      fBloat: 0,
      fRegen: 0,
      fAtomic: 0,
      avgCommitSize: 0,
    };
  }

  const additions = commits.reduce((sum, c) => sum + c.additions, 0);
  const deletions = commits.reduce((sum, c) => sum + c.deletions, 0);
  const addRatio = additions / Math.max(additions + deletions, 1);

  const fBloat = bloatFactor(addRatio);
  const fRegen = 1 - Math.min(deletions / Math.max(additions, 1), 1);
  const avgCommitSize = (additions + deletions) / n;
  const fAtomic =
    avgCommitSize <= 200
      ? 1
      : Math.max(0, 1 - (avgCommitSize - 200) / 800);

  const score = 100 * (0.5 * fBloat + 0.25 * fRegen + 0.25 * fAtomic);

  return {
    score,
    additions,
    deletions,
    addRatio,
    fBloat,
    fRegen,
    fAtomic,
    avgCommitSize,
  };
}
