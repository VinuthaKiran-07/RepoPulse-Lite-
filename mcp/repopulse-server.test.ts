import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  ANALYZE_REPO_TOOL_NAME,
  createMcpServer,
} from "./repopulse-server";
import { clearGithubCache } from "@/lib/github/client";

const BASE_URL = "https://api.github.com";
const RESET_EPOCH = Math.floor(Date.now() / 1000) + 3600;

interface MockCommit {
  sha: string;
  message: string;
  authorName: string;
  authorLogin: string;
  date: string;
  additions: number;
  deletions: number;
  fileCount: number;
}

const MOCK_COMMITS: MockCommit[] = [
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
              author: { name: c.authorName, email: `${c.authorLogin}@x.com`, date: c.date },
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

function mockGithubStatus(status: number): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (): Promise<Response> => jsonResponse({ message: "mock" }, status))
  );
}

function parseToolText(result: {
  content?: Array<{ type: string; text?: string }>;
}): Record<string, unknown> {
  const text = result.content?.[0]?.text;
  expect(typeof text).toBe("string");
  return JSON.parse(text as string) as Record<string, unknown>;
}

async function withConnectedPair(
  handler: (client: Client) => Promise<void>
): Promise<void> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const server = createMcpServer();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    await handler(client);
  } finally {
    await client.close().catch(() => undefined);
    await server.close().catch(() => undefined);
  }
}

describe("RepoPulse MCP server", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    clearGithubCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists the analyze-repo tool with its schema", async () => {
    await withConnectedPair(async (client) => {
      const { tools } = await client.listTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe(ANALYZE_REPO_TOOL_NAME);
      expect(tools[0].description).toContain("health score");
      const schema = tools[0].inputSchema as {
        required?: string[];
        properties?: Record<string, unknown>;
      };
      expect(schema.required).toContain("repoUrl");
      expect(schema.properties).toHaveProperty("repoUrl");
      expect(schema.properties).toHaveProperty("githubToken");
    });
  });

  it("returns full analysis for a valid repo", async () => {
    mockGithubSuccess();
    await withConnectedPair(async (client) => {
      const result = (await client.callTool({
        name: ANALYZE_REPO_TOOL_NAME,
        arguments: { repoUrl: "https://github.com/octocat/hello-world" },
      })) as { content?: Array<{ type: string; text?: string }>; isError?: boolean };

      expect(result.isError ?? false).toBe(false);
      const parsed = parseToolText(result);
      expect(parsed.score).toBeGreaterThanOrEqual(0);
      expect(parsed.score).toBeLessThanOrEqual(100);
      expect(parsed.band).toMatchObject({ band: expect.any(String) });
      expect(parsed.anomalies).toEqual(expect.any(Array));
      expect(parsed.tiers).toEqual({
        tier1: expect.any(Number),
        tier2: expect.any(Number),
        tier3: expect.any(Number),
      });
      expect((parsed.repo as { fullName?: string }).fullName).toBe(
        "octocat/hello-world"
      );
    });
  });

  it("rejects an invalid URL without calling GitHub", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);
    await withConnectedPair(async (client) => {
      const result = (await client.callTool({
        name: ANALYZE_REPO_TOOL_NAME,
        arguments: { repoUrl: "not-a-url" },
      })) as { content?: Array<{ type: string; text?: string }>; isError?: boolean };

      expect(result.isError).toBe(true);
      const parsed = parseToolText(result);
      expect((parsed.error as { code?: string }).code).toBe("INVALID_URL");
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it("surfaces a REPO_NOT_FOUND error", async () => {
    mockGithubStatus(404);
    await withConnectedPair(async (client) => {
      const result = (await client.callTool({
        name: ANALYZE_REPO_TOOL_NAME,
        arguments: { repoUrl: "https://github.com/octocat/hello-world" },
      })) as { content?: Array<{ type: string; text?: string }>; isError?: boolean };

      expect(result.isError).toBe(true);
      const parsed = parseToolText(result);
      expect((parsed.error as { code?: string }).code).toBe("REPO_NOT_FOUND");
    });
  });

  it("surfaces a RATE_LIMITED error with retry seconds", async () => {
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
    await withConnectedPair(async (client) => {
      const result = (await client.callTool({
        name: ANALYZE_REPO_TOOL_NAME,
        arguments: { repoUrl: "https://github.com/octocat/hello-world" },
      })) as { content?: Array<{ type: string; text?: string }>; isError?: boolean };

      expect(result.isError).toBe(true);
      const parsed = parseToolText(result);
      const error = parsed.error as {
        code?: string;
        retryAfterSeconds?: number;
      };
      expect(error.code).toBe("RATE_LIMITED");
      expect(error.retryAfterSeconds).toBeGreaterThan(0);
    });
  });
});
