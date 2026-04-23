import { estimateCost } from "@governix/costing";
import {
  applicationRepository,
  requestLedgerRepository,
  tenantRepository,
  quotaRepository,
  usageDailyRepository
} from "@governix/db";
import type { AlertState, ShowbackReportQuery, UsageGroupBy, UsageSummaryQuery } from "@governix/shared";

type AggregatedUsageTotals = {
  requestCount: number;
  retrieveCount: number;
  generateCount: number;
  inputTokens: number;
  outputTokens: number;
  embeddingCount: number;
  estimatedCost: number;
  blockedCount: number;
  throttledCount: number;
};

type UsageDailyAggregateRow = AggregatedUsageTotals & {
  tenantId: string;
  applicationId: string | null;
  usageDate: string;
};

type TenantSummaryItem = AggregatedUsageTotals & {
  tenantId: string;
  tenantName: string;
  quotaUsagePercent: number | null;
  alertState: AlertState | null;
};

type ApplicationSummaryItem = AggregatedUsageTotals & {
  applicationId: string;
  applicationName: string;
  tenantId: string;
  tenantName: string;
  quotaUsagePercent: number | null;
  alertState: AlertState | null;
};

type ModelSummaryItem = AggregatedUsageTotals & {
  modelId: string;
  quotaUsagePercent: null;
  alertState: null;
};

type ShowbackItem = AggregatedUsageTotals & {
  tenantId: string;
  tenantName: string;
  applicationId: string;
  applicationName: string;
  modelId: string;
};

function emptyTotals(): AggregatedUsageTotals {
  return {
    requestCount: 0,
    retrieveCount: 0,
    generateCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    embeddingCount: 0,
    estimatedCost: 0,
    blockedCount: 0,
    throttledCount: 0
  };
}

function toDateKey(value: Date | string) {
  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  return value.toISOString().slice(0, 10);
}

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function resolveEstimatedCost(entry: {
  estimatedCost: unknown;
  selectedModelId: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  embeddingCount: number | null;
}) {
  const directCost = toNumber(entry.estimatedCost);
  if (directCost > 0) {
    return directCost;
  }

  return estimateCost({
    modelId: entry.selectedModelId,
    inputTokens: entry.inputTokens,
    outputTokens: entry.outputTokens,
    embeddingCount: entry.embeddingCount
  });
}

function getPolicyAction(policyResult: unknown) {
  if (typeof policyResult !== "object" || policyResult === null) {
    return null;
  }

  const action = (policyResult as Record<string, unknown>).finalAction;
  return typeof action === "string" ? action : null;
}

function applyLedgerMetrics(
  target: AggregatedUsageTotals,
  entry: {
    requestType: string;
    status: string;
    selectedModelId: string | null;
    inputTokens: number | null;
    outputTokens: number | null;
    embeddingCount: number | null;
    estimatedCost: unknown;
    policyResultJson: unknown;
  }
) {
  target.requestCount += 1;

  if (entry.requestType === "retrieve" || entry.requestType === "retrieve_and_generate") {
    target.retrieveCount += 1;
  }

  if (entry.requestType === "generate" || entry.requestType === "retrieve_and_generate") {
    target.generateCount += 1;
  }

  target.inputTokens += entry.inputTokens ?? 0;
  target.outputTokens += entry.outputTokens ?? 0;
  target.embeddingCount += entry.embeddingCount ?? 0;
  target.estimatedCost += resolveEstimatedCost(entry);

  const finalAction = getPolicyAction(entry.policyResultJson);
  if (entry.status === "blocked" || finalAction === "quota_block") {
    target.blockedCount += 1;
  }

  if (finalAction === "downgrade_model") {
    target.throttledCount += 1;
  }
}

function finalizeTotals<T extends AggregatedUsageTotals>(item: T): T {
  return {
    ...item,
    estimatedCost: Number(item.estimatedCost.toFixed(6))
  };
}

function deriveQuotaState(input: {
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  quota:
    | {
        requestLimitMonthly: number | null;
        tokenLimitMonthly: number | null;
        costLimitMonthly: string | null;
        softThresholdPercent: number;
        hardThresholdPercent: number;
      }
    | null
    | undefined;
}) {
  if (!input.quota) {
    return {
      quotaUsagePercent: null,
      alertState: null
    };
  }

  const tokenCount = input.inputTokens + input.outputTokens;
  const percentages = [
    input.quota.requestLimitMonthly ? (input.requestCount / input.quota.requestLimitMonthly) * 100 : null,
    input.quota.tokenLimitMonthly ? (tokenCount / input.quota.tokenLimitMonthly) * 100 : null,
    input.quota.costLimitMonthly ? (input.estimatedCost / Number(input.quota.costLimitMonthly)) * 100 : null
  ].filter((value): value is number => value !== null && Number.isFinite(value));

  if (percentages.length === 0) {
    return {
      quotaUsagePercent: null,
      alertState: null
    };
  }

  const quotaUsagePercent = Number(Math.min(100, Math.max(...percentages)).toFixed(2));

  if (quotaUsagePercent >= input.quota.hardThresholdPercent) {
    return { quotaUsagePercent, alertState: "hard_limit" as const };
  }

  if (quotaUsagePercent >= input.quota.softThresholdPercent) {
    return { quotaUsagePercent, alertState: "warning" as const };
  }

  return { quotaUsagePercent, alertState: "normal" as const };
}

export async function refreshUsageDaily(input: { dateFrom: string; dateTo: string; tenantId?: string | null }) {
  const entries = await requestLedgerRepository.listByDateRange(input);
  const aggregates = new Map<string, UsageDailyAggregateRow>();

  for (const entry of entries) {
    const usageDate = toDateKey(entry.createdAt);
    const key = `${entry.tenantId}:${entry.applicationId ?? "none"}:${usageDate}`;
    const current =
      aggregates.get(key) ??
      ({
        tenantId: entry.tenantId,
        applicationId: entry.applicationId,
        usageDate,
        ...emptyTotals()
      } satisfies UsageDailyAggregateRow);

    applyLedgerMetrics(current, entry);
    aggregates.set(key, current);
  }

  for (const row of aggregates.values()) {
    await usageDailyRepository.replaceAggregateRow({
      tenantId: row.tenantId,
      applicationId: row.applicationId,
      usageDate: row.usageDate,
      ragRequestCount: row.requestCount,
      retrieveCount: row.retrieveCount,
      generateCount: row.generateCount,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      embeddingCount: row.embeddingCount,
      estimatedCost: row.estimatedCost.toFixed(6),
      blockedCount: row.blockedCount,
      throttledCount: row.throttledCount
    });
  }

  return Array.from(aggregates.values()).map((row) => finalizeTotals(row));
}

async function loadReferenceData() {
  const [tenants, applications] = await Promise.all([tenantRepository.listAll(), applicationRepository.listAll()]);

  return {
    tenantMap: new Map(tenants.map((tenant) => [tenant.id, tenant])),
    applicationMap: new Map(applications.map((application) => [application.id, application]))
  };
}

async function loadTenantQuotaMap(tenantIds: string[]) {
  const quotas = await Promise.all(tenantIds.map((tenantId) => quotaRepository.findByTenantId(tenantId)));
  return new Map(tenantIds.map((tenantId, index) => [tenantId, quotas[index]]));
}

export async function getUsageSummary(query: UsageSummaryQuery) {
  await refreshUsageDaily({ dateFrom: query.dateFrom, dateTo: query.dateTo });

  const [dailyRows, ledgerRows, referenceData] = await Promise.all([
    usageDailyRepository.listByDateRange({ dateFrom: query.dateFrom, dateTo: query.dateTo }),
    query.groupBy === "model" ? requestLedgerRepository.listByDateRange({ dateFrom: query.dateFrom, dateTo: query.dateTo }) : Promise.resolve([]),
    loadReferenceData()
  ]);

  if (query.groupBy === "tenant") {
    const tenantTotals = new Map<string, TenantSummaryItem>();

    for (const row of dailyRows) {
      const tenant = referenceData.tenantMap.get(row.tenantId);
      const current =
        tenantTotals.get(row.tenantId) ??
        ({
          tenantId: row.tenantId,
          tenantName: tenant?.name ?? row.tenantId,
          quotaUsagePercent: null,
          alertState: null,
          ...emptyTotals()
        } satisfies TenantSummaryItem);

      current.requestCount += row.ragRequestCount;
      current.retrieveCount += row.retrieveCount;
      current.generateCount += row.generateCount;
      current.inputTokens += toNumber(row.inputTokens);
      current.outputTokens += toNumber(row.outputTokens);
      current.embeddingCount += toNumber(row.embeddingCount);
      current.estimatedCost += toNumber(row.estimatedCost);
      current.blockedCount += row.blockedCount;
      current.throttledCount += row.throttledCount;
      tenantTotals.set(row.tenantId, current);
    }

    const quotaMap = await loadTenantQuotaMap(Array.from(tenantTotals.keys()));
    const items = Array.from(tenantTotals.values())
      .map((item) => {
        const quotaState = deriveQuotaState({
          requestCount: item.requestCount,
          inputTokens: item.inputTokens,
          outputTokens: item.outputTokens,
          estimatedCost: item.estimatedCost,
          quota: quotaMap.get(item.tenantId)
        });

        return finalizeTotals({
          ...item,
          quotaUsagePercent: quotaState.quotaUsagePercent,
          alertState: quotaState.alertState
        });
      })
      .sort((left, right) => right.requestCount - left.requestCount);

    return {
      groupBy: query.groupBy,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      items
    };
  }

  if (query.groupBy === "application") {
    const applicationTotals = new Map<string, ApplicationSummaryItem>();

    for (const row of dailyRows) {
      if (!row.applicationId) {
        continue;
      }

      const application = referenceData.applicationMap.get(row.applicationId);
      const tenant = referenceData.tenantMap.get(row.tenantId);
      const current =
        applicationTotals.get(row.applicationId) ??
        ({
          applicationId: row.applicationId,
          applicationName: application?.name ?? row.applicationId,
          tenantId: row.tenantId,
          tenantName: tenant?.name ?? row.tenantId,
          quotaUsagePercent: null,
          alertState: null,
          ...emptyTotals()
        } satisfies ApplicationSummaryItem);

      current.requestCount += row.ragRequestCount;
      current.retrieveCount += row.retrieveCount;
      current.generateCount += row.generateCount;
      current.inputTokens += toNumber(row.inputTokens);
      current.outputTokens += toNumber(row.outputTokens);
      current.embeddingCount += toNumber(row.embeddingCount);
      current.estimatedCost += toNumber(row.estimatedCost);
      current.blockedCount += row.blockedCount;
      current.throttledCount += row.throttledCount;
      applicationTotals.set(row.applicationId, current);
    }

    const quotaMap = await loadTenantQuotaMap(Array.from(new Set(Array.from(applicationTotals.values()).map((item) => item.tenantId))));
    const items = Array.from(applicationTotals.values())
      .map((item) => {
        const quotaState = deriveQuotaState({
          requestCount: item.requestCount,
          inputTokens: item.inputTokens,
          outputTokens: item.outputTokens,
          estimatedCost: item.estimatedCost,
          quota: quotaMap.get(item.tenantId)
        });

        return finalizeTotals({
          ...item,
          quotaUsagePercent: quotaState.quotaUsagePercent,
          alertState: quotaState.alertState
        });
      })
      .sort((left, right) => right.requestCount - left.requestCount);

    return {
      groupBy: query.groupBy,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      items
    };
  }

  const modelTotals = new Map<string, ModelSummaryItem>();

  for (const row of ledgerRows) {
    const modelId = row.selectedModelId ?? "unknown";
    const current =
      modelTotals.get(modelId) ??
      ({
        modelId,
        quotaUsagePercent: null,
        alertState: null,
        ...emptyTotals()
      } satisfies ModelSummaryItem);

    applyLedgerMetrics(current, row);
    modelTotals.set(modelId, current);
  }

  return {
    groupBy: query.groupBy,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    items: Array.from(modelTotals.values()).map((item) => finalizeTotals(item)).sort((left, right) => right.requestCount - left.requestCount)
  };
}

export async function getTenantUsage(input: { tenantId: string; dateFrom: string; dateTo: string }) {
  await refreshUsageDaily(input);

  const [tenant, dailyRows, applications, quota] = await Promise.all([
    tenantRepository.findById(input.tenantId),
    usageDailyRepository.listByDateRange(input),
    applicationRepository.listByTenantId(input.tenantId),
    quotaRepository.findByTenantId(input.tenantId)
  ]);

  const summary = {
    tenantId: input.tenantId,
    tenantName: tenant?.name ?? input.tenantId,
    ...emptyTotals()
  };
  const trend = new Map<string, { usageDate: string; requestCount: number; estimatedCost: number; blockedCount: number }>();
  const applicationTotals = new Map<string, { applicationId: string; applicationName: string; requestCount: number; estimatedCost: number }>();
  const applicationMap = new Map(applications.map((application) => [application.id, application]));

  for (const row of dailyRows) {
    summary.requestCount += row.ragRequestCount;
    summary.retrieveCount += row.retrieveCount;
    summary.generateCount += row.generateCount;
    summary.inputTokens += toNumber(row.inputTokens);
    summary.outputTokens += toNumber(row.outputTokens);
    summary.embeddingCount += toNumber(row.embeddingCount);
    summary.estimatedCost += toNumber(row.estimatedCost);
    summary.blockedCount += row.blockedCount;
    summary.throttledCount += row.throttledCount;

    const trendRow = trend.get(row.usageDate) ?? {
      usageDate: row.usageDate,
      requestCount: 0,
      estimatedCost: 0,
      blockedCount: 0
    };
    trendRow.requestCount += row.ragRequestCount;
    trendRow.estimatedCost += toNumber(row.estimatedCost);
    trendRow.blockedCount += row.blockedCount;
    trend.set(row.usageDate, trendRow);

    if (row.applicationId) {
      const app = applicationMap.get(row.applicationId);
      const appRow = applicationTotals.get(row.applicationId) ?? {
        applicationId: row.applicationId,
        applicationName: app?.name ?? row.applicationId,
        requestCount: 0,
        estimatedCost: 0
      };
      appRow.requestCount += row.ragRequestCount;
      appRow.estimatedCost += toNumber(row.estimatedCost);
      applicationTotals.set(row.applicationId, appRow);
    }
  }

  const quotaState = deriveQuotaState({
    requestCount: summary.requestCount,
    inputTokens: summary.inputTokens,
    outputTokens: summary.outputTokens,
    estimatedCost: summary.estimatedCost,
    quota
  });

  return {
    tenant: {
      id: input.tenantId,
      name: tenant?.name ?? input.tenantId
    },
    summary: finalizeTotals({
      ...summary,
      quotaUsagePercent: quotaState.quotaUsagePercent,
      alertState: quotaState.alertState
    }),
    trend: Array.from(trend.values())
      .map((row) => ({ ...row, estimatedCost: Number(row.estimatedCost.toFixed(6)) }))
      .sort((left, right) => left.usageDate.localeCompare(right.usageDate)),
    applications: Array.from(applicationTotals.values())
      .map((row) => ({ ...row, estimatedCost: Number(row.estimatedCost.toFixed(6)) }))
      .sort((left, right) => right.requestCount - left.requestCount)
  };
}

export async function getShowbackReport(query: ShowbackReportQuery) {
  await refreshUsageDaily({ dateFrom: query.dateFrom, dateTo: query.dateTo, tenantId: query.tenantId });

  const [ledgerRows, referenceData] = await Promise.all([
    requestLedgerRepository.listByDateRange({ dateFrom: query.dateFrom, dateTo: query.dateTo, tenantId: query.tenantId }),
    loadReferenceData()
  ]);

  const showbackTotals = new Map<string, ShowbackItem>();

  for (const row of ledgerRows) {
    if (!row.applicationId) {
      continue;
    }

    const modelId = row.selectedModelId ?? "unknown";
    const key = `${row.tenantId}:${row.applicationId}:${modelId}`;
    const tenant = referenceData.tenantMap.get(row.tenantId);
    const application = referenceData.applicationMap.get(row.applicationId);
    const current =
      showbackTotals.get(key) ??
      ({
        tenantId: row.tenantId,
        tenantName: tenant?.name ?? row.tenantId,
        applicationId: row.applicationId,
        applicationName: application?.name ?? row.applicationId,
        modelId,
        ...emptyTotals()
      } satisfies ShowbackItem);

    applyLedgerMetrics(current, row);
    showbackTotals.set(key, current);
  }

  return Array.from(showbackTotals.values()).map((item) => finalizeTotals(item)).sort((left, right) => right.estimatedCost - left.estimatedCost);
}

function escapeCsvCell(value: string | number) {
  const text = String(value);
  if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
    return `"${text.replaceAll("\"", "\"\"")}"`;
  }

  return text;
}

export function formatShowbackCsv(items: ShowbackItem[], query: ShowbackReportQuery) {
  const header = [
    "tenant_name",
    "application_name",
    "model_id",
    "date_from",
    "date_to",
    "request_count",
    "retrieve_count",
    "generate_count",
    "input_tokens",
    "output_tokens",
    "embedding_count",
    "blocked_count",
    "throttled_count",
    "estimated_cost",
    "cost_type"
  ];

  const rows = items.map((item) =>
    [
      item.tenantName,
      item.applicationName,
      item.modelId,
      query.dateFrom,
      query.dateTo,
      item.requestCount,
      item.retrieveCount,
      item.generateCount,
      item.inputTokens,
      item.outputTokens,
      item.embeddingCount,
      item.blockedCount,
      item.throttledCount,
      item.estimatedCost.toFixed(6),
      "showback_estimate"
    ]
      .map(escapeCsvCell)
      .join(",")
  );

  return [header.join(","), ...rows].join("\n");
}
