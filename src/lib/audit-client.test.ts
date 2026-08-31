import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requestAudit } from "@/lib/audit-client";

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

describe("requestAudit", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with data on a 200 response", async () => {
    mockFetchOnce(200, { mode: "llm", report: "R", model: "m", reason: null });
    const result = await requestAudit("https://github.com/octocat/hello-world", { foo: 1 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.mode).toBe("llm");
      expect(result.data.report).toBe("R");
      expect(result.data.model).toBe("m");
      expect(result.data.reason).toBeNull();
    }
  });

  it("sends repoUrl and analysis in the body", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ mode: "fallback", report: "R", model: null, reason: "why" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const analysis = { score: 42 };
    await requestAudit("https://github.com/octocat/hello-world", analysis);
    const [, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      unknown,
      RequestInit
    ];
    const body = JSON.parse(String(init.body)) as {
      repoUrl: string;
      analysis: unknown;
      llm?: unknown;
    };
    expect(body.repoUrl).toBe("https://github.com/octocat/hello-world");
    expect(body.analysis).toEqual({ score: 42 });
    expect("llm" in body).toBe(false);
  });

  it("includes the llm object in the body when provided", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ mode: "llm", report: "R", model: "m", reason: null }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const llm = { baseUrl: "https://example/v1", model: "m", apiKey: "k" };
    await requestAudit("https://github.com/octocat/hello-world", { score: 1 }, { llm });
    const [, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      unknown,
      RequestInit
    ];
    const body = JSON.parse(String(init.body)) as {
      repoUrl: string;
      llm?: unknown;
    };
    expect(body.llm).toEqual(llm);
  });

  it("maps a 400 error payload to INVALID_SNAPSHOT", async () => {
    mockFetchOnce(400, {
      error: { code: "INVALID_SNAPSHOT", message: "The analysis payload was unreadable." },
    });
    const result = await requestAudit("https://github.com/octocat/hello-world", { foo: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_SNAPSHOT");
      expect(result.error.message).toBe("The analysis payload was unreadable.");
    }
  });

  it("returns NETWORK_ERROR when fetch rejects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      })
    );
    const result = await requestAudit("https://github.com/octocat/hello-world", { foo: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NETWORK_ERROR");
    }
  });

  it("returns BAD_RESPONSE when error body is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>gateway error</html>", { status: 502 }))
    );
    const result = await requestAudit("https://github.com/octocat/hello-world", { foo: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("BAD_RESPONSE");
    }
  });

  it("returns BAD_RESPONSE when success body has an invalid mode", async () => {
    mockFetchOnce(200, { mode: "weird", report: "R", model: "m", reason: null });
    const result = await requestAudit("https://github.com/octocat/hello-world", { foo: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("BAD_RESPONSE");
    }
  });

  it("returns BAD_RESPONSE when success body has an empty report", async () => {
    mockFetchOnce(200, { mode: "llm", report: "", model: "m", reason: null });
    const result = await requestAudit("https://github.com/octocat/hello-world", { foo: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("BAD_RESPONSE");
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
      requestAudit("https://github.com/octocat/hello-world", { foo: 1 }, {
        signal: new AbortController().signal,
      })
    ).rejects.toThrow();
  });
});
