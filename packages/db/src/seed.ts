import "dotenv/config";

import { hash } from "bcryptjs";

import { getDb, getSqlClient } from "./client";
import {
  applications,
  auditExports,
  policyEvaluationLogs,
  requestLedger,
  tenantPolicies,
  tenantQuotas,
  tenants,
  usageDaily,
  users
} from "./schema";

const seedIds = {
  adminUser: "11111111-1111-1111-1111-111111111111",
  acmeTenant: "22222222-2222-2222-2222-222222222221",
  globalTechTenant: "22222222-2222-2222-2222-222222222222",
  novaTenant: "22222222-2222-2222-2222-222222222223",
  acmeApp: "33333333-3333-3333-3333-333333333331",
  globalTechApp: "33333333-3333-3333-3333-333333333332",
  novaApp: "33333333-3333-3333-3333-333333333333",
  acmePolicy: "44444444-4444-4444-4444-444444444441",
  globalTechPolicy: "44444444-4444-4444-4444-444444444442",
  novaPolicy: "44444444-4444-4444-4444-444444444443",
  acmeQuota: "55555555-5555-5555-5555-555555555551",
  globalTechQuota: "55555555-5555-5555-5555-555555555552",
  novaQuota: "55555555-5555-5555-5555-555555555553",
  requestLedger: "66666666-6666-6666-6666-666666666661",
  policyLog: "77777777-7777-7777-7777-777777777771",
  usageDaily: "88888888-8888-8888-8888-888888888881",
  auditExport: "99999999-9999-9999-9999-999999999991"
} as const;

async function main() {
  const db = getDb();
  const adminPasswordHash = await hash("governix-admin", 10);
  const apiKeyHash = await hash("govx_demo_app_key", 10);

  await db.delete(auditExports);
  await db.delete(policyEvaluationLogs);
  await db.delete(usageDaily);
  await db.delete(requestLedger);
  await db.delete(tenantQuotas);
  await db.delete(tenantPolicies);
  await db.delete(applications);
  await db.delete(tenants);
  await db.delete(users);

  await db.insert(users).values({
    id: seedIds.adminUser,
    email: "admin@acme.io",
    passwordHash: adminPasswordHash,
    role: "admin",
    status: "active"
  });

  await db.insert(tenants).values([
    {
      id: seedIds.acmeTenant,
      name: "Acme Corp",
      externalKey: "tenant_01",
      status: "active",
      description: "Demo tenant for bootstrap flows."
    },
    {
      id: seedIds.globalTechTenant,
      name: "GlobalTech",
      externalKey: "tenant_02",
      status: "active",
      description: "Warning-state demo tenant."
    },
    {
      id: seedIds.novaTenant,
      name: "Nova Health",
      externalKey: "tenant_03",
      status: "paused",
      description: "Blocked-state demo tenant."
    }
  ]);

  await db.insert(applications).values([
    {
      id: seedIds.acmeApp,
      tenantId: seedIds.acmeTenant,
      name: "web-assistant",
      environment: "prod",
      status: "active",
      apiKeyHash
    },
    {
      id: seedIds.globalTechApp,
      tenantId: seedIds.globalTechTenant,
      name: "support-search",
      environment: "staging",
      status: "active",
      apiKeyHash
    },
    {
      id: seedIds.novaApp,
      tenantId: seedIds.novaTenant,
      name: "case-review",
      environment: "prod",
      status: "disabled",
      apiKeyHash
    }
  ]);

  await db.insert(tenantPolicies).values([
    {
      id: seedIds.acmePolicy,
      tenantId: seedIds.acmeTenant,
      name: "Acme default policy",
      allowedKbIdsJson: ["kb-acme"],
      allowedModelIdsJson: ["anthropic.claude-3-5-sonnet"],
      requireCitation: true,
      fallbackModelId: "anthropic.claude-3-haiku",
      enabled: true,
      notes: "Seed policy"
    },
    {
      id: seedIds.globalTechPolicy,
      tenantId: seedIds.globalTechTenant,
      name: "GlobalTech default policy",
      allowedKbIdsJson: ["kb-globaltech"],
      allowedModelIdsJson: ["anthropic.claude-3-5-sonnet"],
      requireCitation: false,
      fallbackModelId: "anthropic.claude-3-haiku",
      enabled: true,
      notes: "Seed policy"
    },
    {
      id: seedIds.novaPolicy,
      tenantId: seedIds.novaTenant,
      name: "Nova Health policy",
      allowedKbIdsJson: ["kb-nova"],
      allowedModelIdsJson: ["anthropic.claude-3-haiku"],
      requireCitation: true,
      fallbackModelId: "anthropic.claude-3-haiku",
      enabled: true,
      notes: "Seed policy"
    }
  ]);

  await db.insert(tenantQuotas).values([
    {
      id: seedIds.acmeQuota,
      tenantId: seedIds.acmeTenant,
      requestLimitMonthly: 100000,
      tokenLimitMonthly: 2000000,
      costLimitMonthly: "500.0000",
      softThresholdPercent: 80,
      hardThresholdPercent: 100
    },
    {
      id: seedIds.globalTechQuota,
      tenantId: seedIds.globalTechTenant,
      requestLimitMonthly: 50000,
      tokenLimitMonthly: 1000000,
      costLimitMonthly: "300.0000",
      softThresholdPercent: 80,
      hardThresholdPercent: 100
    },
    {
      id: seedIds.novaQuota,
      tenantId: seedIds.novaTenant,
      requestLimitMonthly: 25000,
      tokenLimitMonthly: 500000,
      costLimitMonthly: "150.0000",
      softThresholdPercent: 80,
      hardThresholdPercent: 100
    }
  ]);

  await db.insert(requestLedger).values({
    id: seedIds.requestLedger,
    requestId: "req_bootstrap_001",
    tenantId: seedIds.acmeTenant,
    applicationId: seedIds.acmeApp,
    requestType: "retrieve_and_generate",
    rawQuerySummary: "Find the latest governance guidance.",
    selectedModelId: "anthropic.claude-3-5-sonnet",
    selectedKbId: "kb-acme",
    policyResultJson: {
      matchedPolicyIds: [seedIds.acmePolicy],
      finalAction: "allow",
      reasons: ["Seed request"]
    },
    retrievalFilterJson: { tenant: "tenant_01" },
    retrievedChunksJson: [{ id: "chunk-1", summary: "Governance summary" }],
    generationSummaryText: "Seed response summary",
    citationsPresent: true,
    status: "success",
    latencyMs: 1830,
    inputTokens: 824,
    outputTokens: 219,
    embeddingCount: 3,
    estimatedCost: "0.142000"
  });

  await db.insert(policyEvaluationLogs).values({
    id: seedIds.policyLog,
    requestId: "req_bootstrap_001",
    tenantId: seedIds.acmeTenant,
    matchedPolicyIdsJson: [seedIds.acmePolicy],
    finalAction: "allow",
    finalModelId: "anthropic.claude-3-5-sonnet",
    finalKbId: "kb-acme",
    reasonsJson: ["Seed request"]
  });

  await db.insert(usageDaily).values({
    id: seedIds.usageDaily,
    tenantId: seedIds.acmeTenant,
    applicationId: seedIds.acmeApp,
    usageDate: "2026-04-22",
    ragRequestCount: 1,
    retrieveCount: 1,
    generateCount: 1,
    inputTokens: 824,
    outputTokens: 219,
    embeddingCount: 3,
    estimatedCost: "0.142000",
    blockedCount: 0,
    throttledCount: 0
  });

  await db.insert(auditExports).values({
    id: seedIds.auditExport,
    requestedBy: seedIds.adminUser,
    exportType: "ledger",
    tenantScopeJson: { tenantIds: [seedIds.acmeTenant] },
    dateFrom: new Date("2026-04-01T00:00:00Z"),
    dateTo: new Date("2026-04-22T23:59:59Z"),
    format: "csv",
    status: "pending"
  });

  await getSqlClient().end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
