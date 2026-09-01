import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/analyze/route";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/analyze route handler", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 400 for a non-JSON body", async () => {
    const response = await POST(jsonRequest("not json"));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("INVALID_URL");
  });

  it("returns 400 when repoUrl is missing", async () => {
    const response = await POST(jsonRequest({}));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("INVALID_URL");
  });

  it("returns 400 (not 502) for an SSRF-style host", async () => {
    const response = await POST(
      jsonRequest({ repoUrl: "https://evil.com/owner/repo" })
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("INVALID_URL");
  });

  it("returns 400 for a non-https scheme", async () => {
    const response = await POST(
      jsonRequest({ repoUrl: "http://localhost:3000/owner/repo" })
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("INVALID_URL");
  });

  it("returns 404 when GitHub reports the repo is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (): Promise<Response> =>
        new Response(JSON.stringify({ message: "Not Found" }), {
          status: 404,
          headers: {
            "Content-Type": "application/json",
            "x-ratelimit-limit": "60",
            "x-ratelimit-remaining": "59",
            "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 3600),
          },
        })
      )
    );

    const response = await POST(
      jsonRequest({ repoUrl: "https://github.com/octocat/hello-world" })
    );
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("REPO_NOT_FOUND");
  });

  it("returns 429 with Retry-After when GitHub rate limits", async () => {
    const reset = Math.floor(Date.now() / 1000) + 600;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (): Promise<Response> =>
        new Response(JSON.stringify({ message: "rate limited" }), {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "x-ratelimit-limit": "60",
            "x-ratelimit-remaining": "0",
            "x-ratelimit-reset": String(reset),
          },
        })
      )
    );

    const response = await POST(
      jsonRequest({ repoUrl: "https://github.com/octocat/hello-world" })
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBeTruthy();
    const body = await response.json();
    expect(body.error.code).toBe("RATE_LIMITED");
    expect(body.error.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("returns 200 with analysis data for a valid repo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: unknown): Promise<Response> => {
        const url = typeof input === "string" ? input : String(input);
        const headers = {
          "Content-Type": "application/json",
          "x-ratelimit-limit": "60",
          "x-ratelimit-remaining": "59",
          "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 3600),
        };
        if (url.endsWith("/repos/octocat/hello-world")) {
          return new Response(
            JSON.stringify({
              full_name: "octocat/hello-world",
              description: "A mock repo",
              stargazers_count: 10,
              forks_count: 2,
              open_issues_count: 1,
              language: "TypeScript",
              default_branch: "main",
              pushed_at: "2026-07-03T10:00:00Z",
              private: false,
            }),
            { status: 200, headers }
          );
        }
        if (url.endsWith("/repos/octocat/hello-world/commits?per_page=100")) {
          return new Response(
            JSON.stringify([
              {
                sha: "aaa1111111111111111111111111111111111111",
                commit: {
                  message: "feat: add login flow with oauth2",
                  author: {
                    name: "Ada",
                    email: "ada@x.com",
                    date: "2026-07-01T10:00:00Z",
                  },
                },
                author: { login: "ada" },
              },
            ]),
            { status: 200, headers }
          );
        }
        return new Response(
          JSON.stringify({
            files: [{}],
            stats: { additions: 30, deletions: 5, total: 35 },
          }),
          { status: 200, headers }
        );
      })
    );

    const response = await POST(
      jsonRequest({ repoUrl: "https://github.com/octocat/hello-world" })
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.repo.fullName).toBe("octocat/hello-world");
    expect(body.score).toBeGreaterThanOrEqual(0);
    expect(body.score).toBeLessThanOrEqual(100);
  });

  it("returns 405 for GET", async () => {
    const response = await GET();
    expect(response.status).toBe(405);
  });
});
