import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/audit/route";
import { fixtureAnalyzeResponse } from "@/lib/test-fixtures";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/audit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function mockLlmFetch(status: number, body: unknown): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("POST /api/audit", () => {
  beforeEach(() => {
    vi.stubEnv("LLM_API_KEY", "");
    vi.stubEnv("LLM_BASE_URL", "");
    vi.stubEnv("LLM_MODEL", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns 405 on GET with METHOD_NOT_ALLOWED", async () => {
    const response = await GET();
    expect(response.status).toBe(405);
    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("METHOD_NOT_ALLOWED");
    expect(body.error.message).toBe("Use POST with a JSON body.");
  });

  it("returns 400 INVALID_URL when body is not valid JSON", async () => {
    const response = await POST(makeRequest("not json at all"));
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("INVALID_URL");
    expect(body.error.message).toBe("Request body must be valid JSON.");
  });

  it("returns 400 INVALID_URL when repoUrl is missing", async () => {
    const response = await POST(makeRequest({ analysis: fixtureAnalyzeResponse() }));
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("INVALID_URL");
    expect(body.error.message).toBe("Request body must include a repoUrl string.");
  });

  it("returns 400 INVALID_URL when repoUrl is empty", async () => {
    const response = await POST(makeRequest({ repoUrl: "", analysis: fixtureAnalyzeResponse() }));
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("INVALID_URL");
    expect(body.error.message).toBe("Request body must include a repoUrl string.");
  });

  it("returns 400 INVALID_URL when repoUrl is not a GitHub URL", async () => {
    const response = await POST(
      makeRequest({ repoUrl: "https://gitlab.com/a/b", analysis: fixtureAnalyzeResponse() })
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("INVALID_URL");
    expect(body.error.message).toBe("host must be github.com");
  });

  it("returns 400 INVALID_SNAPSHOT when analysis is missing", async () => {
    const response = await POST(makeRequest({ repoUrl: "https://github.com/octocat/hello-world" }));
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("INVALID_SNAPSHOT");
    expect(body.error.message).toBe("Request body must include an analysis object.");
  });

  it("returns 400 INVALID_SNAPSHOT when analysis is null", async () => {
    const response = await POST(
      makeRequest({ repoUrl: "https://github.com/octocat/hello-world", analysis: null })
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("INVALID_SNAPSHOT");
    expect(body.error.message).toBe("Request body must include an analysis object.");
  });

  it("returns 400 INVALID_SNAPSHOT when analysis is a garbage object", async () => {
    const response = await POST(
      makeRequest({ repoUrl: "https://github.com/octocat/hello-world", analysis: { foo: 1 } })
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("INVALID_SNAPSHOT");
    expect(body.error.message).toBe("The analysis payload was unreadable.");
  });

  it("returns fallback mode with no key configured", async () => {
    const response = await POST(
      makeRequest({
        repoUrl: "https://github.com/octocat/hello-world",
        analysis: fixtureAnalyzeResponse(),
      })
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      mode: string;
      report: string;
      model: string | null;
      reason: string | null;
    };
    expect(body.mode).toBe("fallback");
    expect(body.model).toBeNull();
    expect(body.reason).toContain("No LLM provider key");
    expect(body.report).toContain("Heuristic-only mode");
  });

  it("uses env configuration and returns llm mode on success", async () => {
    vi.stubEnv("LLM_API_KEY", "env-secret");
    vi.stubEnv("LLM_MODEL", "env-model");
    vi.stubEnv("LLM_BASE_URL", "https://env.example/v1");
    const fetchMock = mockLlmFetch(200, {
      choices: [{ message: { content: "## Executive Summary\nAll good." } }],
    });

    const response = await POST(
      makeRequest({
        repoUrl: "https://github.com/octocat/hello-world",
        analysis: fixtureAnalyzeResponse(),
      })
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      mode: string;
      report: string;
      model: string | null;
      reason: string | null;
    };
    expect(body.mode).toBe("llm");
    expect(body.report).toBe("## Executive Summary\nAll good.");
    expect(body.model).toBe("env-model");
    expect(body.reason).toBeNull();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [unknown, RequestInit];
    expect(String(url)).toBe("https://env.example/v1/chat/completions");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer env-secret");
  });

  it("prefers runtime llm configuration over env", async () => {
    vi.stubEnv("LLM_API_KEY", "env-secret");
    vi.stubEnv("LLM_MODEL", "env-model");
    vi.stubEnv("LLM_BASE_URL", "https://env.example/v1");
    const fetchMock = mockLlmFetch(200, {
      choices: [{ message: { content: "## Executive Summary\nAll good." } }],
    });

    const response = await POST(
      makeRequest({
        repoUrl: "https://github.com/octocat/hello-world",
        analysis: fixtureAnalyzeResponse(),
        llm: {
          baseUrl: "https://runtime.example/v1",
          model: "runtime-model",
          apiKey: "runtime-secret",
        },
      })
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      mode: string;
      report: string;
      model: string | null;
      reason: string | null;
    };
    expect(body.mode).toBe("llm");
    expect(body.model).toBe("runtime-model");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [unknown, RequestInit];
    expect(String(url)).toBe("https://runtime.example/v1/chat/completions");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer runtime-secret");
  });

  it("falls back when the LLM upstream returns 500", async () => {
    vi.stubEnv("LLM_API_KEY", "env-secret");
    mockLlmFetch(500, { error: "upstream exploded" });

    const response = await POST(
      makeRequest({
        repoUrl: "https://github.com/octocat/hello-world",
        analysis: fixtureAnalyzeResponse(),
      })
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      mode: string;
      report: string;
      model: string | null;
      reason: string | null;
    };
    expect(body.mode).toBe("fallback");
    expect(body.model).toBeNull();
    expect(body.reason).toContain("HTTP 500");
    expect(body.report.length).toBeGreaterThan(0);
  });

  it("falls back when the LLM returns empty content", async () => {
    vi.stubEnv("LLM_API_KEY", "env-secret");
    mockLlmFetch(200, { choices: [{ message: { content: "   " } }] });

    const response = await POST(
      makeRequest({
        repoUrl: "https://github.com/octocat/hello-world",
        analysis: fixtureAnalyzeResponse(),
      })
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      mode: string;
      report: string;
      model: string | null;
      reason: string | null;
    };
    expect(body.mode).toBe("fallback");
    expect(body.model).toBeNull();
    expect(body.reason).toContain("empty");
    expect(body.report.length).toBeGreaterThan(0);
  });
});
