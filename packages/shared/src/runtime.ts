import { z } from "zod";

import { policyEvaluationResultSchema, requestTypeSchema } from "./admin";

export const RUNTIME_API_KEY_HEADER = "x-governix-api-key";

export const ledgerStatusSchema = z.enum(["success", "blocked", "failed", "partial"]);

const optionalNullableString = z.preprocess((value) => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}, z.string().nullable());

const optionalNullableNumber = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return typeof value === "number" ? value : Number(value);
}, z.number().finite().nullable());

function pickString(source: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

function pickValue(source: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (key in source) {
      return source[key];
    }
  }

  return undefined;
}

const tenantContextSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object") {
    return value;
  }

  const source = value as Record<string, unknown>;
  return {
    tenantId: pickString(source, "tenantId", "tenant_id"),
    userId: pickValue(source, "userId", "user_id"),
    sessionId: pickValue(source, "sessionId", "session_id")
  };
}, z.object({
  tenantId: z.string().uuid(),
  userId: optionalNullableString.optional().default(null),
  sessionId: optionalNullableString.optional().default(null)
}));

const applicationContextSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object") {
    return value;
  }

  const source = value as Record<string, unknown>;
  return {
    applicationId: pickString(source, "applicationId", "application_id")
  };
}, z.object({
  applicationId: z.string().uuid()
}));

const runtimeRequestSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object") {
    return value;
  }

  const source = value as Record<string, unknown>;
  return {
    requestType: pickValue(source, "requestType", "request_type"),
    modelId: pickValue(source, "modelId", "requestedModelId", "model_id", "requested_model_id"),
    kbId: pickValue(source, "kbId", "requestedKbId", "kb_id", "requested_kb_id"),
    rawQuerySummary: pickValue(source, "rawQuerySummary", "raw_query_summary"),
    requireCitation: pickValue(source, "requireCitation", "requiresCitation", "require_citation", "requires_citation"),
    requestRateSnapshot: pickValue(source, "requestRateSnapshot", "request_rate_snapshot")
  };
}, z.object({
  requestType: requestTypeSchema,
  modelId: optionalNullableString.optional().default(null),
  kbId: optionalNullableString.optional().default(null),
  rawQuerySummary: optionalNullableString.optional().default(null),
  requireCitation: z.coerce.boolean().optional().default(false),
  requestRateSnapshot: optionalNullableNumber.optional().default(null)
}));

const runtimeEvaluateRequestPayloadSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object") {
    return value;
  }

  const source = value as Record<string, unknown>;
  return {
    requestType: pickValue(source, "requestType", "request_type"),
    modelId: pickString(source, "modelId", "requestedModelId", "model_id", "requested_model_id"),
    kbId: pickString(source, "kbId", "requestedKbId", "kb_id", "requested_kb_id"),
    requireCitation: pickValue(source, "requireCitation", "requiresCitation", "require_citation", "requires_citation"),
    requestRateSnapshot: pickValue(source, "requestRateSnapshot", "request_rate_snapshot")
  };
}, z.object({
  requestType: requestTypeSchema,
  modelId: z.string().min(1),
  kbId: z.string().min(1),
  requireCitation: z.coerce.boolean(),
  requestRateSnapshot: z.coerce.number().finite()
}));

export const runtimeEvaluateRequestSchema = z.object({
  tenant: tenantContextSchema.transform((value) => ({ tenantId: value.tenantId })),
  application: applicationContextSchema,
  request: runtimeEvaluateRequestPayloadSchema
});

export const runtimeChunkReferenceSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object") {
    return value;
  }

  const source = value as Record<string, unknown>;
  return {
    documentId: pickValue(source, "documentId", "docId", "document_id", "doc_id"),
    chunkId: pickValue(source, "chunkId", "chunk_id"),
    score: source.score,
    summary: source.summary
  };
}, z.object({
  documentId: optionalNullableString.optional().default(null),
  chunkId: optionalNullableString.optional().default(null),
  score: optionalNullableNumber.optional().default(null),
  summary: optionalNullableString.optional().default(null)
}));

const runtimePolicySchema = z.preprocess((value) => {
  if (!value || typeof value !== "object") {
    return value;
  }

  const source = value as Record<string, unknown>;
  return {
    matchedPolicyIds: pickValue(source, "matchedPolicyIds", "matched_policy_ids") ?? [],
    finalAction: pickValue(source, "finalAction", "final_action"),
    finalModelId: pickValue(source, "finalModelId", "final_model_id"),
    finalKbId: pickValue(source, "finalKbId", "final_kb_id"),
    retrievalFilter: pickValue(source, "retrievalFilter", "retrieval_filter") ?? null,
    reasons: source.reasons ?? []
  };
}, policyEvaluationResultSchema);

const runtimeRetrievalSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object") {
    return { chunkRefs: [] };
  }

  const source = value as Record<string, unknown>;
  return {
    chunkRefs: pickValue(source, "chunkRefs", "chunk_refs") ?? []
  };
}, z.object({
  chunkRefs: z.array(runtimeChunkReferenceSchema)
}));

const runtimeGenerationSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object") {
    return value;
  }

  const source = value as Record<string, unknown>;
  return {
    summary: source.summary,
    citationsPresent: pickValue(source, "citationsPresent", "citations_present"),
    status: source.status,
    latencyMs: pickValue(source, "latencyMs", "latency_ms"),
    inputTokens: pickValue(source, "inputTokens", "input_tokens"),
    outputTokens: pickValue(source, "outputTokens", "output_tokens"),
    embeddingCount: pickValue(source, "embeddingCount", "embedding_count"),
    estimatedCost: pickValue(source, "estimatedCost", "estimated_cost")
  };
}, z.object({
  summary: optionalNullableString.optional().default(null),
  citationsPresent: z.coerce.boolean().optional().default(false),
  status: ledgerStatusSchema,
  latencyMs: optionalNullableNumber.optional().default(null),
  inputTokens: optionalNullableNumber.optional().default(null),
  outputTokens: optionalNullableNumber.optional().default(null),
  embeddingCount: optionalNullableNumber.optional().default(null),
  estimatedCost: optionalNullableNumber.optional().default(null)
}));

const runtimeErrorSchema = z.preprocess((value) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "object") {
    return value;
  }

  const source = value as Record<string, unknown>;
  return {
    code: pickValue(source, "code", "errorCode", "error_code"),
    message: pickValue(source, "message", "errorMessage", "error_message")
  };
}, z.object({
  code: optionalNullableString.optional().default(null),
  message: optionalNullableString.optional().default(null)
}).nullable());

export const runtimeEventRequestSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object") {
    return value;
  }

  const source = value as Record<string, unknown>;
  return {
    requestId: pickString(source, "requestId", "request_id"),
    tenant: source.tenant,
    application: source.application,
    request: source.request,
    policy: source.policy,
    retrieval: source.retrieval,
    generation: source.generation,
    error: source.error,
    timestamp: source.timestamp
  };
}, z.object({
  requestId: z.string().min(1),
  tenant: tenantContextSchema,
  application: applicationContextSchema,
  request: runtimeRequestSchema.transform((value) => ({
    requestType: value.requestType,
    rawQuerySummary: value.rawQuerySummary,
    modelId: value.modelId,
    kbId: value.kbId
  })),
  policy: runtimePolicySchema,
  retrieval: runtimeRetrievalSchema.optional().default({ chunkRefs: [] }),
  generation: runtimeGenerationSchema,
  error: runtimeErrorSchema.optional().default(null),
  timestamp: z.string().datetime()
}));

export const runtimeEventAcceptedSchema = z.object({
  accepted: z.literal(true),
  requestId: z.string()
});

export type LedgerStatus = z.infer<typeof ledgerStatusSchema>;
export type RuntimeEvaluateRequest = z.infer<typeof runtimeEvaluateRequestSchema>;
export type RuntimeEventRequest = z.infer<typeof runtimeEventRequestSchema>;
export type RuntimeEventAccepted = z.infer<typeof runtimeEventAcceptedSchema>;
