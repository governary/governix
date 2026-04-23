import { expect, test } from "@playwright/test";
import dotenv from "dotenv";
import { eq } from "drizzle-orm";

import { getDb, policyEvaluationLogs, requestLedger } from "../../packages/db/src";
import { loginAsSeedAdmin } from "../fixtures/auth";

const ACME_TENANT_ID = "22222222-2222-2222-2222-222222222221";
const ACME_APP_ID = "33333333-3333-3333-3333-333333333331";
const NOVA_TENANT_ID = "22222222-2222-2222-2222-222222222223";
const NOVA_APP_ID = "33333333-3333-3333-3333-333333333333";
const RUNTIME_API_KEY = "govx_demo_app_key";

dotenv.config({ path: ".env" });

function runtimeHeaders(apiKey = RUNTIME_API_KEY) {
  return {
    "content-type": "application/json",
    "x-governix-api-key": apiKey
  };
}

test("runtime policy evaluate rejects missing or disabled application API key access", async ({ page }) => {
  const missingKeyResponse = await page.request.post("/api/runtime/policy/evaluate", {
    data: {
      tenant: { tenantId: ACME_TENANT_ID },
      application: { applicationId: ACME_APP_ID },
      request: {
        requestType: "retrieve_and_generate",
        modelId: "anthropic.claude-3-5-sonnet",
        kbId: "kb-acme",
        requireCitation: true,
        requestRateSnapshot: 12
      }
    },
    maxRedirects: 0
  });

  expect(missingKeyResponse.status()).toBe(401);
  await expect(missingKeyResponse.json()).resolves.toMatchObject({
    error: {
      code: "UNAUTHORIZED"
    }
  });

  const disabledAppResponse = await page.request.post("/api/runtime/policy/evaluate", {
    headers: runtimeHeaders(),
    data: {
      tenant: { tenantId: NOVA_TENANT_ID },
      application: { applicationId: NOVA_APP_ID },
      request: {
        requestType: "retrieve_and_generate",
        modelId: "anthropic.claude-3-haiku",
        kbId: "kb-nova",
        requireCitation: true,
        requestRateSnapshot: 3
      }
    },
    maxRedirects: 0
  });

  expect(disabledAppResponse.status()).toBe(401);
  await expect(disabledAppResponse.json()).resolves.toMatchObject({
    error: {
      code: "UNAUTHORIZED"
    }
  });
});

test("runtime policy evaluate validates payloads and returns quota-driven downgrade results", async ({ page }) => {
  await loginAsSeedAdmin(page);

  const invalidPayloadResponse = await page.request.post("/api/runtime/policy/evaluate", {
    headers: runtimeHeaders(),
    data: {
      tenant: { tenantId: ACME_TENANT_ID },
      application: { applicationId: ACME_APP_ID },
      request: {
        requestType: "retrieve_and_generate"
      }
    }
  });

  expect(invalidPayloadResponse.status()).toBe(400);
  await expect(invalidPayloadResponse.json()).resolves.toMatchObject({
    error: {
      code: "VALIDATION_ERROR"
    }
  });

  const originalQuotaResponse = await page.request.get(`/api/tenants/${ACME_TENANT_ID}/quotas`);
  expect(originalQuotaResponse.ok()).toBeTruthy();

  const originalQuotaPayload = (await originalQuotaResponse.json()) as {
    data: {
      requestLimitMonthly: number | null;
      tokenLimitMonthly: number | null;
      costLimitMonthly: string | null;
      softThresholdPercent: number;
      hardThresholdPercent: number;
    } | null;
  };

  expect(originalQuotaPayload.data).not.toBeNull();

  const db = getDb();
  await db.insert(requestLedger).values({
    requestId: `req_quota_seed_${Date.now()}`,
    tenantId: ACME_TENANT_ID,
    applicationId: ACME_APP_ID,
    requestType: "retrieve_and_generate",
    rawQuerySummary: "Quota threshold seed event",
    selectedModelId: "anthropic.claude-3-5-sonnet",
    selectedKbId: "kb-acme",
    policyResultJson: {
      matchedPolicyIds: ["44444444-4444-4444-4444-444444444441"],
      finalAction: "allow",
      reasons: ["Quota threshold seed event"]
    },
    retrievalFilterJson: { tenantId: ACME_TENANT_ID },
    retrievedChunksJson: [],
    generationSummaryText: "Quota seed",
    citationsPresent: true,
    status: "success",
    latencyMs: 100,
    inputTokens: 10,
    outputTokens: 10,
    embeddingCount: 0,
    estimatedCost: "0.001000",
    createdAt: new Date()
  });

  await page.request.patch(`/api/tenants/${ACME_TENANT_ID}/quotas`, {
    data: {
      requestLimitMonthly: 1,
      tokenLimitMonthly: null,
      costLimitMonthly: null,
      softThresholdPercent: 80,
      hardThresholdPercent: 100
    }
  });

  try {
    const response = await page.request.post("/api/runtime/policy/evaluate", {
      headers: runtimeHeaders(),
      data: {
        tenant: { tenantId: ACME_TENANT_ID },
        application: { applicationId: ACME_APP_ID },
        request: {
          requestType: "retrieve_and_generate",
          modelId: "anthropic.claude-3-5-sonnet",
          kbId: "kb-acme",
          requireCitation: true,
          requestRateSnapshot: 12
        }
      }
    });

    expect(response.ok()).toBeTruthy();
    await expect(response.json()).resolves.toMatchObject({
      data: {
        matchedPolicyIds: ["44444444-4444-4444-4444-444444444441"],
        finalAction: "downgrade_model",
        finalModelId: "anthropic.claude-3-haiku",
        finalKbId: "kb-acme"
      }
    });
  } finally {
    await page.request.patch(`/api/tenants/${ACME_TENANT_ID}/quotas`, {
      data: originalQuotaPayload.data
    });
  }
});

test("runtime events persist request ledger and policy evaluation logs", async ({ page }) => {
  const requestId = `req_runtime_${Date.now()}`;

  const response = await page.request.post("/api/runtime/events", {
    headers: runtimeHeaders(),
    data: {
      requestId,
      tenant: {
        tenantId: ACME_TENANT_ID,
        userId: "user-runtime-1",
        sessionId: "session-runtime-1"
      },
      application: {
        applicationId: ACME_APP_ID
      },
      request: {
        requestType: "retrieve_and_generate",
        rawQuerySummary: "How do I rotate my API key?",
        modelId: "anthropic.claude-3-5-sonnet",
        kbId: "kb-acme"
      },
      policy: {
        matchedPolicyIds: ["44444444-4444-4444-4444-444444444441"],
        finalAction: "force_filter",
        finalModelId: "anthropic.claude-3-5-sonnet",
        finalKbId: "kb-acme",
        retrievalFilter: {
          tenantId: ACME_TENANT_ID,
          allowedKbIds: ["kb-acme"]
        },
        reasons: ["Tenant policy matched."]
      },
      retrieval: {
        chunkRefs: [
          {
            documentId: "doc-1",
            chunkId: "chunk-1",
            score: 0.92,
            summary: "API key rotation guidance"
          }
        ]
      },
      generation: {
        summary: "Rotate the key from the application settings page.",
        citationsPresent: true,
        status: "success",
        latencyMs: 1420,
        inputTokens: 840,
        outputTokens: 140,
        embeddingCount: 0,
        estimatedCost: 0.0194
      },
      error: null,
      timestamp: "2026-04-23T10:00:00Z"
    }
  });

  expect(response.status()).toBe(201);
  await expect(response.json()).resolves.toMatchObject({
    message: "Runtime event accepted.",
    data: {
      accepted: true,
      requestId
    }
  });

  const db = getDb();
  const [ledgerEntry] = await db.select().from(requestLedger).where(eq(requestLedger.requestId, requestId)).limit(1);
  const [policyLog] = await db.select().from(policyEvaluationLogs).where(eq(policyEvaluationLogs.requestId, requestId)).limit(1);

  expect(ledgerEntry).toMatchObject({
    requestId,
    tenantId: ACME_TENANT_ID,
    applicationId: ACME_APP_ID,
    requestType: "retrieve_and_generate",
    rawQuerySummary: "How do I rotate my API key?",
    selectedModelId: "anthropic.claude-3-5-sonnet",
    selectedKbId: "kb-acme",
    generationSummaryText: "Rotate the key from the application settings page.",
    citationsPresent: true,
    status: "success",
    latencyMs: 1420,
    inputTokens: 840,
    outputTokens: 140,
    embeddingCount: 0,
    errorCode: null,
    errorMessage: null
  });

  expect(policyLog).toMatchObject({
    requestId,
    tenantId: ACME_TENANT_ID,
    finalAction: "force_filter",
    finalModelId: "anthropic.claude-3-5-sonnet",
    finalKbId: "kb-acme",
    matchedPolicyIdsJson: ["44444444-4444-4444-4444-444444444441"]
  });
});
