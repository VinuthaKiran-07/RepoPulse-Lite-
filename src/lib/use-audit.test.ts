// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useAudit } from "@/lib/use-audit";
import { fixtureAnalyzeResponse } from "@/lib/test-fixtures";
import type { AuditState } from "@/lib/audit-types";

type Deferred = {
  resolve: (value: Response) => void;
  reject: (reason: unknown) => void;
};

class FakeFetch {
  calls: Array<{ url: string; body: unknown }> = [];
  deferred: Deferred[] = [];

  respondOnce(index: number, response: Response): void {
    const deferred = this.deferred[index];
    if (deferred === undefined) {
      throw new Error(`no pending request at index ${index}`);
    }
    deferred.resolve(response);
  }

  readonly fetchImpl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    this.calls.push({
      url: String(input),
      body: init?.body !== undefined ? JSON.parse(String(init.body)) : null,
    });
    const promise = new Promise<Response>((resolve, reject) => {
      this.deferred.push({ resolve, reject });
    });
    return promise;
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const SUCCESS_RESPONSE = {
  mode: "llm" as const,
  report: "## Executive Summary\nAll good.",
  model: "env-model",
  reason: null,
};

const ERROR_RESPONSE = {
  error: { code: "INVALID_SNAPSHOT", message: "The analysis payload was unreadable." },
};

function status(state: AuditState): string {
  return state.status;
}

describe("useAudit", () => {
  it("starts idle", () => {
    const { result } = renderHook(() => useAudit());
    expect(status(result.current.state)).toBe("idle");
  });

  it("transitions idle → generating → success", async () => {
    const fake = new FakeFetch();
    vi.stubGlobal("fetch", fake.fetchImpl);

    const { result } = renderHook(() => useAudit());

    let promise: Promise<void> = Promise.resolve();
    act(() => {
      promise = result.current.generate(
        "https://github.com/octocat/hello-world",
        fixtureAnalyzeResponse()
      );
    });
    expect(status(result.current.state)).toBe("generating");

    await act(async () => {
      fake.respondOnce(0, jsonResponse(200, SUCCESS_RESPONSE));
      await promise;
    });

    expect(status(result.current.state)).toBe("success");
    if (result.current.state.status === "success") {
      expect(result.current.state.data.mode).toBe("llm");
      expect(result.current.state.data.report).toBe("## Executive Summary\nAll good.");
    }
    vi.unstubAllGlobals();
  });

  it("transitions idle → generating → error", async () => {
    const fake = new FakeFetch();
    vi.stubGlobal("fetch", fake.fetchImpl);

    const { result } = renderHook(() => useAudit());

    let promise: Promise<void> = Promise.resolve();
    act(() => {
      promise = result.current.generate(
        "https://github.com/octocat/hello-world",
        { foo: 1 }
      );
    });
    expect(status(result.current.state)).toBe("generating");

    await act(async () => {
      fake.respondOnce(0, jsonResponse(400, ERROR_RESPONSE));
      await promise;
    });

    expect(status(result.current.state)).toBe("error");
    if (result.current.state.status === "error") {
      expect(result.current.state.code).toBe("INVALID_SNAPSHOT");
      expect(result.current.state.message).toBe("The analysis payload was unreadable.");
    }
    vi.unstubAllGlobals();
  });

  it("aborts a previous in-flight request when a new one starts", async () => {
    const fake = new FakeFetch();
    vi.stubGlobal("fetch", fake.fetchImpl);

    const { result } = renderHook(() => useAudit());

    act(() => {
      void result.current.generate("https://github.com/octocat/hello-world", { n: 1 });
    });
    act(() => {
      void result.current.generate("https://github.com/octocat/hello-world", { n: 2 });
    });

    expect(fake.calls).toHaveLength(2);
    expect(status(result.current.state)).toBe("generating");

    const first = fake.deferred[0];
    const second = fake.deferred[1];
    fake.deferred.length = 0;

    await act(async () => {
      first?.resolve(jsonResponse(200, SUCCESS_RESPONSE));
      second?.resolve(jsonResponse(200, SUCCESS_RESPONSE));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(status(result.current.state)).toBe("success");
    if (result.current.state.status === "success") {
      expect(result.current.state.data.report).toBe("## Executive Summary\nAll good.");
    }
    vi.unstubAllGlobals();
  });

  it("reset returns the machine to idle", async () => {
    const fake = new FakeFetch();
    vi.stubGlobal("fetch", fake.fetchImpl);

    const { result } = renderHook(() => useAudit());

    let promise: Promise<void> = Promise.resolve();
    act(() => {
      promise = result.current.generate(
        "https://github.com/octocat/hello-world",
        fixtureAnalyzeResponse()
      );
    });
    await act(async () => {
      fake.respondOnce(0, jsonResponse(200, SUCCESS_RESPONSE));
      await promise;
    });
    expect(status(result.current.state)).toBe("success");

    act(() => {
      result.current.reset();
    });
    expect(status(result.current.state)).toBe("idle");
    vi.unstubAllGlobals();
  });

  it("ignores a late success from a superseded request", async () => {
    const fake = new FakeFetch();
    vi.stubGlobal("fetch", fake.fetchImpl);

    const { result } = renderHook(() => useAudit());

    act(() => {
      void result.current.generate("https://github.com/octocat/hello-world", { n: 1 });
    });
    act(() => {
      void result.current.generate("https://github.com/octocat/hello-world", { n: 2 });
    });

    const first = fake.deferred[0];
    const second = fake.deferred[1];
    fake.deferred.length = 0;

    await act(async () => {
      first?.resolve(jsonResponse(200, SUCCESS_RESPONSE));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(status(result.current.state)).toBe("generating");

    await act(async () => {
      second?.resolve(jsonResponse(400, ERROR_RESPONSE));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(status(result.current.state)).toBe("error");
    if (result.current.state.status === "error") {
      expect(result.current.state.code).toBe("INVALID_SNAPSHOT");
    }
    vi.unstubAllGlobals();
  });
});
