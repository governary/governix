import { expect, test } from "@playwright/test";
import dotenv from "dotenv";
import { desc, gte } from "drizzle-orm";

import { getDb, requestLedger, tenants } from "../../packages/db/src";
import { loginAsSeedAdmin } from "../fixtures/auth";

const ACME_TENANT_ID = "22222222-2222-2222-2222-222222222221";
const GLOBALTECH_TENANT_ID = "22222222-2222-2222-2222-222222222222";
const NOVA_TENANT_ID = "22222222-2222-2222-2222-222222222223";
const ACME_APP_ID = "33333333-3333-3333-3333-333333333331";
const GLOBALTECH_APP_ID = "33333333-3333-3333-3333-333333333332";
const NOVA_APP_ID = "33333333-3333-3333-3333-333333333333";

dotenv.config({ path: ".env" });

function getMonthStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}

function getDayAgo() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000);
}

function formatWholeNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4
  }).format(value);
}

function parseNumber(text: string | null) {
  return Number((text ?? "").replace(/[^0-9.]/g, ""));
}

async function insertDashboardFixtureRows() {
  const db = getDb();
  const now = new Date();

  await db.insert(requestLedger).values([
    {
      requestId: `req_dash_warning_${Date.now()}`,
      tenantId: GLOBALTECH_TENANT_ID,
      applicationId: GLOBALTECH_APP_ID,
      requestType: "retrieve_and_generate",
      rawQuerySummary: "Dashboard warning fixture",
      selectedModelId: "anthropic.claude-3-5-sonnet",
      selectedKbId: "kb-globaltech",
      policyResultJson: {
        matchedPolicyIds: ["44444444-4444-4444-4444-444444444442"],
        finalAction: "allow",
        reasons: ["Dashboard warning fixture"]
      },
      retrievalFilterJson: { tenantId: GLOBALTECH_TENANT_ID },
      retrievedChunksJson: [],
      generationSummaryText: "Warning fixture",
      citationsPresent: false,
      status: "success",
      latencyMs: 340,
      inputTokens: 4000,
      outputTokens: 2000,
      embeddingCount: 0,
      estimatedCost: "260.000000",
      createdAt: now
    },
    {
      requestId: `req_dash_hard_${Date.now()}`,
      tenantId: NOVA_TENANT_ID,
      applicationId: NOVA_APP_ID,
      requestType: "retrieve_and_generate",
      rawQuerySummary: "Dashboard hard limit fixture",
      selectedModelId: "anthropic.claude-3-haiku",
      selectedKbId: "kb-nova",
      policyResultJson: {
        matchedPolicyIds: ["44444444-4444-4444-4444-444444444443"],
        finalAction: "quota_block",
        reasons: ["Dashboard hard limit fixture"]
      },
      retrievalFilterJson: { tenantId: NOVA_TENANT_ID },
      retrievedChunksJson: [],
      generationSummaryText: "Hard limit fixture",
      citationsPresent: true,
      status: "blocked",
      latencyMs: 180,
      inputTokens: 5000,
      outputTokens: 2500,
      embeddingCount: 0,
      estimatedCost: "180.000000",
      createdAt: now
    },
    {
      requestId: `req_dash_error_${Date.now()}`,
      tenantId: ACME_TENANT_ID,
      applicationId: ACME_APP_ID,
      requestType: "generate",
      rawQuerySummary: "Dashboard error fixture",
      selectedModelId: "anthropic.claude-3-5-sonnet",
      selectedKbId: "kb-acme",
      policyResultJson: {
        matchedPolicyIds: ["44444444-4444-4444-4444-444444444441"],
        finalAction: "allow",
        reasons: ["Dashboard error fixture"]
      },
      retrievalFilterJson: null,
      retrievedChunksJson: [],
      generationSummaryText: "Error fixture",
      citationsPresent: false,
      status: "failed",
      latencyMs: 120,
      inputTokens: 100,
      outputTokens: 0,
      embeddingCount: 0,
      estimatedCost: "0.010000",
      errorCode: "BEDROCK_TIMEOUT",
      errorMessage: "The upstream model timed out.",
      createdAt: now
    }
  ]);
}

async function getExpectedDashboardMetrics() {
  const db = getDb();
  const tenantRows = await db.select().from(tenants);
  const ledgerRows = await db
    .select()
    .from(requestLedger)
    .where(gte(requestLedger.createdAt, getMonthStart()))
    .orderBy(desc(requestLedger.createdAt));
  const last24hBoundary = getDayAgo();

  const totalRequests = ledgerRows.length;
  const totalTokens = ledgerRows.reduce((sum, row) => sum + (row.inputTokens ?? 0) + (row.outputTokens ?? 0), 0);
  const estimatedCost = ledgerRows.reduce((sum, row) => sum + Number(row.estimatedCost ?? 0), 0);
  const alertMap = new Map<string, "normal" | "warning" | "hard_limit">([
    [ACME_TENANT_ID, "normal"],
    [GLOBALTECH_TENANT_ID, "warning"],
    [NOVA_TENANT_ID, "hard_limit"]
  ]);

  return {
    totalTenants: tenantRows.length,
    totalRequests,
    totalTokens,
    estimatedCost,
    tenantsInAlert: Array.from(alertMap.values()).filter((value) => value === "warning" || value === "hard_limit").length,
    tenantsOverLimit: Array.from(alertMap.values()).filter((value) => value === "hard_limit").length,
    errors24h: ledgerRows.filter((row) => row.createdAt >= last24hBoundary && row.status === "failed").length,
    policyBlocks24h: ledgerRows.filter((row) => row.createdAt >= last24hBoundary && row.status === "blocked").length
  };
}

test("dashboard renders live KPI cards and risk tenants", async ({ page }) => {
  await insertDashboardFixtureRows();
  const expected = await getExpectedDashboardMetrics();

  await loginAsSeedAdmin(page);
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByTestId("dashboard-kpi-total-tenants")).toHaveText(formatWholeNumber(expected.totalTenants));
  expect(parseNumber(await page.getByTestId("dashboard-kpi-total-requests").textContent())).toBeGreaterThanOrEqual(3);
  expect(parseNumber(await page.getByTestId("dashboard-kpi-total-tokens").textContent())).toBeGreaterThan(0);
  expect(parseNumber(await page.getByTestId("dashboard-kpi-estimated-cost").textContent())).toBeGreaterThan(0);
  expect(parseNumber(await page.getByTestId("dashboard-kpi-tenants-in-alert").textContent())).toBeGreaterThanOrEqual(1);
  expect(parseNumber(await page.getByTestId("dashboard-kpi-tenants-over-limit").textContent())).toBeGreaterThanOrEqual(1);
  expect(parseNumber(await page.getByTestId("dashboard-kpi-errors-24h").textContent())).toBeGreaterThanOrEqual(1);
  expect(parseNumber(await page.getByTestId("dashboard-kpi-policy-blocks-24h").textContent())).toBeGreaterThanOrEqual(1);

  await expect(page.getByRole("heading", { name: "Risk tenants" })).toBeVisible();
  await expect(page.getByText("GlobalTech")).toBeVisible();
  await expect(page.getByText("Nova Health")).toBeVisible();
  await expect(page.getByTestId(`tenant-alert-state-${GLOBALTECH_TENANT_ID}`)).toHaveText(/warning|hard_limit/i);
  await expect(page.getByTestId(`tenant-alert-state-${NOVA_TENANT_ID}`)).toHaveText(/hard_limit/i);
});

test("tenant, tenant detail, and usage pages show consistent alert states", async ({ page }) => {
  await insertDashboardFixtureRows();

  await loginAsSeedAdmin(page);

  await page.goto("/tenants");
  await expect(page.getByTestId(`tenant-alert-state-${GLOBALTECH_TENANT_ID}`)).toHaveText(/warning|hard_limit/i);
  await expect(page.getByTestId(`tenant-alert-state-${NOVA_TENANT_ID}`)).toHaveText(/hard_limit/i);

  await page.goto(`/tenants/${GLOBALTECH_TENANT_ID}`);
  await expect(page.getByTestId("tenant-detail-alert-state")).toHaveText(/warning|hard_limit/i);
  await expect(page.getByTestId("tenant-detail-quota-progress")).toContainText("%");

  await page.goto("/usage");
  await expect(page.getByTestId(`usage-alert-state-${GLOBALTECH_TENANT_ID}`)).toHaveText(/warning|hard_limit/i);
  await expect(page.getByTestId(`usage-alert-state-${NOVA_TENANT_ID}`)).toHaveText(/hard_limit/i);
});

test("structured validation errors are rendered on tenant create", async ({ page }) => {
  await loginAsSeedAdmin(page);
  await page.goto("/tenants");

  await page.getByRole("button", { name: "Create tenant" }).click();

  await expect(page.getByText("Invalid request payload.")).toBeVisible();
  await expect(page.getByText("name: Tenant name is required.")).toBeVisible();
});
