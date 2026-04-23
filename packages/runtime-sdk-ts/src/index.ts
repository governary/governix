import { z } from "zod";

import {
  RUNTIME_API_KEY_HEADER,
  policyEvaluationResultSchema,
  runtimeEventAcceptedSchema,
  runtimeEvaluateRequestSchema,
  runtimeEventRequestSchema,
  type RuntimeEvaluateRequest,
  type RuntimeEventRequest
} from "@governix/shared";

const evaluateResponseSchema = z.object({
  data: policyEvaluationResultSchema
});

const eventResponseSchema = z.object({
  data: runtimeEventAcceptedSchema
});

export type ControlPlaneClientConfig = {
  baseUrl: string;
  apiKey: string;
  fetch?: typeof fetch;
};

type RequestOptions = {
  signal?: AbortSignal;
};

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function createHeaders(apiKey: string) {
  return {
    "content-type": "application/json",
    [RUNTIME_API_KEY_HEADER]: apiKey
  };
}

async function parseJsonResponse(response: Response) {
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && payload.error && typeof payload.error === "object" && "message" in payload.error
        ? String(payload.error.message)
        : `Control plane request failed with status ${response.status}.`;

    throw new Error(message);
  }

  return payload;
}

export function attachControlPlaneClient(config: ControlPlaneClientConfig) {
  const fetchImpl = config.fetch ?? fetch;
  const baseUrl = normalizeBaseUrl(config.baseUrl);

  return {
    async evaluatePolicy(input: RuntimeEvaluateRequest, options?: RequestOptions) {
      const payload = runtimeEvaluateRequestSchema.parse(input);
      const response = await fetchImpl(`${baseUrl}/api/runtime/policy/evaluate`, {
        method: "POST",
        headers: createHeaders(config.apiKey),
        body: JSON.stringify(payload),
        signal: options?.signal
      });

      return evaluateResponseSchema.parse(await parseJsonResponse(response)).data;
    },

    async emitRuntimeEvent(input: RuntimeEventRequest, options?: RequestOptions) {
      const payload = runtimeEventRequestSchema.parse(input);
      const response = await fetchImpl(`${baseUrl}/api/runtime/events`, {
        method: "POST",
        headers: createHeaders(config.apiKey),
        body: JSON.stringify(payload),
        signal: options?.signal
      });

      return eventResponseSchema.parse(await parseJsonResponse(response)).data;
    }
  };
}

export async function evaluatePolicy(config: ControlPlaneClientConfig, input: RuntimeEvaluateRequest, options?: RequestOptions) {
  return attachControlPlaneClient(config).evaluatePolicy(input, options);
}

export async function emitRuntimeEvent(config: ControlPlaneClientConfig, input: RuntimeEventRequest, options?: RequestOptions) {
  return attachControlPlaneClient(config).emitRuntimeEvent(input, options);
}
