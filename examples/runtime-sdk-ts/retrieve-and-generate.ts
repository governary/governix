import { attachControlPlaneClient } from "@governix/runtime-sdk-ts";

type Citation = {
  documentId: string;
  chunkId: string;
  score: number;
  summary: string;
};

async function callBedrockRetrieveAndGenerate(input: {
  modelId: string;
  kbId: string;
  query: string;
  retrievalFilter?: Record<string, unknown> | null;
}) {
  console.log("Replace this stub with AWS Bedrock RetrieveAndGenerate.");

  return {
    summary: `Answered with model ${input.modelId} against ${input.kbId}.`,
    citations: [
      {
        documentId: "doc-1",
        chunkId: "chunk-1",
        score: 0.97,
        summary: "RetrieveAndGenerate source chunk"
      }
    ] satisfies Citation[],
    latencyMs: 1450,
    inputTokens: 910,
    outputTokens: 180,
    estimatedCost: 0.0241
  };
}

async function main() {
  const client = attachControlPlaneClient({
    baseUrl: process.env.GOVERNIX_BASE_URL ?? "http://127.0.0.1:3000",
    apiKey: process.env.GOVERNIX_RUNTIME_API_KEY ?? "govx_demo_app_key"
  });

  const tenantId = "22222222-2222-2222-2222-222222222221";
  const applicationId = "33333333-3333-3333-3333-333333333331";
  const requestId = `req_rag_example_${Date.now()}`;
  const requestedModelId = "anthropic.claude-3-5-sonnet";
  const requestedKbId = "kb-acme";
  const query = "How do I rotate the application API key safely?";

  const policy = await client.evaluatePolicy({
    tenant: { tenantId },
    application: { applicationId },
    request: {
      requestType: "retrieve_and_generate",
      modelId: requestedModelId,
      kbId: requestedKbId,
      requireCitation: true,
      requestRateSnapshot: 11
    }
  });

  if (policy.finalAction === "deny") {
    throw new Error("Governix denied the request.");
  }

  if (policy.finalAction === "quota_block") {
    throw new Error("Governix reported quota exhaustion. Your application must stop the request.");
  }

  const effectiveModelId = policy.finalAction === "downgrade_model" ? policy.finalModelId ?? requestedModelId : requestedModelId;
  const effectiveKbId = policy.finalKbId ?? requestedKbId;

  const result = await callBedrockRetrieveAndGenerate({
    modelId: effectiveModelId,
    kbId: effectiveKbId,
    query,
    retrievalFilter: policy.retrievalFilter ?? null
  });

  await client.emitRuntimeEvent({
    requestId,
    tenant: {
      tenantId,
      userId: "end-user-456",
      sessionId: "session-456"
    },
    application: { applicationId },
    request: {
      requestType: "retrieve_and_generate",
      rawQuerySummary: query,
      modelId: effectiveModelId,
      kbId: effectiveKbId
    },
    policy,
    retrieval: {
      chunkRefs: result.citations
    },
    generation: {
      summary: result.summary,
      citationsPresent: result.citations.length > 0,
      status: "success",
      latencyMs: result.latencyMs,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      embeddingCount: 0,
      estimatedCost: result.estimatedCost
    },
    error: null,
    timestamp: new Date().toISOString()
  });
}

void main();
