// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useAnalyze } from "@/lib/use-analyze";
import { fixtureAnalyzeResponse } from "@/lib/test-fixtures";
import type { AnalyzeState } from "@/lib/use-analyze";

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

  rejectOnce(index: number, reason: unknown): void {
    const deferred = this.deferred[index];
    if (deferred !== undefined) {
      deferred.reject(reason);
    }
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

const ERROR_RESPONSE = {
  error: { code: "REPO_NOT_FOUND", message: "Repository not found or private." },
};

function status(state: AnalyzeState): string {
  return state.status;
}

describe("useAnalyze", () => {
  it("starts idle", () => {
    const { result } = renderHook(() => useAnalyze());
    expect(status(result.current.state)).toBe("idle");
  });

  it("transitions idle → loading → success", async () => {
    const fake = new FakeFetch();
    vi.stubGlobal("fetch", fake.fetchImpl);

    const { result } = renderHook(() => useAnalyze());

    let promise: Promise<void> = Promise.resolve();
    act(() => {
      promise = result.current.analyze("https://github.com/octocat/hello-world");
    });
    expect(status(result.current.state)).toBe("loading");

    await act(async () => {
      fake.respondOnce(0, jsonResponse(200, fixtureAnalyzeResponse()));
      await promise;
    });

    expect(status(result.current.state)).toBe("success");
    if (result.current.state.status === "success") {
      expect(result.current.state.data.score).toBe(72);
      expect(result.current.state.repoUrl).toBe("https://github.com/octocat/hello-world");
    }
    vi.unstubAllGlobals();
  });

  it("transitions idle → loading → error", async () => {
    const fake = new FakeFetch();
    vi.stubGlobal("fetch", fake.fetchImpl);

    const { result } = renderHook(() => useAnalyze());

    let promise: Promise<void> = Promise.resolve();
    act(() => {
      promise = result.current.analyze("https://github.com/octocat/missing");
    });
    expect(status(result.current.state)).toBe("loading");

    await act(async () => {
      fake.respondOnce(0, jsonResponse(404, ERROR_RESPONSE));
      await promise;
    });

    expect(status(result.current.state)).toBe("error");
    if (result.current.state.status === "error") {
      expect(result.current.state.code).toBe("REPO_NOT_FOUND");
      expect(result.current.state.repoUrl).toBe("https://github.com/octocat/missing");
    }
    vi.unstubAllGlobals();
  });

  it("aborts a previous in-flight request when a new one starts", async () => {
    const fake = new FakeFetch();
    vi.stubGlobal("fetch", fake.fetchImpl);

    const { result } = renderHook(() => useAnalyze());

    act(() => {
      void result.current.analyze("https://github.com/octocat/first");
    });
    act(() => {
      void result.current.analyze("https://github.com/octocat/second");
    });

    expect(fake.calls).toHaveLength(2);
    expect(status(result.current.state)).toBe("loading");
    if (result.current.state.status === "loading") {
      expect(result.current.state.repoUrl).toBe("https://github.com/octocat/second");
    }

    const first = fake.deferred[0];
    const second = fake.deferred[1];
    fake.deferred.length = 0;

    await act(async () => {
      first?.resolve(jsonResponse(200, fixtureAnalyzeResponse()));
      second?.resolve(jsonResponse(200, fixtureAnalyzeResponse()));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(status(result.current.state)).toBe("success");
    if (result.current.state.status === "success") {
      expect(result.current.state.repoUrl).toBe("https://github.com/octocat/second");
    }
    vi.unstubAllGlobals();
  });

  it("reset returns the machine to idle", async () => {
    const fake = new FakeFetch();
    vi.stubGlobal("fetch", fake.fetchImpl);

    const { result } = renderHook(() => useAnalyze());

    let promise: Promise<void> = Promise.resolve();
    act(() => {
      promise = result.current.analyze("https://github.com/octocat/hello-world");
    });
    await act(async () => {
      fake.respondOnce(0, jsonResponse(200, fixtureAnalyzeResponse()));
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

    const { result } = renderHook(() => useAnalyze());

    act(() => {
      void result.current.analyze("https://github.com/octocat/first");
    });
    act(() => {
      void result.current.analyze("https://github.com/octocat/second");
    });

    const first = fake.deferred[0];
    const second = fake.deferred[1];
    fake.deferred.length = 0;

    await act(async () => {
      first?.resolve(jsonResponse(200, fixtureAnalyzeResponse()));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(status(result.current.state)).toBe("loading");

    await act(async () => {
      second?.resolve(jsonResponse(404, ERROR_RESPONSE));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(status(result.current.state)).toBe("error");
    if (result.current.state.status === "error") {
      expect(result.current.state.repoUrl).toBe("https://github.com/octocat/second");
    }
    vi.unstubAllGlobals();
  });
});
