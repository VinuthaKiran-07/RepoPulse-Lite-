import type { CommitDetail } from "@/lib/github/types";

export function makeCommit(overrides: Partial<CommitDetail> = {}): CommitDetail {
  return {
    sha: "abc123",
    message: "feat: add user authentication flow",
    authorName: "Dev One",
    authorLogin: "dev1",
    authorEmail: "dev1@example.com",
    authorDate: "2026-01-01T00:00:00Z",
    filesChanged: 2,
    additions: 40,
    deletions: 10,
    ...overrides,
  };
}

export function makeCommits(count: number, overrides: Partial<CommitDetail> = {}): CommitDetail[] {
  return Array.from({ length: count }, (_, i) =>
    makeCommit({ sha: `sha${i}`, ...overrides })
  );
}

export function spacedDates(count: number, intervalHours: number, startIso = "2026-01-01T00:00:00Z"): string[] {
  const start = new Date(startIso).getTime();
  return Array.from(
    { length: count },
    (_, i) => new Date(start + i * intervalHours * 3600000).toISOString()
  );
}
