import { attachControlPlaneClient } from "@governix/runtime-sdk-ts";

const client = attachControlPlaneClient({
  baseUrl: process.env.GOVERNIX_BASE_URL ?? "http://127.0.0.1:3000",
  apiKey: process.env.GOVERNIX_RUNTIME_API_KEY ?? "govx_demo_app_key"
});

async function runMinimalRuntimeFlow() {
  const tenantId = "22222222-2222-2222-2222-222222222221";
  const applicationId = "33333333-3333-3333-3333-333333333331";
  const requestId = `req_example_${Date.now()}`;

  const policy = await client.evaluatePolicy({
    tenant: { tenantId },
    application: { applicationId },
    request: {
      requestType: "retrieve_and_generate",
      modelId: "anthropic.claude-3-5-sonnet",
      kbId: "kb-acme",
      requireCitation: true,
      requestRateSnapshot: 8
    }
  });

  if (policy.finalAction === "deny" || policy.finalAction === "quota_block") {
    throw new Error(`Request blocked by Governix: ${policy.finalAction}`);
  }

  const modelId = policy.finalAction === "downgrade_model" ? policy.finalModelId ?? "anthropic.claude-3-haiku" : "anthropic.claude-3-5-sonnet";

  if (policy.finalAction === "force_filter") {
    console.log("Apply retrieval filter before Bedrock or KB retrieval:", policy.retrievalFilter);
  }

  console.log("Call Bedrock directly here with model:", modelId);

  await client.emitRuntimeEvent({
    requestId,
    tenant: {
      tenantId,
      userId: "end-user-123",
      sessionId: "session-123"
    },
    application: { applicationId },
    request: {
      requestType: "retrieve_and_generate",
      rawQuerySummary: "Customer asked how to rotate an application API key.",
      modelId,
      kbId: "kb-acme"
    },
    policy,
    retrieval: {
      chunkRefs: [
        {
          documentId: "doc-api-key-1",
          chunkId: "chunk-1",
          score: 0.92,
          summary: "API key rotation guidance"
        }
      ]
    },
    generation: {
      summary: "Open the application detail page and rotate the API key from the console.",
      citationsPresent: true,
      status: "success",
      latencyMs: 1250,
      inputTokens: 840,
      outputTokens: 140,
      embeddingCount: 0,
      estimatedCost: 0.0194
    },
    error: null,
    timestamp: new Date().toISOString()
  });
}

void runMinimalRuntimeFlow();
