# Runtime Integration

Governix is a sidecar control plane. It does not proxy Bedrock traffic.

## Integration sequence

1. Your app calls `POST /api/runtime/policy/evaluate`.
2. Governix returns the final policy/quota decision.
3. Your app enforces that decision.
4. Your app calls Bedrock directly.
5. Your app sends `POST /api/runtime/events` after the request completes.

## Decision handling contract

Your application must enforce the returned decision:

- `allow`: continue with the original request
- `deny`: stop the request and return your application error
- `force_filter`: apply the returned retrieval filter before retrieval
- `downgrade_model`: replace the requested model with `finalModelId`
- `quota_block`: stop the request due to quota exhaustion

Important:

- Governix does not execute `downgrade_model` for you.
- Governix does not block Bedrock traffic inline.
- Governix stores summaries and metadata only, not raw prompt/response bodies.

## Minimal request flow

Before Bedrock:

```ts
const policy = await client.evaluatePolicy({
  tenant: { tenantId },
  application: { applicationId },
  request: {
    requestType: "retrieve_and_generate",
    modelId: requestedModelId,
    kbId: requestedKbId,
    requireCitation: true,
    requestRateSnapshot: 12
  }
});
```

After Bedrock:

```ts
await client.emitRuntimeEvent({
  requestId,
  tenant: { tenantId, userId, sessionId },
  application: { applicationId },
  request: {
    requestType: "retrieve_and_generate",
    rawQuerySummary: "Customer asked about API key rotation.",
    modelId: requestedModelId,
    kbId: requestedKbId
  },
  policy,
  retrieval: {
    chunkRefs: citations
  },
  generation: {
    summary: "Rotating the application API key requires a console action.",
    citationsPresent: citations.length > 0,
    status: "success",
    latencyMs,
    inputTokens,
    outputTokens,
    embeddingCount: 0,
    estimatedCost
  },
  error: null,
  timestamp: new Date().toISOString()
});
```

## Example code

- [examples/runtime-sdk-ts/minimal.ts](../examples/runtime-sdk-ts/minimal.ts)
- [examples/runtime-sdk-ts/retrieve-and-generate.ts](../examples/runtime-sdk-ts/retrieve-and-generate.ts)
