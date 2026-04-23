import { expect, test } from "@playwright/test";
import dotenv from "dotenv";
import { and, eq, gte, inArray, lte } from "drizzle-orm";

import { auditExports, getDb, requestLedger } from "../../packages/db/src";
import { loginAsSeedAdmin } from "../fixtures/auth";

const ACME_TENANT_ID = "22222222-2222-2222-2222-222222222221";
const GLOBALTECH_TENANT_ID = "22222222-2222-2222-2222-222222222222";
const ACME_APP_ID = "33333333-3333-3333-3333-333333333331";
const GLOBALTECH_APP_ID = "33333333-3333-3333-3333-333333333332";
const REPORT_DATE = "2026-04-25";

dotenv.config({ path: ".env" });

async function seedLedgerFacts() {
  const db = getDb();
  const reportStart = new Date(`${REPORT_DATE}T00:00:00Z`);
  const reportEnd = new Date(`${REPORT_DATE}T23:59:59.999Z`);

  await db
    .delete(requestLedger)
    .where(
      and(
        inArray(requestLedger.tenantId, [ACME_TENANT_ID, GLOBALTECH_TENANT_ID]),
        inArray(requestLedger.applicationId, [ACME_APP_ID, GLOBALTECH_APP_ID]),
        gte(requestLedger.createdAt, reportStart),
        lte(requestLedger.createdAt, reportEnd)
      )
    );

  await db
    .delete(auditExports)
    .where(and(gte(auditExports.dateFrom, reportStart), lte(auditExports.dateTo, reportEnd)));

  const requestId = `req_ledger_focus_${Date.now()}`;

  await db.insert(requestLedger).values([
    {
      requestId,
      tenantId: ACME_TENANT_ID,
      applicationId: ACME_APP_ID,
      userId: "user-ledger-1",
      sessionId: "session-ledger-1",
      requestType: "retrieve_and_generate",
      rawQuerySummary: "How do I rotate an API key safely?",
      selectedModelId: "anthropic.claude-3-5-sonnet",
      selectedKbId: "kb-acme",
      policyResultJson: {
        matchedPolicyIds: ["44444444-4444-4444-4444-444444444441"],
        finalAction: "force_filter",
        finalModelId: "anthropic.claude-3-5-sonnet",
        finalKbId: "kb-acme",
        retrievalFilter: { tenantId: ACME_TENANT_ID },
        reasons: ["Tenant policy matched."]
      },
      retrievalFilterJson: { tenantId: ACME_TENANT_ID },
      retrievedChunksJson: [{ chunkId: "chunk-ledger-1", summary: "Key rotation procedure" }],
      generationSummaryText: "Rotate the key and store the plaintext once.",
      citationsPresent: true,
      status: "success",
      latencyMs: 650,
      inputTokens: 500,
      outputTokens: 120,
      embeddingCount: 1,
      estimatedCost: "0.012000",
      errorCode: null,
      errorMessage: null,
      createdAt: new Date(`${REPORT_DATE}T09:00:00Z`)
    },
    {
      requestId: `req_ledger_blocked_${Date.now()}`,
      tenantId: ACME_TENANT_ID,
      applicationId: ACME_APP_ID,
      requestType: "generate",
      rawQuerySummary: "Generate support response.",
      selectedModelId: "anthropic.claude-3-haiku",
      selectedKbId: null,
      policyResultJson: {
        matchedPolicyIds: ["44444444-4444-4444-4444-444444444441"],
        finalAction: "quota_block",
        reasons: ["Hard limit reached."]
      },
      retrievalFilterJson: null,
      retrievedChunksJson: [],
      generationSummaryText: "Request blocked.",
      citationsPresent: false,
      status: "blocked",
      latencyMs: 55,
      inputTokens: 100,
      outputTokens: 0,
      embeddingCount: 0,
      estimatedCost: "0.001000",
      errorCode: "QUOTA_BLOCK",
      errorMessage: "Tenant quota exceeded.",
      createdAt: new Date(`${REPORT_DATE}T10:00:00Z`)
    },
    {
      requestId: `req_ledger_global_${Date.now()}`,
      tenantId: GLOBALTECH_TENANT_ID,
      applicationId: GLOBALTECH_APP_ID,
      requestType: "retrieve",
      rawQuerySummary: "Retrieve support article.",
      selectedModelId: "anthropic.claude-3-5-sonnet",
      selectedKbId: "kb-globaltech",
      policyResultJson: {
        matchedPolicyIds: ["44444444-4444-4444-4444-444444444442"],
        finalAction: "allow",
        reasons: ["Allowed request."]
      },
      retrievalFilterJson: { tenantId: GLOBALTECH_TENANT_ID },
      retrievedChunksJson: [{ chunkId: "chunk-ledger-2", summary: "GlobalTech article" }],
      generationSummaryText: null,
      citationsPresent: false,
      status: "success",
      latencyMs: 300,
      inputTokens: 210,
      outputTokens: 0,
      embeddingCount: 1,
      estimatedCost: "0.004000",
      errorCode: null,
      errorMessage: null,
      createdAt: new Date(`${REPORT_DATE}T11:00:00Z`)
    }
  ]);

  return { requestId };
}

test("ledger APIs support filtered list, request detail, and async export download", async ({ page }) => {
  await loginAsSeedAdmin(page);
  const { requestId } = await seedLedgerFacts();

  const listResponse = await page.request.get(
    `/api/ledger?tenant_id=${ACME_TENANT_ID}&status=success&date_from=${REPORT_DATE}&date_to=${REPORT_DATE}&page=1&page_size=10`
  );
  expect(listResponse.ok()).toBeTruthy();

  const listPayload = (await listResponse.json()) as {
    data: {
      items: Array<{ requestId: string; tenantId: string; status: string }>;
      total: number;
    };
  };

  expect(listPayload.data.total).toBeGreaterThanOrEqual(1);
  expect(listPayload.data.items).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        requestId,
        tenantId: ACME_TENANT_ID,
        status: "success"
      })
    ])
  );

  const detailResponse = await page.request.get(`/api/ledger/${requestId}`);
  expect(detailResponse.ok()).toBeTruthy();

  const detailPayload = (await detailResponse.json()) as {
    data: {
      requestId: string;
      rawQuerySummary: string;
      policyResultJson: { finalAction: string };
      retrievalFilterJson: Record<string, unknown>;
      generationSummaryText: string;
      inputTokens: number;
      latencyMs: number;
    };
  };

  expect(detailPayload.data).toMatchObject({
    requestId,
    rawQuerySummary: "How do I rotate an API key safely?",
    generationSummaryText: "Rotate the key and store the plaintext once.",
    inputTokens: 500,
    latencyMs: 650
  });
  expect(detailPayload.data.policyResultJson.finalAction).toBe("force_filter");
  expect(detailPayload.data.retrievalFilterJson).toMatchObject({ tenantId: ACME_TENANT_ID });

  const exportResponse = await page.request.post("/api/ledger/export", {
    data: {
      tenant_ids: [ACME_TENANT_ID],
      date_from: `${REPORT_DATE}T00:00:00Z`,
      date_to: `${REPORT_DATE}T23:59:59Z`,
      format: "csv"
    }
  });
  expect(exportResponse.status()).toBe(202);

  const exportPayload = (await exportResponse.json()) as {
    data: {
      exportId: string;
      status: string;
    };
  };

  expect(exportPayload.data.status).toBe("pending");

  let statusPayload:
    | {
        data: {
          id: string;
          status: string;
          fileUrl: string | null;
        };
      }
    | undefined;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const statusResponse = await page.request.get(`/api/ledger/exports/${exportPayload.data.exportId}`);
    expect(statusResponse.ok()).toBeTruthy();
    statusPayload = (await statusResponse.json()) as typeof statusPayload;

    if (statusPayload?.data.status === "ready" && statusPayload.data.fileUrl) {
      break;
    }

    await page.waitForTimeout(250);
  }

  expect(statusPayload?.data.status).toBe("ready");
  expect(statusPayload?.data.fileUrl).toBeTruthy();

  const downloadResponse = await page.request.get(statusPayload!.data.fileUrl!);
  expect(downloadResponse.ok()).toBeTruthy();
  expect(downloadResponse.headers()["content-type"]).toContain("text/csv");

  const csvText = await downloadResponse.text();
  expect(csvText).toContain("request_id,tenant_name,application_name");
  expect(csvText).toContain(requestId);
  expect(csvText).toContain("showback_estimate");
});

test("ledger page and tenant detail shortcut show request evidence and export controls", async ({ page }) => {
  await loginAsSeedAdmin(page);
  const { requestId } = await seedLedgerFacts();

  await page.goto("/ledger");
  await page.getByLabel("Tenant").selectOption(ACME_TENANT_ID);
  await page.getByLabel("Date from").fill(REPORT_DATE);
  await page.getByLabel("Date to").fill(REPORT_DATE);
  await page.getByLabel("Status").selectOption("success");
  await page.getByRole("button", { name: "Refresh ledger" }).click();

  await expect(page.getByRole("heading", { name: "Audit Ledger" })).toBeVisible();
  await expect(page.getByText(requestId, { exact: false }).first()).toBeVisible();
  await page.getByRole("button", { name: `View ${requestId}` }).click();
  await expect(page.getByText("Rotate the key and store the plaintext once.")).toBeVisible();
  await expect(page.getByText("Tenant policy matched.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Export CSV" })).toBeVisible();

  await page.goto(`/tenants/${ACME_TENANT_ID}?tab=ledger`);
  await expect(page.getByText("Recent ledger activity")).toBeVisible();
  await expect(page.getByRole("link", { name: requestId })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open full ledger" })).toBeVisible();
});
