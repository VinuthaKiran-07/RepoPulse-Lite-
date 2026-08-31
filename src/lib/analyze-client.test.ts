import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeRepo } from "@/lib/analyze-client";

function mockFetchOnce(status: number, body: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      })
    )
  );
}

describe("analyzeRepo", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with data on a 200 response", async () => {
    const payload = { score: 42, band: { band: "at_risk", label: "At Risk", color: "#f97316" } };
    mockFetchOnce(200, payload);
    const result = await analyzeRepo("https://github.com/octocat/hello-world");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.score).toBe(42);
      expect(result.data.band.label).toBe("At Risk");
    }
  });

  it("maps a 404 error payload to REPO_NOT_FOUND", async () => {
    mockFetchOnce(404, {
      error: { code: "REPO_NOT_FOUND", message: "Repository not found or private." },
    });
    const result = await analyzeRepo("https://github.com/octocat/does-not-exist");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("REPO_NOT_FOUND");
      expect(result.error.message).toBe("Repository not found or private.");
    }
  });

  it("maps a 429 error payload with retryAfterSeconds", async () => {
    mockFetchOnce(429, {
      error: {
        code: "RATE_LIMITED",
        message: "GitHub API rate limit reached.",
        retryAfterSeconds: 1800,
      },
    });
    const result = await analyzeRepo("https://github.com/octocat/hello-world");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("RATE_LIMITED");
      expect(result.error.retryAfterSeconds).toBe(1800);
    }
  });

  it("maps an unknown error code to UNKNOWN", async () => {
    mockFetchOnce(502, { error: { code: "WEIRD_CODE", message: "boom" } });
    const result = await analyzeRepo("https://github.com/octocat/hello-world");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNKNOWN");
      expect(result.error.message).toBe("boom");
    }
  });

  it("returns BAD_RESPONSE when error body is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>gateway error</html>", { status: 502 }))
    );
    const result = await analyzeRepo("https://github.com/octocat/hello-world");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("BAD_RESPONSE");
    }
  });

  it("returns BAD_RESPONSE when success body is missing score", async () => {
    mockFetchOnce(200, { unexpected: true });
    const result = await analyzeRepo("https://github.com/octocat/hello-world");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("BAD_RESPONSE");
    }
  });

  it("returns NETWORK_ERROR when fetch rejects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      })
    );
    const result = await analyzeRepo("https://github.com/octocat/hello-world");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NETWORK_ERROR");
    }
  });

  it("rethrows AbortError instead of swallowing it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new DOMException("The operation was aborted.", "AbortError");
      })
    );
    await expect(
      analyzeRepo("https://github.com/octocat/hello-world", { signal: new AbortController().signal })
    ).rejects.toThrow();
  });

  it("sends the github token in the body when provided", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ score: 10, band: { band: "critical", label: "Critical", color: "#ef4444" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    await analyzeRepo("https://github.com/octocat/hello-world", { githubToken: "tok" });
    const [, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      unknown,
      RequestInit
    ];
    const body = JSON.parse(String(init.body)) as { repoUrl: string; githubToken?: string };
    expect(body.repoUrl).toBe("https://github.com/octocat/hello-world");
    expect(body.githubToken).toBe("tok");
  });
});
