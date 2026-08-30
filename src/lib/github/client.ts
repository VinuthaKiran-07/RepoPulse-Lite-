import { GithubError, toGithubError } from "@/lib/github/errors";
import type {
  AuthorStat,
  CommitDetail,
  RepoMeta,
  RepoTelemetry,
} from "@/lib/github/types";

const API_BASE_URL = "https://api.github.com";
const USER_AGENT = "RepoPulse-Lite/1.0";
const API_VERSION = "2022-11-28";
const CACHE_TTL_MS = 600_000;
const MAX_RETRIES = 2;
const RETRY_BACKOFF_MS = [1_000, 2_000];
const MAX_COMMIT_DETAIL_CONCURRENCY = 8;
const DEFAULT_MAX_COMMITS = 100;
const FALLBACK_RETRY_AFTER_SECONDS = 60;

type RateLimitInfo = {
  remaining: number;
  limit: number;
  resetEpochSeconds: number;
};

export interface FetchTelemetryOptions {
  token?: string;
  maxCommits?: number;
}

export interface GithubClient {
  fetchRepoTelemetry: (
    owner: string,
    repo: string,
    options?: FetchTelemetryOptions
  ) => Promise<RepoTelemetry>;
}

interface RawRepo {
  full_name?: string | null;
  description?: string | null;
  stargazers_count?: number | null;
  forks_count?: number | null;
  open_issues_count?: number | null;
  language?: string | null;
  default_branch?: string | null;
  pushed_at?: string | null;
  private?: boolean | null;
}

interface RawCommitAuthor {
  name?: string | null;
  email?: string | null;
  date?: string | null;
}

interface RawCommitListItem {
  sha?: string | null;
  commit?: {
    message?: string | null;
    author?: RawCommitAuthor | null;
  } | null;
  author?: { login?: string | null } | null;
}

interface RawCommitDetail {
  files?: Array<{ additions?: number | null; deletions?: number | null }> | null;
  stats?: {
    additions?: number | null;
    deletions?: number | null;
    total?: number | null;
  } | null;
}

interface CacheEntry {
  telemetry: RepoTelemetry;
  cachedAtMs: number;
}

const telemetryCache = new Map<string, CacheEntry>();

export function clearGithubCache(): void {
  telemetryCache.clear();
}

function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function normalizeToken(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getEnvToken(): string | null {
  return normalizeToken(process.env.GITHUB_TOKEN);
}

function clampMaxCommits(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return DEFAULT_MAX_COMMITS;
  }
  return Math.min(100, Math.max(1, Math.floor(value)));
}

function textOf(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nonEmptyTextOf(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function finiteNumberOf(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function buildHeaders(token: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": API_VERSION,
    "User-Agent": USER_AGENT,
  };
  if (token !== null) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function parseRateLimit(response: Response): RateLimitInfo | null {
  const limitHeader = response.headers.get("x-ratelimit-limit");
  const remainingHeader = response.headers.get("x-ratelimit-remaining");
  const resetHeader = response.headers.get("x-ratelimit-reset");
  if (limitHeader === null || remainingHeader === null || resetHeader === null) {
    return null;
  }
  const limit = Number(limitHeader);
  const remaining = Number(remainingHeader);
  const resetEpochSeconds = Number(resetHeader);
  if (
    !Number.isFinite(limit) ||
    !Number.isFinite(remaining) ||
    !Number.isFinite(resetEpochSeconds)
  ) {
    return null;
  }
  return { remaining, limit, resetEpochSeconds };
}

function buildRateLimitError(response: Response): GithubError {
  const resetHeader = response.headers.get("x-ratelimit-reset");
  let retryAfterSeconds = FALLBACK_RETRY_AFTER_SECONDS;
  if (resetHeader !== null) {
    const resetEpochSeconds = Number(resetHeader);
    if (Number.isFinite(resetEpochSeconds)) {
      const nowSeconds = Math.floor(Date.now() / 1000);
      retryAfterSeconds = Math.max(1, resetEpochSeconds - nowSeconds);
    }
  }
  return new GithubError({
    code: "RATE_LIMITED",
    status: 429,
    safeMessage:
      "GitHub API rate limit reached. Add a GITHUB_TOKEN in settings or wait a few minutes.",
    retryAfterSeconds,
    internalDetail: `Upstream status ${response.status} with exhausted rate limit; reset epoch ${
      resetHeader ?? "unknown"
    }`,
  });
}

async function githubFetch<T>(
  path: string,
  token: string | null
): Promise<{ data: T; rateLimit: RateLimitInfo | null }> {
  const url = `${API_BASE_URL}${path}`;
  let retriesAttempted = 0;
  for (;;) {
    let response: Response;
    try {
      response = await fetch(url, { headers: buildHeaders(token) });
    } catch (err) {
      throw toGithubError(err);
    }
    const rateLimit = parseRateLimit(response);
    if (response.ok) {
      try {
        const data = (await response.json()) as T;
        return { data, rateLimit };
      } catch (err) {
        throw toGithubError(err);
      }
    }
    const status = response.status;
    if (
      status === 429 ||
      (status === 403 && response.headers.get("x-ratelimit-remaining") === "0")
    ) {
      throw buildRateLimitError(response);
    }
    if (status === 404) {
      throw new GithubError({
        code: "REPO_NOT_FOUND",
        status: 404,
        safeMessage:
          "Repository not found or private. Check the URL or make the repository public.",
        internalDetail: `Upstream status 404 on ${path}`,
      });
    }
    if (status >= 500) {
      if (retriesAttempted < MAX_RETRIES) {
        await sleep(RETRY_BACKOFF_MS[retriesAttempted]);
        retriesAttempted += 1;
        continue;
      }
      throw new GithubError({
        code: "UPSTREAM_ERROR",
        status: 502,
        safeMessage: "GitHub is having issues. Please try again shortly.",
        internalDetail: `Upstream status ${status} on ${path} after ${retriesAttempted} retries`,
      });
    }
    let bodySnippet = "";
    try {
      bodySnippet = (await response.text()).replace(/\s+/g, " ").slice(0, 200);
    } catch {
      bodySnippet = "";
    }
    const error = new GithubError({
      code: "UPSTREAM_ERROR",
      status: 502,
      safeMessage: "GitHub rejected the request.",
      internalDetail: `Upstream status ${status} on ${path}; body: ${bodySnippet}`,
    });
    throw error;
  }
}

function mapRepoMeta(owner: string, repo: string, raw: RawRepo): RepoMeta {
  return {
    owner,
    repo,
    fullName: nonEmptyTextOf(raw.full_name) ?? `${owner}/${repo}`,
    description: nonEmptyTextOf(raw.description),
    stars: finiteNumberOf(raw.stargazers_count, 0),
    forks: finiteNumberOf(raw.forks_count, 0),
    openIssues: finiteNumberOf(raw.open_issues_count, 0),
    language: nonEmptyTextOf(raw.language),
    defaultBranch: textOf(raw.default_branch),
    pushedAt: nonEmptyTextOf(raw.pushed_at),
    isPrivate: raw.private === true,
  };
}

function mapCommitListItem(item: RawCommitListItem): CommitDetail {
  return {
    sha: textOf(item.sha),
    message: textOf(item.commit?.message),
    authorName: textOf(item.commit?.author?.name),
    authorLogin: nonEmptyTextOf(item.author?.login),
    authorEmail: nonEmptyTextOf(item.commit?.author?.email),
    authorDate: textOf(item.commit?.author?.date),
    filesChanged: 0,
    additions: 0,
    deletions: 0,
  };
}

async function runWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  const effectiveLimit = Math.max(1, limit);
  for (let start = 0; start < items.length; start += effectiveLimit) {
    const end = Math.min(start + effectiveLimit, items.length);
    const wave = items.slice(start, end);
    const waveResults = await Promise.all(wave.map((item) => worker(item)));
    results.push(...waveResults);
  }
  return results;
}

async function resolveTelemetry(
  owner: string,
  repo: string,
  clientToken: string | null,
  options?: FetchTelemetryOptions
): Promise<RepoTelemetry> {
  const token = normalizeToken(options?.token) ?? clientToken ?? getEnvToken();
  const maxCommits = clampMaxCommits(options?.maxCommits);
  const tokenized = token !== null;
  const cacheKey = `${tokenized ? "auth" : "anon"}|${owner}/${repo}`;
  const cachedEntry = telemetryCache.get(cacheKey);
  if (cachedEntry !== undefined) {
    if (Date.now() - cachedEntry.cachedAtMs < CACHE_TTL_MS) {
      return cachedEntry.telemetry;
    }
    telemetryCache.delete(cacheKey);
  }

  const encodedOwner = encodeURIComponent(owner);
  const encodedRepo = encodeURIComponent(repo);

  const repoResult = await githubFetch<RawRepo>(
    `/repos/${encodedOwner}/${encodedRepo}`,
    token
  );
  let rateLimit = repoResult.rateLimit;
  const meta = mapRepoMeta(owner, repo, repoResult.data);

  const listResult = await githubFetch<RawCommitListItem[]>(
    `/repos/${encodedOwner}/${encodedRepo}/commits?per_page=${maxCommits}`,
    token
  );
  if (listResult.rateLimit !== null) {
    rateLimit = listResult.rateLimit;
  }
  const listItems = Array.isArray(listResult.data) ? listResult.data : [];

  const baseCommits = listItems.map(mapCommitListItem);
  const commits = await runWithConcurrency(
    baseCommits,
    MAX_COMMIT_DETAIL_CONCURRENCY,
    async (base): Promise<CommitDetail> => {
      if (base.sha === "") {
        return base;
      }
      try {
        const detail = await githubFetch<RawCommitDetail>(
          `/repos/${encodedOwner}/${encodedRepo}/commits/${encodeURIComponent(
            base.sha
          )}`,
          token
        );
        if (detail.rateLimit !== null) {
          rateLimit = detail.rateLimit;
        }
        return {
          ...base,
          filesChanged: Array.isArray(detail.data.files)
            ? detail.data.files.length
            : 0,
          additions: finiteNumberOf(detail.data.stats?.additions, 0),
          deletions: finiteNumberOf(detail.data.stats?.deletions, 0),
        };
      } catch (err) {
        if (err instanceof GithubError && err.code === "REPO_NOT_FOUND") {
          return base;
        }
        throw err;
      }
    }
  );

  const telemetry: RepoTelemetry = {
    meta,
    commits,
    fetchedAt: new Date().toISOString(),
    rateLimit,
  };
  telemetryCache.set(cacheKey, { telemetry, cachedAtMs: Date.now() });
  return telemetry;
}

export async function fetchRepoTelemetry(
  owner: string,
  repo: string,
  options?: FetchTelemetryOptions
): Promise<RepoTelemetry> {
  return resolveTelemetry(owner, repo, null, options);
}

export function createGithubClient(options?: { token?: string }): GithubClient {
  const clientToken = normalizeToken(options?.token);
  return {
    fetchRepoTelemetry: (owner, repo, fetchOptions) =>
      resolveTelemetry(owner, repo, clientToken, fetchOptions),
  };
}

export function computeAuthorStats(commits: CommitDetail[]): AuthorStat[] {
  const statsByKey = new Map<string, AuthorStat>();
  for (const commit of commits) {
    const login = commit.authorLogin ?? commit.authorEmail ?? commit.authorName;
    const key = login.length > 0 ? login : "unknown";
    const existing = statsByKey.get(key);
    if (existing === undefined) {
      statsByKey.set(key, {
        login: key,
        name: commit.authorName,
        commits: 1,
        additions: commit.additions,
        deletions: commit.deletions,
      });
    } else {
      existing.commits += 1;
      existing.additions += commit.additions;
      existing.deletions += commit.deletions;
    }
  }
  return Array.from(statsByKey.values()).sort(
    (a, b) => b.commits - a.commits || a.login.localeCompare(b.login)
  );
}
