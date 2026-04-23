"use client";

import { useEffect, useMemo, useState } from "react";

import { requestJson } from "../../lib/client-api";

type TenantOption = {
  id: string;
  name: string;
};

type LedgerListItem = {
  requestId: string;
  tenantId: string;
  tenantName: string;
  applicationId: string;
  applicationName: string;
  requestType: string;
  selectedModelId: string | null;
  selectedKbId: string | null;
  status: string;
  estimatedCost: string | number | null;
  latencyMs: number | null;
  createdAt: string;
};

type LedgerListPayload = {
  items: LedgerListItem[];
  total: number;
  page: number;
  pageSize: number;
};

type LedgerDetail = LedgerListItem & {
  userId: string | null;
  sessionId: string | null;
  rawQuerySummary: string | null;
  policyResultJson: { reasons?: string[]; finalAction?: string } | null;
  retrievalFilterJson: Record<string, unknown> | null;
  retrievedChunksJson: Array<Record<string, unknown>> | null;
  generationSummaryText: string | null;
  citationsPresent: boolean;
  inputTokens: number | null;
  outputTokens: number | null;
  embeddingCount: number;
  errorCode: string | null;
  errorMessage: string | null;
};

type AuditExport = {
  id: string;
  status: string;
  fileUrl: string | null;
  errorMessage: string | null;
};

const inputClassName =
  "block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 mono text-sm text-slate-900 transition-colors duration-150 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500";

function getCurrentMonthStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

export function LedgerPageClient() {
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [status, setStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState(getCurrentMonthStart());
  const [dateTo, setDateTo] = useState(getTodayDateString());
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<LedgerListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [detail, setDetail] = useState<LedgerDetail | null>(null);
  const [exportState, setExportState] = useState<AuditExport | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadTenants();
    void loadLedger();
  }, []);

  useEffect(() => {
    if (!exportState || exportState.status !== "pending") {
      return;
    }

    const timer = window.setTimeout(() => {
      void refreshExport(exportState.id);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [exportState]);

  async function loadTenants() {
    const payload = await requestJson<{ items: TenantOption[] }>("/api/tenants?search=&status=all&page=1&page_size=100");
    setTenants(payload.data?.items ?? []);
  }

  async function loadLedger(nextPage = page) {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        tenant_id: tenantId,
        status,
        date_from: dateFrom,
        date_to: dateTo,
        page: String(nextPage),
        page_size: "20"
      });

      const payload = await requestJson<LedgerListPayload>(`/api/ledger?${params.toString()}`);
      setItems(payload.data?.items ?? []);
      setTotal(payload.data?.total ?? 0);
      setPage(nextPage);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load ledger.");
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(requestId: string) {
    const payload = await requestJson<LedgerDetail>(`/api/ledger/${requestId}`);
    setDetail(payload.data ?? null);
  }

  async function queueExport() {
    setMessage(null);
    setError(null);

    try {
      const payload = await requestJson<{ exportId: string; status: string }>("/api/ledger/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_ids: tenantId ? [tenantId] : tenants.map((tenant) => tenant.id),
          date_from: `${dateFrom}T00:00:00Z`,
          date_to: `${dateTo}T23:59:59Z`,
          format: "csv"
        })
      });

      if (payload.data?.exportId) {
        setExportState({
          id: payload.data.exportId,
          status: payload.data.status,
          fileUrl: null,
          errorMessage: null
        });
      }

      setMessage(payload.message ?? "Ledger export queued.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to queue export.");
    }
  }

  async function refreshExport(exportId: string) {
    try {
      const payload = await requestJson<AuditExport>(`/api/ledger/exports/${exportId}`);
      setExportState(payload.data ?? null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to refresh export.");
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / 20));
  const exportHref = exportState?.fileUrl ?? "#";
  const exportLabel = exportState?.status === "ready" ? "Export CSV" : "Export CSV";
  const exportHint = useMemo(() => {
    if (!exportState) {
      return "Queue an async export for the current filtered ledger view.";
    }

    if (exportState.status === "ready") {
      return "Download the generated CSV.";
    }

    if (exportState.status === "failed") {
      return exportState.errorMessage ?? "Export failed.";
    }

    return "Export is processing.";
  }, [exportState]);

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-slate-900">Audit Ledger</h1>
          <p className="mono mt-0.5 text-xs text-slate-400">Request evidence search, detail, and async CSV export</p>
        </div>
        <div className="text-right">
          <a
            href={exportHref}
            onClick={(event) => {
              if (!exportState || exportState.status !== "ready") {
                event.preventDefault();
                void queueExport();
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 mono text-xs font-medium text-white transition-colors duration-150 hover:bg-slate-800"
          >
            {exportLabel}
          </a>
          <p className="mono mt-1 text-xs text-slate-400">{exportHint}</p>
        </div>
      </div>

      {message ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
      {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[220px_180px_180px_180px_auto]">
          <div>
            <label htmlFor="ledger-tenant" className="mb-1.5 block mono text-xs font-medium text-slate-700">
              Tenant
            </label>
            <select id="ledger-tenant" aria-label="Tenant" value={tenantId} onChange={(event) => setTenantId(event.target.value)} className={inputClassName}>
              <option value="">all</option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ledger-date-from" className="mb-1.5 block mono text-xs font-medium text-slate-700">
              Date from
            </label>
            <input id="ledger-date-from" aria-label="Date from" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className={inputClassName} />
          </div>
          <div>
            <label htmlFor="ledger-date-to" className="mb-1.5 block mono text-xs font-medium text-slate-700">
              Date to
            </label>
            <input id="ledger-date-to" aria-label="Date to" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className={inputClassName} />
          </div>
          <div>
            <label htmlFor="ledger-status" className="mb-1.5 block mono text-xs font-medium text-slate-700">
              Status
            </label>
            <select id="ledger-status" aria-label="Status" value={status} onChange={(event) => setStatus(event.target.value)} className={inputClassName}>
              <option value="all">all</option>
              <option value="success">success</option>
              <option value="blocked">blocked</option>
              <option value="failed">failed</option>
              <option value="partial">partial</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void loadLedger(1)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 mono text-xs font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50"
            >
              Refresh ledger
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-xs font-semibold text-slate-700">Ledger Results</p>
          </div>

          <table className="w-full" aria-label="Ledger table">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-2.5 text-left mono text-xs font-medium text-slate-400">Request</th>
                <th className="px-4 py-2.5 text-left mono text-xs font-medium text-slate-400">Tenant</th>
                <th className="hidden px-4 py-2.5 text-left mono text-xs font-medium text-slate-400 lg:table-cell">Application</th>
                <th className="px-4 py-2.5 text-left mono text-xs font-medium text-slate-400">Status</th>
                <th className="px-4 py-2.5 text-left mono text-xs font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-sm text-slate-500">
                    Loading ledger...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-sm text-slate-500">
                    No ledger entries match the current filters.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.requestId} className="transition-colors duration-100 hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <div>
                        <p className="mono text-xs font-semibold text-slate-900">{item.requestId}</p>
                        <p className="mono mt-0.5 text-xs text-slate-400">{new Date(item.createdAt).toLocaleString("en-US")}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{item.tenantName}</td>
                    <td className="hidden px-4 py-3 text-sm text-slate-500 lg:table-cell">{item.applicationName}</td>
                    <td className="px-4 py-3 mono text-xs text-slate-700">{item.status}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        aria-label={`View ${item.requestId}`}
                        onClick={() => void loadDetail(item.requestId)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 mono text-xs text-slate-700 transition-colors duration-150 hover:bg-slate-50"
                      >
                        View {item.requestId}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
            <p className="mono text-xs text-slate-400">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void loadLedger(Math.max(1, page - 1))}
                disabled={page === 1}
                className="rounded-lg border border-slate-200 px-3 py-1.5 mono text-xs text-slate-600 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => void loadLedger(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="rounded-lg border border-slate-200 px-3 py-1.5 mono text-xs text-slate-600 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-900">Request Detail</h2>
            <p className="mono mt-0.5 text-xs text-slate-400">Policy, retrieval, generation, usage, and error metadata</p>
          </div>

          {!detail ? (
            <p className="text-sm text-slate-500">Select a ledger row to inspect its request evidence.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="mono text-xs text-slate-400">Request summary</p>
                <p className="text-sm text-slate-900">{detail.rawQuerySummary ?? "No summary available."}</p>
              </div>
              <div>
                <p className="mono text-xs text-slate-400">Policy result</p>
                <p className="mono text-xs text-slate-700">{detail.policyResultJson?.finalAction ?? "unknown"}</p>
                {(detail.policyResultJson?.reasons ?? []).map((reason) => (
                  <p key={reason} className="text-sm text-slate-700">
                    {reason}
                  </p>
                ))}
              </div>
              <div>
                <p className="mono text-xs text-slate-400">Retrieval filter</p>
                <pre className="mt-1 overflow-x-auto rounded-lg bg-slate-50 p-3 mono text-xs text-slate-700">
                  {JSON.stringify(detail.retrievalFilterJson ?? {}, null, 2)}
                </pre>
              </div>
              <div>
                <p className="mono text-xs text-slate-400">Retrieved chunks</p>
                <pre className="mt-1 overflow-x-auto rounded-lg bg-slate-50 p-3 mono text-xs text-slate-700">
                  {JSON.stringify(detail.retrievedChunksJson ?? [], null, 2)}
                </pre>
              </div>
              <div>
                <p className="mono text-xs text-slate-400">Generation summary</p>
                <p className="text-sm text-slate-900">{detail.generationSummaryText ?? "No generation summary."}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="mono text-xs text-slate-400">Tokens</p>
                  <p className="mono text-xs text-slate-700">
                    in {detail.inputTokens ?? 0} / out {detail.outputTokens ?? 0}
                  </p>
                </div>
                <div>
                  <p className="mono text-xs text-slate-400">Latency</p>
                  <p className="mono text-xs text-slate-700">{detail.latencyMs ?? 0} ms</p>
                </div>
                <div>
                  <p className="mono text-xs text-slate-400">Estimated cost</p>
                  <p className="mono text-xs text-slate-700">{detail.estimatedCost ?? "0"}</p>
                </div>
                <div>
                  <p className="mono text-xs text-slate-400">Error</p>
                  <p className="mono text-xs text-slate-700">{detail.errorMessage ?? "none"}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
