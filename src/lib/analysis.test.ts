import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runAnalysis } from "@/lib/analysis";
import { clearGithubCache } from "@/lib/github/client";

const BASE_URL = "https://api.github.com";
const RESET_EPOCH = Math.floor(Date.now() / 1000) + 3600;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "x-ratelimit-limit": "60",
      "x-ratelimit-remaining": "59",
      "x-ratelimit-reset": String(RESET_EPOCH),
    },
  });
}

const MOCK_COMMITS = [
  {
    sha: "aaa1111111111111111111111111111111111111",
    message: "feat: add login flow with oauth2",
    authorName: "Ada Lovelace",
    authorLogin: "ada",
    date: "2026-07-01T10:00:00Z",
    additions: 120,
    deletions: 10,
    fileCount: 3,
  },
  {
    sha: "bbb2222222222222222222222222222222222222",
    message: "fix: correct null pointer in parser",
    authorName: "Grace Hopper",
    authorLogin: "grace",
    date: "2026-07-02T10:00:00Z",
    additions: 60,
    deletions: 40,
    fileCount: 2,
  },
  {
    sha: "ccc3333333333333333333333333333333333333",
    message: "docs: update readme installation steps",
    authorName: "Ada Lovelace",
    authorLogin: "ada",
    date: "2026-07-03T10:00:00Z",
    additions: 20,
    deletions: 5,
    fileCount: 1,
  },
];

function mockGithubSuccess(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown): Promise<Response> => {
      const url = typeof input === "string" ? input : String(input);
      if (url === `${BASE_URL}/repos/octocat/hello-world`) {
        return jsonResponse({
          full_name: "octocat/hello-world",
          description: "A mock repo",
          stargazers_count: 10,
          forks_count: 2,
          open_issues_count: 1,
          language: "TypeScript",
          default_branch: "main",
          pushed_at: "2026-07-03T10:00:00Z",
          private: false,
        });
      }
      if (url === `${BASE_URL}/repos/octocat/hello-world/commits?per_page=100`) {
        return jsonResponse(
          MOCK_COMMITS.map((c) => ({
            sha: c.sha,
            commit: {
              message: c.message,
              author: {
                name: c.authorName,
                email: `${c.authorLogin}@x.com`,
                date: c.date,
              },
            },
            author: { login: c.authorLogin },
          }))
        );
      }
      if (url.startsWith(`${BASE_URL}/repos/octocat/hello-world/commits/`)) {
        const sha = url.split("/").pop() ?? "";
        const commit = MOCK_COMMITS.find((c) => c.sha === sha);
        if (!commit) {
          return jsonResponse({ message: "Not Found" }, 404);
        }
        return jsonResponse({
          files: Array.from({ length: commit.fileCount }, () => ({})),
          stats: {
            additions: commit.additions,
            deletions: commit.deletions,
            total: commit.additions + commit.deletions,
          },
        });
      }
      return jsonResponse({ message: "Not Found" }, 404);
    })
  );
}

describe("runAnalysis", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    clearGithubCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects an invalid URL without any fetch", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await runAnalysis({ repoUrl: "not-a-url" });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error.code).toBe("INVALID_URL");
      expect(typeof outcome.error.message).toBe("string");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns full analysis data for a valid repo", async () => {
    mockGithubSuccess();

    const outcome = await runAnalysis({
      repoUrl: "https://github.com/octocat/hello-world",
    });

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      const { data } = outcome;
      expect(data.score).toBeGreaterThanOrEqual(0);
      expect(data.score).toBeLessThanOrEqual(100);
      expect(data.band.band).toMatch(
        /^(excellent|moderate|at_risk|critical)$/
      );
      expect(data.tiers.tier1 + data.tiers.tier2 + data.tiers.tier3).toBe(3);
      expect(Array.isArray(data.anomalies)).toBe(true);
      expect(data.repo.fullName).toBe("octocat/hello-world");
      expect(data.authors.length).toBeGreaterThan(0);
      expect(data.authors[0].commits).toBeGreaterThanOrEqual(
        data.authors[data.authors.length - 1].commits
      );
      expect(data.rateLimit).not.toBeNull();
      expect(data.rateLimit?.remaining).toBe(59);
      expect(Number.isNaN(Date.parse(data.fetchedAt))).toBe(false);
    }
  });

  it("maps a 404 to REPO_NOT_FOUND", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (): Promise<Response> => jsonResponse({ message: "nope" }, 404))
    );

    const outcome = await runAnalysis({
      repoUrl: "https://github.com/octocat/hello-world",
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error.code).toBe("REPO_NOT_FOUND");
    }
  });

  it("maps a 429 to RATE_LIMITED with retry seconds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (): Promise<Response> =>
        new Response(JSON.stringify({ message: "rate limited" }), {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "x-ratelimit-limit": "60",
            "x-ratelimit-remaining": "0",
            "x-ratelimit-reset": String(RESET_EPOCH),
          },
        })
      )
    );

    const outcome = await runAnalysis({
      repoUrl: "https://github.com/octocat/hello-world",
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error.code).toBe("RATE_LIMITED");
      expect(outcome.error.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it("passes the provided token as a bearer header", async () => {
    mockGithubSuccess();

    await runAnalysis({
      repoUrl: "https://github.com/octocat/hello-world",
      githubToken: "  test-token-123  ",
    });

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalled();
    const firstCall = fetchMock.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string> }
    ];
    expect(firstCall[1].headers.Authorization).toBe("Bearer test-token-123");
  });
});
