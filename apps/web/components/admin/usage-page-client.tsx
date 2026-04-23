"use client";

import { useEffect, useMemo, useState } from "react";

import type { UsageGroupBy } from "@governix/shared";

import { requestJson } from "../../lib/client-api";

type SummaryItem = {
  tenantId?: string;
  tenantName?: string;
  applicationId?: string;
  applicationName?: string;
  modelId?: string;
  requestCount: number;
  retrieveCount: number;
  generateCount: number;
  inputTokens: number;
  outputTokens: number;
  embeddingCount: number;
  estimatedCost: number;
  blockedCount: number;
  throttledCount: number;
  quotaUsagePercent?: number | null;
  alertState?: string | null;
};

type UsageSummaryResponse = {
  groupBy: UsageGroupBy;
  dateFrom: string;
  dateTo: string;
  items: SummaryItem[];
};

const inputClassName =
  "block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 mono text-sm text-slate-900 transition-colors duration-150 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500";

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function getCurrentMonthStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function getPrimaryLabel(item: SummaryItem, groupBy: UsageGroupBy) {
  if (groupBy === "tenant") {
    return item.tenantName ?? item.tenantId ?? "Unknown tenant";
  }

  if (groupBy === "application") {
    return item.applicationName ?? item.applicationId ?? "Unknown application";
  }

  return item.modelId ?? "unknown";
}

export function UsagePageClient() {
  const [dateFrom, setDateFrom] = useState(getCurrentMonthStart());
  const [dateTo, setDateTo] = useState(getTodayDateString());
  const [groupBy, setGroupBy] = useState<UsageGroupBy>("tenant");
  const [summary, setSummary] = useState<UsageSummaryResponse | null>(null);
  const [tenantSummary, setTenantSummary] = useState<UsageSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadUsage(groupBy, dateFrom, dateTo);
  }, []);

  async function loadUsage(nextGroupBy: UsageGroupBy, nextDateFrom: string, nextDateTo: string) {
    setLoading(true);
    setError(null);

    try {
      const baseParams = new URLSearchParams({
        date_from: nextDateFrom,
        date_to: nextDateTo
      });

      const [summaryPayload, tenantPayload] = await Promise.all([
        requestJson<UsageSummaryResponse>(`/api/usage/summary?${new URLSearchParams({ ...Object.fromEntries(baseParams), group_by: nextGroupBy }).toString()}`),
        requestJson<UsageSummaryResponse>(`/api/usage/summary?${new URLSearchParams({ ...Object.fromEntries(baseParams), group_by: "tenant" }).toString()}`)
      ]);

      setSummary(summaryPayload.data ?? null);
      setTenantSummary(tenantPayload.data ?? null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load usage data.");
    } finally {
      setLoading(false);
    }
  }

  const exportHref = useMemo(() => {
    const params = new URLSearchParams({
      date_from: dateFrom,
      date_to: dateTo,
      format: "csv"
    });

    return `/api/showback/report?${params.toString()}`;
  }, [dateFrom, dateTo]);

  const topTenants = (tenantSummary?.items ?? []).slice(0, 3);
  const overLimitTenants = (tenantSummary?.items ?? []).filter((item) => item.alertState === "warning" || item.alertState === "hard_limit");
  const costHotspots = [...(summary?.items ?? [])].sort((left, right) => right.estimatedCost - left.estimatedCost).slice(0, 3);

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-slate-900">Usage</h1>
          <p className="mono mt-0.5 text-xs text-slate-400">Usage aggregation, quota state, and showback exports</p>
        </div>
        <a
          href={exportHref}
          className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 mono text-xs font-medium text-white transition-colors duration-150 hover:bg-slate-800"
        >
          Export CSV
        </a>
      </div>

      {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 grid gap-4 md:grid-cols-[180px_180px_180px_auto]">
          <div>
            <label htmlFor="usage-date-from" className="mb-1.5 block mono text-xs font-medium text-slate-700">
              Date from
            </label>
            <input id="usage-date-from" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className={inputClassName} />
          </div>
          <div>
            <label htmlFor="usage-date-to" className="mb-1.5 block mono text-xs font-medium text-slate-700">
              Date to
            </label>
            <input id="usage-date-to" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className={inputClassName} />
          </div>
          <div>
            <label htmlFor="usage-group-by" className="mb-1.5 block mono text-xs font-medium text-slate-700">
              Group by
            </label>
            <select id="usage-group-by" value={groupBy} onChange={(event) => setGroupBy(event.target.value as UsageGroupBy)} className={inputClassName}>
              <option value="tenant">tenant</option>
              <option value="application">application</option>
              <option value="model">model</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void loadUsage(groupBy, dateFrom, dateTo)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 mono text-xs font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50"
            >
              Refresh usage
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <h2 className="text-sm font-semibold text-slate-900">Top tenants</h2>
            <div className="mt-3 space-y-2">
              {topTenants.length === 0 ? (
                <p className="text-sm text-slate-500">No tenant usage in the selected range.</p>
              ) : (
                topTenants.map((item) => (
                  <div key={item.tenantId} className="flex items-center justify-between">
                    <span className="text-sm text-slate-700">{item.tenantName}</span>
                    <span className="mono text-xs text-slate-500">{item.requestCount} req</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <h2 className="text-sm font-semibold text-slate-900">Over-limit tenants</h2>
            <div className="mt-3 space-y-2">
              {overLimitTenants.length === 0 ? (
                <p className="text-sm text-slate-500">No tenants are above their warning threshold.</p>
              ) : (
                overLimitTenants.map((item) => (
                  <div key={item.tenantId} className="flex items-center justify-between">
                    <span className="text-sm text-slate-700">{item.tenantName}</span>
                    <span className="mono text-xs text-slate-500">{item.alertState}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <h2 className="text-sm font-semibold text-slate-900">Cost hotspots</h2>
            <div className="mt-3 space-y-2">
              {costHotspots.length === 0 ? (
                <p className="text-sm text-slate-500">No usage costs in the selected range.</p>
              ) : (
                costHotspots.map((item, index) => (
                  <div key={`${getPrimaryLabel(item, summary?.groupBy ?? groupBy)}-${index}`} className="flex items-center justify-between">
                    <span className="text-sm text-slate-700">{getPrimaryLabel(item, summary?.groupBy ?? groupBy)}</span>
                    <span className="mono text-xs text-slate-500">${item.estimatedCost.toFixed(4)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <p className="text-xs font-semibold text-slate-700">Usage Summary</p>
          <p className="mono text-xs text-slate-400">
            {summary?.dateFrom ?? dateFrom} to {summary?.dateTo ?? dateTo}
          </p>
        </div>

        <table className="w-full" aria-label="Usage summary table">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-2.5 text-left mono text-xs font-medium text-slate-400">Name</th>
              <th className="px-4 py-2.5 text-left mono text-xs font-medium text-slate-400">Requests</th>
              <th className="hidden px-4 py-2.5 text-left mono text-xs font-medium text-slate-400 md:table-cell">Input tokens</th>
              <th className="hidden px-4 py-2.5 text-left mono text-xs font-medium text-slate-400 md:table-cell">Output tokens</th>
              <th className="px-4 py-2.5 text-left mono text-xs font-medium text-slate-400">Estimated cost</th>
              <th className="px-4 py-2.5 text-left mono text-xs font-medium text-slate-400">Alert</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-sm text-slate-500">
                  Loading usage data...
                </td>
              </tr>
            ) : (summary?.items ?? []).length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-sm text-slate-500">
                  No usage records match the selected filters.
                </td>
              </tr>
            ) : (
              (summary?.items ?? []).map((item, index) => (
                <tr key={`${getPrimaryLabel(item, summary?.groupBy ?? groupBy)}-${index}`} className="transition-colors duration-100 hover:bg-slate-50/60">
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900">{getPrimaryLabel(item, summary?.groupBy ?? groupBy)}</td>
                  <td className="px-4 py-3 mono text-xs text-slate-700">{item.requestCount}</td>
                  <td className="hidden px-4 py-3 mono text-xs text-slate-500 md:table-cell">{item.inputTokens}</td>
                  <td className="hidden px-4 py-3 mono text-xs text-slate-500 md:table-cell">{item.outputTokens}</td>
                  <td className="px-4 py-3 mono text-xs text-slate-700">${item.estimatedCost.toFixed(6)}</td>
                  <td className="px-4 py-3 mono text-xs text-slate-500">{item.alertState ?? "n/a"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
