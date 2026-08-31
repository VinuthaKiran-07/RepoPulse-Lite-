"use client";

import { useCallback, useEffect, useRef, useReducer } from "react";
import { analyzeRepo } from "@/lib/analyze-client";
import type { AnalyzeResponse } from "@/lib/api-types";

export type AnalyzeState =
  | { status: "idle" }
  | { status: "loading"; repoUrl: string }
  | { status: "success"; data: AnalyzeResponse; repoUrl: string }
  | {
      status: "error";
      code: string;
      message: string;
      retryAfterSeconds?: number;
      repoUrl: string;
    };

type AnalyzeAction =
  | { type: "START"; repoUrl: string }
  | { type: "SUCCESS"; data: AnalyzeResponse; repoUrl: string }
  | {
      type: "FAILURE";
      code: string;
      message: string;
      retryAfterSeconds?: number;
      repoUrl: string;
    }
  | { type: "RESET" };

function reducer(state: AnalyzeState, action: AnalyzeAction): AnalyzeState {
  switch (action.type) {
    case "START":
      return { status: "loading", repoUrl: action.repoUrl };
    case "SUCCESS":
      return { status: "success", data: action.data, repoUrl: action.repoUrl };
    case "FAILURE":
      return {
        status: "error",
        code: action.code,
        message: action.message,
        retryAfterSeconds: action.retryAfterSeconds,
        repoUrl: action.repoUrl,
      };
    case "RESET":
      return { status: "idle" };
  }
}

export function useAnalyze() {
  const [state, dispatch] = useReducer(reducer, { status: "idle" } as AnalyzeState);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const analyze = useCallback(async (repoUrl: string, token?: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    dispatch({ type: "START", repoUrl });

    const result = await analyzeRepo(repoUrl, {
      githubToken: token,
      signal: controller.signal,
    });

    if (controller.signal.aborted || !mountedRef.current) {
      return;
    }

    if (result.ok) {
      dispatch({ type: "SUCCESS", data: result.data, repoUrl });
    } else {
      dispatch({
        type: "FAILURE",
        code: result.error.code,
        message: result.error.message,
        retryAfterSeconds: result.error.retryAfterSeconds,
        repoUrl,
      });
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    if (mountedRef.current) {
      dispatch({ type: "RESET" });
    }
  }, []);

  return { state, analyze, reset };
}
