"use client";

import { useCallback, useEffect, useRef, useReducer } from "react";
import { requestAudit } from "@/lib/audit-client";
import type { AuditResponse, AuditState } from "@/lib/audit-types";

type AuditAction =
  | { type: "START" }
  | { type: "SUCCESS"; data: AuditResponse }
  | { type: "FAILURE"; code: string; message: string }
  | { type: "RESET" };

function reducer(state: AuditState, action: AuditAction): AuditState {
  switch (action.type) {
    case "START":
      return { status: "generating" };
    case "SUCCESS":
      return { status: "success", data: action.data };
    case "FAILURE":
      return {
        status: "error",
        code: action.code,
        message: action.message,
      };
    case "RESET":
      return { status: "idle" };
  }
}

export function useAudit() {
  const [state, dispatch] = useReducer(reducer, { status: "idle" } as AuditState);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const generate = useCallback(
    async (
      repoUrl: string,
      analysis: unknown,
      llm?: { baseUrl: string; model: string; apiKey: string }
    ) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      dispatch({ type: "START" });

      const result = await requestAudit(repoUrl, analysis, {
        llm,
        signal: controller.signal,
      });

      if (controller.signal.aborted || !mountedRef.current) {
        return;
      }

      if (result.ok) {
        dispatch({ type: "SUCCESS", data: result.data });
      } else {
        dispatch({
          type: "FAILURE",
          code: result.error.code,
          message: result.error.message,
        });
      }
    },
    []
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    if (mountedRef.current) {
      dispatch({ type: "RESET" });
    }
  }, []);

  return { state, generate, reset };
}
