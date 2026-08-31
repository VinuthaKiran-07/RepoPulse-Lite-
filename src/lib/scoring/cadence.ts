import type { CommitDetail } from "@/lib/github/types";
import type { CadenceResult } from "@/lib/scoring/types";

export function computeCadence(commits: CommitDetail[]): CadenceResult {
  if (commits.length === 0) {
    return {
      score: 0,
      spanDays: 0,
      commitsPerDay: 0,
      fFreq: 0,
      gapCv: 0,
      fRegularity: 0,
    };
  }

  const timestamps = commits
    .map((c) => {
      const t = new Date(c.authorDate).getTime();
      return Number.isNaN(t) ? 0 : t;
    })
    .sort((a, b) => a - b);

  const n = timestamps.length;
  const oldest = timestamps[0];
  const latest = timestamps[n - 1];
  const spanDays = Math.max((latest - oldest) / 86400000, 1);

  const commitsPerDay = n / spanDays;
  const fFreq = 2 / (1 + Math.exp(-2 * (commitsPerDay - 1.2)));

  let gapCv = 0;
  let fRegularity = 1;

  if (n >= 2) {
    const gaps = timestamps.slice(1).map((t, i) => (t - timestamps[i]) / 3600000);
    const mean = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    if (mean === 0) {
      gapCv = 0;
    } else {
      const variance =
        gaps.reduce((s, g) => s + (g - mean) * (g - mean), 0) / gaps.length;
      const std = Math.sqrt(variance);
      gapCv = std / mean;
    }
    fRegularity = Math.min(Math.max(1 - gapCv / 2, 0), 1);
  }

  const score = 100 * (0.6 * fFreq + 0.4 * fRegularity);

  return {
    score,
    spanDays,
    commitsPerDay,
    fFreq,
    gapCv,
    fRegularity,
  };
}
