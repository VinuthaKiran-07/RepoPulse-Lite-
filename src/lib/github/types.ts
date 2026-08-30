export interface RepoMeta {
  owner: string;
  repo: string;
  fullName: string;
  description: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  language: string | null;
  defaultBranch: string;
  pushedAt: string | null;
  isPrivate: boolean;
}

export interface CommitDetail {
  sha: string;
  message: string;
  authorName: string;
  authorLogin: string | null;
  authorEmail: string | null;
  authorDate: string;
  filesChanged: number;
  additions: number;
  deletions: number;
}

export interface RepoTelemetry {
  meta: RepoMeta;
  commits: CommitDetail[];
  fetchedAt: string;
  rateLimit: { remaining: number; limit: number; resetEpochSeconds: number } | null;
}

export interface AuthorStat {
  login: string;
  name: string;
  commits: number;
  additions: number;
  deletions: number;
}
