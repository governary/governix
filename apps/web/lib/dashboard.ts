import { applicationRepository, requestLedgerRepository, tenantRepository } from "@governix/db";
import type { AlertState } from "@governix/shared";

import { getUsageSummary } from "./usage";

type DashboardRiskTenant = {
  tenantId: string;
  tenantName: string;
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  quotaUsagePercent: number | null;
  alertState: AlertState | null;
};

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function getCurrentMonthStartDateString() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function getLast24HoursBoundary() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000);
}

export async function getDashboardOverview() {
  const dateFrom = getCurrentMonthStartDateString();
  const dateTo = getTodayDateString();

  const [tenantUsage, tenants, applications, recentLedger] = await Promise.all([
    getUsageSummary({ dateFrom, dateTo, groupBy: "tenant" }),
    tenantRepository.listAll(),
    applicationRepository.listAll(),
    requestLedgerRepository.listByDateRange({ dateFrom, dateTo })
  ]);
  const tenantItems = tenantUsage.items as DashboardRiskTenant[];

  const totals = tenantItems.reduce(
    (current, item) => ({
      requestCount: current.requestCount + item.requestCount,
      tokenCount: current.tokenCount + item.inputTokens + item.outputTokens,
      estimatedCost: current.estimatedCost + item.estimatedCost
    }),
    { requestCount: 0, tokenCount: 0, estimatedCost: 0 }
  );

  const last24HoursBoundary = getLast24HoursBoundary();
  const riskTenants = tenantItems
    .filter((item) => item.alertState === "warning" || item.alertState === "hard_limit")
    .sort((left, right) => {
      if (left.alertState === right.alertState) {
        return right.estimatedCost - left.estimatedCost;
      }

      return left.alertState === "hard_limit" ? -1 : 1;
    })
    .slice(0, 5);

  return {
    dateFrom,
    dateTo,
    monthLabel: new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(`${dateFrom}T00:00:00Z`)),
    metrics: {
      totalTenants: tenants.length,
      totalApplications: applications.length,
      totalRequests: totals.requestCount,
      totalTokens: totals.tokenCount,
      estimatedCost: Number(totals.estimatedCost.toFixed(4)),
      tenantsInAlert: tenantItems.filter((item) => item.alertState === "warning" || item.alertState === "hard_limit").length,
      tenantsOverLimit: tenantItems.filter((item) => item.alertState === "hard_limit").length,
      errors24h: recentLedger.filter((row) => row.createdAt >= last24HoursBoundary && (row.status === "failed" || row.status === "partial")).length,
      policyBlocks24h: recentLedger.filter((row) => row.createdAt >= last24HoursBoundary && row.status === "blocked").length
    },
    statusOverview: {
      active: tenants.filter((tenant) => tenant.status === "active").length,
      paused: tenants.filter((tenant) => tenant.status === "paused").length,
      archived: tenants.filter((tenant) => tenant.status === "archived").length
    },
    riskTenants
  };
}
