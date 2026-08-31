import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chatCompletion } from "@/lib/llm/client";
import { LlmError } from "@/lib/llm/errors";
import type { ChatMessage, LlmConfig } from "@/lib/llm/types";

const config: LlmConfig = {
  baseUrl: "https://api.llm.example/v1",
  model: "audit-model",
  apiKey: "test-key",
};

const messages: ChatMessage[] = [
  { role: "system", content: "You are an auditor." },
  { role: "user", content: "Write the report." },
];

function mockFetchOnce(status: number, body: unknown, headers: Record<string, string> = {}): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () =>
    new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", ...headers },
    })
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function completionBody(content: unknown): unknown {
  return { choices: [{ message: { role: "assistant", content } }] };
}

describe("chatCompletion", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("returns content and sends auth header, model, and default temperature", async () => {
    const fetchMock = mockFetchOnce(200, completionBody("# Report\nAll good."));
    const content = await chatCompletion(config, messages);
    expect(content).toBe("# Report\nAll good.");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.llm.example/v1/chat/completions");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-key");
    expect(headers["Content-Type"]).toBe("application/json");
    const body = JSON.parse(String(init.body)) as {
      model: string;
      temperature: number;
      messages: ChatMessage[];
    };
    expect(body.model).toBe("audit-model");
    expect(body.temperature).toBe(0.2);
    expect(body.messages).toEqual(messages);
  });

  it("joins the URL correctly when the base URL has trailing slashes", async () => {
    const fetchMock = mockFetchOnce(200, completionBody("ok"));
    await chatCompletion({ ...config, baseUrl: "https://api.llm.example/v1///" }, messages);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.llm.example/v1/chat/completions");
  });

  it("returns LLM_EMPTY_CONTENT for empty or whitespace content", async () => {
    mockFetchOnce(200, completionBody("   "));
    const error = await chatCompletion(config, messages).catch((err) => err);
    expect(error).toBeInstanceOf(LlmError);
    expect(error.code).toBe("LLM_EMPTY_CONTENT");
    expect(error.safeMessage).toBe("The LLM provider returned an empty report.");
  });

  it("returns LLM_BAD_RESPONSE when choices is missing", async () => {
    mockFetchOnce(200, { id: "cmpl-1" });
    const error = await chatCompletion(config, messages).catch((err) => err);
    expect(error).toBeInstanceOf(LlmError);
    expect(error.code).toBe("LLM_BAD_RESPONSE");
    expect(error.safeMessage).toBe("The LLM provider returned an unreadable response.");
  });

  it("returns LLM_UPSTREAM_ERROR with the upstream status on HTTP 500", async () => {
    mockFetchOnce(500, { error: { message: "internal failure including test-key" } });
    const error = await chatCompletion(config, messages).catch((err) => err);
    expect(error).toBeInstanceOf(LlmError);
    expect(error.code).toBe("LLM_UPSTREAM_ERROR");
    expect(error.status).toBe(500);
    expect(error.safeMessage).toContain("HTTP 500");
  });

  it("never leaks the API key in HTTP 500 error messages", async () => {
    mockFetchOnce(500, { error: { message: "secret test-key leak" } });
    const error = await chatCompletion(config, messages).catch((err) => err);
    expect(error.safeMessage).not.toContain("test-key");
    expect(error.internalDetail).not.toContain("test-key");
  });

  it("parses Retry-After on HTTP 429", async () => {
    mockFetchOnce(429, { error: { message: "rate limited" } }, { "Retry-After": "30" });
    const error = await chatCompletion(config, messages).catch((err) => err);
    expect(error).toBeInstanceOf(LlmError);
    expect(error.code).toBe("LLM_UPSTREAM_ERROR");
    expect(error.status).toBe(429);
    expect(error.retryAfterSeconds).toBe(30);
    expect(error.safeMessage).toBe(
      "The LLM provider is rate-limiting requests. Please try again shortly."
    );
  });

  it("returns LLM_BAD_RESPONSE for a malformed JSON body", async () => {
    mockFetchOnce(200, "<not json>");
    const error = await chatCompletion(config, messages).catch((err) => err);
    expect(error).toBeInstanceOf(LlmError);
    expect(error.code).toBe("LLM_BAD_RESPONSE");
  });

  it("returns LLM_NETWORK_ERROR when fetch rejects with TypeError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      })
    );
    const error = await chatCompletion(config, messages).catch((err) => err);
    expect(error).toBeInstanceOf(LlmError);
    expect(error.code).toBe("LLM_NETWORK_ERROR");
    expect(error.safeMessage).toBe(
      "Unable to reach the LLM provider. Please try again shortly."
    );
  });

  it("returns LLM_TIMEOUT when the request exceeds timeoutMs", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            if (init.signal !== undefined && init.signal !== null) {
              init.signal.addEventListener("abort", () => {
                reject(new DOMException("The operation was aborted.", "AbortError"));
              });
            }
          })
      )
    );
    const promise = chatCompletion(config, messages, { timeoutMs: 10 });
    const assertion = expect(promise).rejects.toMatchObject({
      code: "LLM_TIMEOUT",
      status: 504,
      safeMessage: "The LLM provider took too long to respond.",
    });
    await vi.advanceTimersByTimeAsync(20);
    await assertion;
    const error = await promise.catch((err) => err);
    expect(error).toBeInstanceOf(LlmError);
  });
});
