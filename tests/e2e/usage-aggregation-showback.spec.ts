import { expect, test } from "@playwright/test";
import dotenv from "dotenv";
import { and, eq, gte, inArray, lte } from "drizzle-orm";

import { getDb, requestLedger, usageDaily } from "../../packages/db/src";
import { loginAsSeedAdmin } from "../fixtures/auth";

const ACME_TENANT_ID = "22222222-2222-2222-2222-222222222221";
const GLOBALTECH_TENANT_ID = "22222222-2222-2222-2222-222222222222";
const ACME_APP_ID = "33333333-3333-3333-3333-333333333331";
const GLOBALTECH_APP_ID = "33333333-3333-3333-3333-333333333332";
const REPORT_DATE = "2026-04-24";

dotenv.config({ path: ".env" });

async function seedUsageLedgerFacts() {
  const db = getDb();
  const reportStart = new Date(`${REPORT_DATE}T00:00:00Z`);
  const reportEnd = new Date(`${REPORT_DATE}T23:59:59.999Z`);

  await db
    .delete(usageDaily)
    .where(
      and(
        inArray(usageDaily.tenantId, [ACME_TENANT_ID, GLOBALTECH_TENANT_ID]),
        inArray(usageDaily.applicationId, [ACME_APP_ID, GLOBALTECH_APP_ID]),
        eq(usageDaily.usageDate, REPORT_DATE)
      )
    );

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

  await db.insert(requestLedger).values([
    {
      requestId: `req_usage_acme_rag_${Date.now()}`,
      tenantId: ACME_TENANT_ID,
      applicationId: ACME_APP_ID,
      requestType: "retrieve_and_generate",
      rawQuerySummary: "How do I reset MFA?",
      selectedModelId: "anthropic.claude-3-5-sonnet",
      selectedKbId: "kb-acme",
      policyResultJson: {
        matchedPolicyIds: ["44444444-4444-4444-4444-444444444441"],
        finalAction: "allow",
        reasons: ["Seed usage event"]
      },
      retrievalFilterJson: { tenantId: ACME_TENANT_ID },
      retrievedChunksJson: [{ chunkId: "chunk-usage-1", summary: "MFA help" }],
      generationSummaryText: "Open security settings and rotate MFA.",
      citationsPresent: true,
      status: "success",
      latencyMs: 920,
      inputTokens: 1200,
      outputTokens: 300,
      embeddingCount: 4,
      estimatedCost: null,
      createdAt: new Date(`${REPORT_DATE}T10:00:00Z`)
    },
    {
      requestId: `req_usage_acme_blocked_${Date.now()}`,
      tenantId: ACME_TENANT_ID,
      applicationId: ACME_APP_ID,
      requestType: "generate",
      rawQuerySummary: "Generate escalation note.",
      selectedModelId: "anthropic.claude-3-haiku",
      selectedKbId: null,
      policyResultJson: {
        matchedPolicyIds: ["44444444-4444-4444-4444-444444444441"],
        finalAction: "quota_block",
        reasons: ["Seed blocked event"]
      },
      retrievalFilterJson: null,
      retrievedChunksJson: [],
      generationSummaryText: "Request blocked by quota.",
      citationsPresent: false,
      status: "blocked",
      latencyMs: 80,
      inputTokens: 100,
      outputTokens: 0,
      embeddingCount: 0,
      estimatedCost: "0.001000",
      createdAt: new Date(`${REPORT_DATE}T11:00:00Z`)
    },
    {
      requestId: `req_usage_globaltech_${Date.now()}`,
      tenantId: GLOBALTECH_TENANT_ID,
      applicationId: GLOBALTECH_APP_ID,
      requestType: "retrieve",
      rawQuerySummary: "Retrieve support playbook.",
      selectedModelId: "anthropic.claude-3-5-sonnet",
      selectedKbId: "kb-globaltech",
      policyResultJson: {
        matchedPolicyIds: ["44444444-4444-4444-4444-444444444442"],
        finalAction: "allow",
        reasons: ["Seed usage event"]
      },
      retrievalFilterJson: { tenantId: GLOBALTECH_TENANT_ID },
      retrievedChunksJson: [{ chunkId: "chunk-usage-2", summary: "Support playbook" }],
      generationSummaryText: null,
      citationsPresent: false,
      status: "success",
      latencyMs: 510,
      inputTokens: 400,
      outputTokens: 0,
      embeddingCount: 2,
      estimatedCost: "0.010000",
      createdAt: new Date(`${REPORT_DATE}T12:00:00Z`)
    }
  ]);
}

test("usage APIs aggregate request ledger facts, derive quota state, and export showback csv", async ({ page }) => {
  await loginAsSeedAdmin(page);
  await seedUsageLedgerFacts();

  const originalAcmeQuota = await page.request.get(`/api/tenants/${ACME_TENANT_ID}/quotas`);
  const originalGlobalTechQuota = await page.request.get(`/api/tenants/${GLOBALTECH_TENANT_ID}/quotas`);

  const acmeQuota = (await originalAcmeQuota.json()) as { data: Record<string, unknown> };
  const globalTechQuota = (await originalGlobalTechQuota.json()) as { data: Record<string, unknown> };

  await page.request.patch(`/api/tenants/${ACME_TENANT_ID}/quotas`, {
    data: {
      requestLimitMonthly: 5,
      tokenLimitMonthly: null,
      costLimitMonthly: null,
      softThresholdPercent: 80,
      hardThresholdPercent: 100
    }
  });

  await page.request.patch(`/api/tenants/${GLOBALTECH_TENANT_ID}/quotas`, {
    data: {
      requestLimitMonthly: 1,
      tokenLimitMonthly: null,
      costLimitMonthly: null,
      softThresholdPercent: 80,
      hardThresholdPercent: 100
    }
  });

  try {
    const summaryResponse = await page.request.get(
      `/api/usage/summary?date_from=${REPORT_DATE}&date_to=${REPORT_DATE}&group_by=tenant`
    );
    expect(summaryResponse.ok()).toBeTruthy();

    const summaryPayload = (await summaryResponse.json()) as {
      data: {
        groupBy: string;
        items: Array<{
          tenantId: string;
          tenantName: string;
          requestCount: number;
          estimatedCost: number;
          quotaUsagePercent: number | null;
          alertState: string | null;
        }>;
      };
    };

    expect(summaryPayload.data.groupBy).toBe("tenant");
    expect(summaryPayload.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tenantId: ACME_TENANT_ID,
          tenantName: "Acme Corp",
          requestCount: 2,
          alertState: "normal"
        }),
        expect.objectContaining({
          tenantId: GLOBALTECH_TENANT_ID,
          tenantName: "GlobalTech",
          requestCount: 1,
          quotaUsagePercent: 100,
          alertState: "hard_limit"
        })
      ])
    );

    const acmeDailyRows = await getDb()
      .select()
      .from(usageDaily)
      .where(
        and(
          eq(usageDaily.tenantId, ACME_TENANT_ID),
          eq(usageDaily.applicationId, ACME_APP_ID),
          gte(usageDaily.usageDate, REPORT_DATE),
          lte(usageDaily.usageDate, REPORT_DATE)
        )
      );

    expect(acmeDailyRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          usageDate: REPORT_DATE,
          ragRequestCount: 2,
          retrieveCount: 1,
          generateCount: 2,
          blockedCount: 1
        })
      ])
    );

    const tenantUsageResponse = await page.request.get(`/api/tenants/${ACME_TENANT_ID}/usage?date_from=${REPORT_DATE}&date_to=${REPORT_DATE}`);
    expect(tenantUsageResponse.ok()).toBeTruthy();

    const tenantUsagePayload = (await tenantUsageResponse.json()) as {
      data: {
        summary: {
          requestCount: number;
          blockedCount: number;
          quotaUsagePercent: number | null;
          alertState: string | null;
        };
        trend: Array<{ usageDate: string; requestCount: number; estimatedCost: number }>;
        applications: Array<{ applicationId: string; applicationName: string; requestCount: number }>;
      };
    };

    expect(tenantUsagePayload.data.summary).toMatchObject({
      requestCount: 2,
      blockedCount: 1,
      alertState: "normal"
    });
    expect(tenantUsagePayload.data.trend).toEqual(
      expect.arrayContaining([expect.objectContaining({ usageDate: REPORT_DATE, requestCount: 2 })])
    );
    expect(tenantUsagePayload.data.applications).toEqual(
      expect.arrayContaining([expect.objectContaining({ applicationId: ACME_APP_ID, requestCount: 2 })])
    );

    const csvResponse = await page.request.get(
      `/api/showback/report?date_from=${REPORT_DATE}&date_to=${REPORT_DATE}&format=csv`
    );
    expect(csvResponse.ok()).toBeTruthy();
    expect(csvResponse.headers()["content-type"]).toContain("text/csv");

    const csvText = await csvResponse.text();
    expect(csvText).toContain("tenant_name,application_name,model_id");
    expect(csvText).toContain("Acme Corp,web-assistant,anthropic.claude-3-5-sonnet");
    expect(csvText).toContain("GlobalTech,support-search,anthropic.claude-3-5-sonnet");
    expect(csvText).toContain("showback_estimate");
  } finally {
    await page.request.patch(`/api/tenants/${ACME_TENANT_ID}/quotas`, { data: acmeQuota.data });
    await page.request.patch(`/api/tenants/${GLOBALTECH_TENANT_ID}/quotas`, { data: globalTechQuota.data });
  }
});

test("usage page shows grouped usage views and export controls", async ({ page }) => {
  await loginAsSeedAdmin(page);
  await seedUsageLedgerFacts();

  await page.goto("/usage");

  await page.getByLabel("Date from").fill(REPORT_DATE);
  await page.getByLabel("Date to").fill(REPORT_DATE);
  await page.getByLabel("Group by").selectOption("tenant");
  await page.getByRole("button", { name: "Refresh usage" }).click();

  await expect(page.getByRole("heading", { name: "Usage" })).toBeVisible();
  await expect(page.getByText("Top tenants")).toBeVisible();
  await expect(page.getByText("Over-limit tenants")).toBeVisible();
  await expect(page.getByText("Cost hotspots")).toBeVisible();
  await expect(page.getByRole("link", { name: "Export CSV" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Acme Corp" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "GlobalTech" })).toBeVisible();
});
