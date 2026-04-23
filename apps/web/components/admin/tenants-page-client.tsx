"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useState, type FormEvent } from "react";

import type { AlertState, CreateTenantInput } from "@governix/shared";

import { AlertStateBadge, InlineNotice, QuotaProgressBar } from "./ui-primitives";
import { getApiErrorDetails, requestJson } from "../../lib/client-api";

type TenantRecord = {
  id: string;
  name: string;
  externalKey: string | null;
  status: "active" | "paused" | "archived";
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

type TenantListResponse = {
  items: TenantRecord[];
  total: number;
  page: number;
  pageSize: number;
};

type TenantUsageSummaryItem = {
  tenantId: string;
  requestCount: number;
  quotaUsagePercent: number | null;
  alertState: AlertState | null;
};

type UsageSummaryResponse = {
  items: TenantUsageSummaryItem[];
};

const inputClassName =
  "block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 mono text-sm text-slate-900 transition-colors duration-150 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500";

const textAreaClassName = `${inputClassName} min-h-24 resize-y`;

export function TenantsPageClient() {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [status, setStatus] = useState<"all" | "active" | "paused" | "archived">("all");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<TenantRecord[]>([]);
  const [usageByTenantId, setUsageByTenantId] = useState<Record<string, TenantUsageSummaryItem>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string[]>([]);
  const [form, setForm] = useState<CreateTenantInput>({
    name: "",
    externalKey: null,
    status: "active",
    description: null
  });

  useEffect(() => {
    void loadTenants();
  }, [deferredSearch, status, page]);

  async function loadTenants() {
    setLoading(true);

    try {
      const params = new URLSearchParams({
        search: deferredSearch,
        status,
        page: String(page),
        page_size: "10"
      });
      const now = new Date();
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
      const today = now.toISOString().slice(0, 10);
      const [tenantPayload, usagePayload] = await Promise.all([
        requestJson<TenantListResponse>(`/api/tenants?${params.toString()}`),
        requestJson<UsageSummaryResponse>(`/api/usage/summary?date_from=${monthStart}&date_to=${today}&group_by=tenant`)
      ]);
      setItems(tenantPayload.data?.items ?? []);
      setTotal(tenantPayload.data?.total ?? 0);
      setUsageByTenantId(
        Object.fromEntries((usagePayload.data?.items ?? []).map((item) => [item.tenantId, item]))
      );
      setError(null);
      setErrorDetails([]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load tenants.");
      setErrorDetails(getApiErrorDetails(requestError));
    } finally {
      setLoading(false);
    }
  }

  async function onCreateTenant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setErrorDetails([]);

    if (!form.name.trim()) {
      setError("Invalid request payload.");
      setErrorDetails(["name: Tenant name is required."]);
      return;
    }

    try {
      const payload = await requestJson<TenantRecord>("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });

      setMessage(payload.message ?? "Tenant created.");
      setForm({
        name: "",
        externalKey: null,
        status: "active",
        description: null
      });
      setSearch("");
      setStatus("all");
      setPage(1);
      await loadTenants();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to create tenant.");
      setErrorDetails(getApiErrorDetails(requestError));
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / 10));

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-slate-900">Tenants</h1>
          <p className="mono mt-0.5 text-xs text-slate-400">Tenant registry, search, and lifecycle controls</p>
        </div>
        <div className="mono text-xs text-slate-400">{total} total tenants</div>
      </div>

      {message ? <InlineNotice tone="success" message={message} /> : null}
      {error ? <InlineNotice tone="error" message={error} details={errorDetails} /> : null}

      <div className="mb-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Tenant Directory</h2>
              <p className="mono mt-0.5 text-xs text-slate-400">Search, filter, and page through registered tenants</p>
            </div>
          </div>

          <div className="mb-4 grid gap-3 md:grid-cols-[1fr_180px]">
            <div>
              <label htmlFor="tenant-search" className="mb-1.5 block mono text-xs font-medium text-slate-700">
                Search
              </label>
              <input
                id="tenant-search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search tenants"
                className={inputClassName}
              />
            </div>

            <div>
              <label htmlFor="tenant-filter-status" className="mb-1.5 block mono text-xs font-medium text-slate-700">
                Filter status
              </label>
              <select
                id="tenant-filter-status"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as typeof status);
                  setPage(1);
                }}
                className={inputClassName}
              >
                <option value="all">all</option>
                <option value="active">active</option>
                <option value="paused">paused</option>
                <option value="archived">archived</option>
              </select>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full" aria-label="Tenants table">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-2.5 text-left mono text-xs font-medium text-slate-400">Tenant</th>
                  <th className="px-4 py-2.5 text-left mono text-xs font-medium text-slate-400">Lifecycle</th>
                  <th className="px-4 py-2.5 text-left mono text-xs font-medium text-slate-400">Alert</th>
                  <th className="hidden px-4 py-2.5 text-left mono text-xs font-medium text-slate-400 lg:table-cell">Quota</th>
                  <th className="hidden px-4 py-2.5 text-left mono text-xs font-medium text-slate-400 md:table-cell">Requests MTD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-sm text-slate-500">
                      Loading tenants...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-sm text-slate-500">
                      No tenants match the current filters.
                    </td>
                  </tr>
                ) : (
                  items.map((tenant) => (
                    <tr key={tenant.id} className="transition-colors duration-100 hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <div>
                          <Link href={`/tenants/${tenant.id}`} className="text-sm font-semibold text-slate-900 hover:text-sky-600">
                            {tenant.name}
                          </Link>
                          <p className="mono mt-0.5 text-xs text-slate-400">{tenant.externalKey ?? "no-external-key"}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 mono text-xs text-slate-600">
                          {tenant.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <AlertStateBadge
                          state={usageByTenantId[tenant.id]?.alertState ?? null}
                          testId={`tenant-alert-state-${tenant.id}`}
                        />
                      </td>
                      <td className="hidden px-4 py-3 lg:table-cell">
                        <QuotaProgressBar value={usageByTenantId[tenant.id]?.quotaUsagePercent ?? null} />
                      </td>
                      <td className="hidden px-4 py-3 mono text-xs text-slate-500 md:table-cell">
                        {usageByTenantId[tenant.id]?.requestCount ?? 0}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="mono text-xs text-slate-400">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
                className="rounded-lg border border-slate-200 px-3 py-1.5 mono text-xs text-slate-600 transition-colors duration-150 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages}
                className="rounded-lg border border-slate-200 px-3 py-1.5 mono text-xs text-slate-600 transition-colors duration-150 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-900">Create Tenant</h2>
            <p className="mono mt-0.5 text-xs text-slate-400">Register a new governance boundary for applications, policies, and quotas</p>
          </div>

          <form onSubmit={onCreateTenant} className="space-y-4">
            <div>
              <label htmlFor="tenant-name" className="mb-1.5 block mono text-xs font-medium text-slate-700">
                Tenant name
              </label>
              <input
                id="tenant-name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className={inputClassName}
              />
            </div>

            <div>
              <label htmlFor="tenant-external-key" className="mb-1.5 block mono text-xs font-medium text-slate-700">
                External key
              </label>
              <input
                id="tenant-external-key"
                value={form.externalKey ?? ""}
                onChange={(event) => setForm((current) => ({ ...current, externalKey: event.target.value || null }))}
                className={inputClassName}
              />
            </div>

            <div>
              <label htmlFor="tenant-status" className="mb-1.5 block mono text-xs font-medium text-slate-700">
                Tenant status
              </label>
              <select
                id="tenant-status"
                value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as CreateTenantInput["status"] }))}
                className={inputClassName}
              >
                <option value="active">active</option>
                <option value="paused">paused</option>
                <option value="archived">archived</option>
              </select>
            </div>

            <div>
              <label htmlFor="tenant-description" className="mb-1.5 block mono text-xs font-medium text-slate-700">
                Tenant description
              </label>
              <textarea
                id="tenant-description"
                value={form.description ?? ""}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value || null }))}
                className={textAreaClassName}
              />
            </div>

            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 mono text-xs font-medium text-white transition-colors duration-150 hover:bg-slate-800"
            >
              Create tenant
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
