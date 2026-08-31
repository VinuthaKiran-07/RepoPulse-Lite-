import type { CommitDetail } from "@/lib/github/types";
import type { HygieneResult } from "@/lib/scoring/types";
import { isConventional } from "./tier-classifier";

const VAGUE_SUBJECTS = new Set([
  "wip",
  "fix",
  "fixes",
  "fixed",
  "update",
  "updates",
  "updated",
  "stuff",
  "misc",
  "minor",
  "asdf",
  "test123",
  "update code",
  "changes",
  "test",
]);

const BARE_FIX_PATTERN = /^fix(?:es|ed)?(?: #\d+)?$/;

function isVagueSubject(subject: string): boolean {
  const normalized = subject
    .trim()
    .toLowerCase()
    .replace(/\.+$/, "")
    .trim();
  if (VAGUE_SUBJECTS.has(normalized)) {
    return true;
  }
  if (BARE_FIX_PATTERN.test(normalized)) {
    return true;
  }
  if (!/\s/.test(normalized) && normalized.length <= 6) {
    return true;
  }
  return false;
}

export function commitQuality(message: string): number {
  const subject = message.split("\n")[0].trim();
  if (isVagueSubject(subject)) {
    return 0;
  }
  const len = subject.length;
  if (len >= 16 && len <= 72) {
    return 1;
  }
  if ((len >= 8 && len < 16) || (len > 72 && len <= 120)) {
    return 0.5;
  }
  return 0.25;
}

export function computeHygiene(commits: CommitDetail[]): HygieneResult {
  if (commits.length === 0) {
    return { score: 0, conventionalShare: 0, qualityMean: 0 };
  }
  let conventionalCount = 0;
  let qualitySum = 0;
  let hybridSum = 0;
  for (const commit of commits) {
    const conventional = isConventional(commit.message);
    const quality = commitQuality(commit.message);
    if (conventional) {
      conventionalCount += 1;
    }
    qualitySum += quality;
    hybridSum += 0.6 * (conventional ? 1 : 0) + 0.4 * quality;
  }
  const n = commits.length;
  return {
    score: (100 * hybridSum) / n,
    conventionalShare: conventionalCount / n,
    qualityMean: qualitySum / n,
  };
}
