import { LlmError, toLlmError } from "@/lib/llm/errors";
import type { ChatMessage, LlmConfig } from "@/lib/llm/types";

export interface ChatCompletionOptions {
  temperature?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export async function chatCompletion(
  config: LlmConfig,
  messages: ChatMessage[],
  options?: ChatCompletionOptions
): Promise<string> {
  const temperature = options?.temperature ?? 0.2;
  const timeoutMs = options?.timeoutMs ?? 30000;
  const url = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;

  const controller = new AbortController();
  const externalSignal = options?.signal;
  const onExternalAbort = () => {
    controller.abort();
  };
  if (externalSignal !== undefined) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", onExternalAbort);
    }
  }
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({ model: config.model, messages, temperature }),
      signal: controller.signal,
    });
  } catch (err) {
    if (controller.signal.aborted) {
      throw new LlmError({
        code: "LLM_TIMEOUT",
        status: 504,
        safeMessage: "The LLM provider took too long to respond.",
        internalDetail: `Request aborted after ${timeoutMs}ms`,
        cause: err,
      });
    }
    throw toLlmError(err);
  } finally {
    clearTimeout(timer);
    if (externalSignal !== undefined) {
      externalSignal.removeEventListener("abort", onExternalAbort);
    }
  }

  if (!response.ok) {
    if (response.status === 429) {
      const retryAfterHeader = response.headers.get("retry-after");
      const parsedRetryAfter =
        retryAfterHeader === null ? NaN : Number(retryAfterHeader);
      const retryAfterSeconds =
        Number.isInteger(parsedRetryAfter) && parsedRetryAfter > 0
          ? parsedRetryAfter
          : null;
      throw new LlmError({
        code: "LLM_UPSTREAM_ERROR",
        status: 429,
        safeMessage:
          "The LLM provider is rate-limiting requests. Please try again shortly.",
        internalDetail: `LLM provider responded with HTTP 429`,
        retryAfterSeconds,
      });
    }
    throw new LlmError({
      code: "LLM_UPSTREAM_ERROR",
      status: response.status,
      safeMessage: `The LLM provider returned an error (HTTP ${response.status}).`,
      internalDetail: `LLM provider responded with HTTP ${response.status}`,
    });
  }

  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch (err) {
    throw toLlmError(err);
  }

  const parsedObject = parsed as {
    choices?: unknown;
  };
  if (
    typeof parsedObject !== "object" ||
    parsedObject === null ||
    !Array.isArray(parsedObject.choices) ||
    parsedObject.choices.length === 0
  ) {
    throw new LlmError({
      code: "LLM_BAD_RESPONSE",
      status: 502,
      safeMessage: "The LLM provider returned an unreadable response.",
    });
  }

  const content = (parsedObject.choices[0] as {
    message?: { content?: unknown };
  })?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new LlmError({
      code: "LLM_EMPTY_CONTENT",
      status: 502,
      safeMessage: "The LLM provider returned an empty report.",
    });
  }
  return content;
}
