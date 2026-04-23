"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import type { AlertState, CreateApplicationInput, UpsertQuotaInput } from "@governix/shared";

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

type ApplicationRecord = {
  id: string;
  tenantId: string;
  name: string;
  environment: "dev" | "staging" | "prod";
  status: "active" | "disabled" | "archived";
  createdAt: string;
  updatedAt: string;
};

type PolicyRecord = {
  id: string;
  tenantId: string;
  name: string;
  allowedKbIdsJson: string[];
  allowedModelIdsJson: string[];
  requireCitation: boolean;
  fallbackModelId: string | null;
  enabled: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type QuotaRecord = {
  id: string;
  tenantId: string;
  requestLimitMonthly: number | null;
  tokenLimitMonthly: number | null;
  costLimitMonthly: string | null;
  softThresholdPercent: number;
  hardThresholdPercent: number;
  createdAt: string;
  updatedAt: string;
};

type LedgerShortcutRecord = {
  requestId: string;
  applicationId: string;
  applicationName: string;
  requestType: string;
  selectedModelId: string | null;
  selectedKbId: string | null;
  status: string;
  estimatedCost: string | null;
  latencyMs: number | null;
  createdAt: string;
};

type TenantUsagePayload = {
  summary: {
    requestCount: number;
    estimatedCost: number;
    blockedCount: number;
    throttledCount: number;
    quotaUsagePercent: number | null;
    alertState: AlertState | null;
  };
};

type TenantTab = "overview" | "applications" | "quota" | "policy" | "ledger";

const inputClassName =
  "block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 mono text-sm text-slate-900 transition-colors duration-150 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500";

const textAreaClassName = `${inputClassName} min-h-24 resize-y`;

const tabs: Array<{ id: TenantTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "applications", label: "Applications" },
  { id: "quota", label: "Quota" },
  { id: "policy", label: "Policy" },
  { id: "ledger", label: "Ledger" }
];

export function TenantDetailClient({ tenantId, initialTab }: { tenantId: string; initialTab: TenantTab }) {
  const [tenant, setTenant] = useState<TenantRecord | null>(null);
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [applicationDrafts, setApplicationDrafts] = useState<Record<string, CreateApplicationInput>>({});
  const [policies, setPolicies] = useState<PolicyRecord[]>([]);
  const [recentLedger, setRecentLedger] = useState<LedgerShortcutRecord[]>([]);
  const [quotaForm, setQuotaForm] = useState<UpsertQuotaInput>({
    requestLimitMonthly: null,
    tokenLimitMonthly: null,
    costLimitMonthly: null,
    softThresholdPercent: 80,
    hardThresholdPercent: 100
  });
  const [tenantForm, setTenantForm] = useState({
    name: "",
    externalKey: "",
    status: "active" as TenantRecord["status"],
    description: ""
  });
  const [newApplication, setNewApplication] = useState<CreateApplicationInput>({
    name: "",
    environment: "prod",
    status: "active"
  });
  const [recentApiKey, setRecentApiKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [tenantUsage, setTenantUsage] = useState<TenantUsagePayload["summary"] | null>(null);

  useEffect(() => {
    void loadTenantDetail();
  }, [tenantId]);

  async function loadTenantDetail() {
    setLoading(true);

    try {
      const today = new Date().toISOString().slice(0, 10);
      const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString().slice(0, 10);
      const [tenantPayload, applicationsPayload, policiesPayload, quotaPayload, recentLedgerPayload, usagePayload] = await Promise.all([
        requestJson<TenantRecord>(`/api/tenants/${tenantId}`),
        requestJson<ApplicationRecord[]>(`/api/tenants/${tenantId}/applications`),
        requestJson<PolicyRecord[]>(`/api/tenants/${tenantId}/policies`),
        requestJson<QuotaRecord | null>(`/api/tenants/${tenantId}/quotas`),
        requestJson<{ items: LedgerShortcutRecord[]; total: number; page: number; pageSize: number }>(
          `/api/ledger?tenant_id=${tenantId}&status=all&date_from=2026-01-01&date_to=2026-12-31&page=1&page_size=20`
        ),
        requestJson<TenantUsagePayload>(`/api/tenants/${tenantId}/usage?date_from=${monthStart}&date_to=${today}`)
      ]);

      const nextTenant = tenantPayload.data ?? null;
      const nextApplications = applicationsPayload.data ?? [];
      const nextPolicies = policiesPayload.data ?? [];
      const nextQuota = quotaPayload.data ?? null;
      const nextLedger = recentLedgerPayload.data?.items ?? [];

      setTenant(nextTenant);
      setApplications(nextApplications);
      setApplicationDrafts(
        Object.fromEntries(
          nextApplications.map((application) => [
            application.id,
            {
              name: application.name,
              environment: application.environment,
              status: application.status
            }
          ])
        )
      );
      setPolicies(nextPolicies);
      setRecentLedger(nextLedger);
      setTenantUsage(usagePayload.data?.summary ?? null);
      setQuotaForm({
        requestLimitMonthly: nextQuota?.requestLimitMonthly ?? null,
        tokenLimitMonthly: nextQuota?.tokenLimitMonthly ?? null,
        costLimitMonthly: nextQuota?.costLimitMonthly ?? null,
        softThresholdPercent: nextQuota?.softThresholdPercent ?? 80,
        hardThresholdPercent: nextQuota?.hardThresholdPercent ?? 100
      });

      if (nextTenant) {
        setTenantForm({
          name: nextTenant.name,
          externalKey: nextTenant.externalKey ?? "",
          status: nextTenant.status,
          description: nextTenant.description ?? ""
        });
      }

      setError(null);
      setErrorDetails([]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load tenant detail.");
      setErrorDetails(getApiErrorDetails(requestError));
    } finally {
      setLoading(false);
    }
  }

  async function onSaveTenant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setErrorDetails([]);

    try {
      const payload = await requestJson<TenantRecord>(`/api/tenants/${tenantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: tenantForm.name,
          externalKey: tenantForm.externalKey || null,
          status: tenantForm.status,
          description: tenantForm.description || null
        })
      });

      setMessage(payload.message ?? "Tenant updated.");
      await loadTenantDetail();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to update tenant.");
      setErrorDetails(getApiErrorDetails(requestError));
    }
  }

  async function onCreateApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setErrorDetails([]);

    try {
      const payload = await requestJson<{ application: ApplicationRecord; apiKey: string }>(`/api/tenants/${tenantId}/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newApplication)
      });

      setRecentApiKey(payload.data?.apiKey ?? null);
      setMessage(payload.message ?? "Application created.");
      setNewApplication({
        name: "",
        environment: "prod",
        status: "active"
      });
      await loadTenantDetail();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to create application.");
      setErrorDetails(getApiErrorDetails(requestError));
    }
  }

  async function onSaveApplication(applicationId: string) {
    setMessage(null);
    setError(null);
    setErrorDetails([]);

    const nextStatus = applicationDrafts[applicationId]?.status;
    if (nextStatus === "archived" && !window.confirm("Archive this application? Archived applications can no longer use runtime API keys.")) {
      return;
    }

    try {
      const payload = await requestJson<ApplicationRecord>(`/api/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(applicationDrafts[applicationId])
      });

      setMessage(payload.message ?? "Application updated.");
      await loadTenantDetail();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to update application.");
      setErrorDetails(getApiErrorDetails(requestError));
    }
  }

  async function onRotateKey(applicationId: string) {
    setMessage(null);
    setError(null);
    setErrorDetails([]);

    if (!window.confirm("Rotate this application API key? The previous plaintext key cannot be recovered.")) {
      return;
    }

    try {
      const payload = await requestJson<{ application: ApplicationRecord; apiKey: string }>(`/api/applications/${applicationId}/rotate-key`, {
        method: "POST"
      });

      setRecentApiKey(payload.data?.apiKey ?? null);
      setMessage(payload.message ?? "API key rotated.");
      await loadTenantDetail();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to rotate API key.");
      setErrorDetails(getApiErrorDetails(requestError));
    }
  }

  async function onSaveQuota(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setErrorDetails([]);

    try {
      const payload = await requestJson<QuotaRecord>(`/api/tenants/${tenantId}/quotas`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(quotaForm)
      });

      setMessage(payload.message ?? "Quota updated.");
      await loadTenantDetail();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to update quota.");
      setErrorDetails(getApiErrorDetails(requestError));
    }
  }

  const activePolicy = policies.find((policy) => policy.enabled) ?? policies[0] ?? null;

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-slate-900">{tenant?.name ?? "Tenant Detail"}</h1>
          <p className="mono mt-0.5 text-xs text-slate-400">{tenant?.externalKey ?? tenantId}</p>
        </div>
        <div className="flex items-center gap-2">
          {tenantUsage ? <AlertStateBadge state={tenantUsage.alertState} testId="tenant-detail-alert-state" /> : null}
          {tenant ? <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 mono text-xs text-slate-600">{tenant.status}</span> : null}
        </div>
      </div>

      {message ? <InlineNotice tone="success" message={message} /> : null}
      {error ? <InlineNotice tone="error" message={error} details={errorDetails} /> : null}

      {recentApiKey ? (
        <InlineNotice tone="info" message="Plaintext API key" details={[recentApiKey]} />
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">Loading tenant detail...</p>
        </div>
      ) : tenant ? (
        <>
          <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-slate-900">Tenant Settings</h2>
              <p className="mono mt-0.5 text-xs text-slate-400">Update the tenant identity and lifecycle state</p>
            </div>

            <form onSubmit={onSaveTenant} className="grid gap-4 lg:grid-cols-2">
              <div>
                <label htmlFor="tenant-detail-name" className="mb-1.5 block mono text-xs font-medium text-slate-700">
                  Tenant name
                </label>
                <input
                  id="tenant-detail-name"
                  value={tenantForm.name}
                  onChange={(event) => setTenantForm((current) => ({ ...current, name: event.target.value }))}
                  className={inputClassName}
                />
              </div>

              <div>
                <label htmlFor="tenant-detail-external-key" className="mb-1.5 block mono text-xs font-medium text-slate-700">
                  External key
                </label>
                <input
                  id="tenant-detail-external-key"
                  value={tenantForm.externalKey}
                  onChange={(event) => setTenantForm((current) => ({ ...current, externalKey: event.target.value }))}
                  className={inputClassName}
                />
              </div>

              <div>
                <label htmlFor="tenant-detail-status" className="mb-1.5 block mono text-xs font-medium text-slate-700">
                  Tenant status
                </label>
                <select
                  id="tenant-detail-status"
                  value={tenantForm.status}
                  onChange={(event) => setTenantForm((current) => ({ ...current, status: event.target.value as TenantRecord["status"] }))}
                  className={inputClassName}
                >
                  <option value="active">active</option>
                  <option value="paused">paused</option>
                  <option value="archived">archived</option>
                </select>
              </div>

              <div className="lg:col-span-2">
                <label htmlFor="tenant-detail-description" className="mb-1.5 block mono text-xs font-medium text-slate-700">
                  Tenant description
                </label>
                <textarea
                  id="tenant-detail-description"
                  value={tenantForm.description}
                  onChange={(event) => setTenantForm((current) => ({ ...current, description: event.target.value }))}
                  className={textAreaClassName}
                />
              </div>

              <div>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 mono text-xs font-medium text-white transition-colors duration-150 hover:bg-slate-800"
                >
                  Save tenant
                </button>
              </div>
            </form>
          </div>

          <div className="mb-6 flex flex-wrap gap-2">
            {tabs.map((tab) => {
              const active = tab.id === initialTab;

              return (
                <Link
                  key={tab.id}
                  href={`/tenants/${tenantId}?tab=${tab.id}`}
                  className={
                    active
                      ? "rounded-lg bg-slate-900 px-3 py-1.5 mono text-xs text-white"
                      : "rounded-lg border border-slate-200 bg-white px-3 py-1.5 mono text-xs text-slate-600 transition-colors duration-150 hover:bg-slate-50"
                  }
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>

          {initialTab === "overview" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-900">Effective Policy Summary</h2>
                <p className="mono mt-0.5 text-xs text-slate-400">Read-only summary derived from tenant policy and quota configuration</p>
                <dl className="mt-4 space-y-3">
                  <div>
                    <dt className="mono text-xs text-slate-400">Policy name</dt>
                    <dd className="text-sm text-slate-900">{activePolicy?.name ?? "No tenant policy configured"}</dd>
                  </div>
                  <div>
                    <dt className="mono text-xs text-slate-400">Allowed KB IDs</dt>
                    <dd className="mono text-xs text-slate-700">
                      {activePolicy?.allowedKbIdsJson.length ? activePolicy.allowedKbIdsJson.join(", ") : "none configured"}
                    </dd>
                  </div>
                  <div>
                    <dt className="mono text-xs text-slate-400">Allowed model IDs</dt>
                    <dd className="mono text-xs text-slate-700">
                      {activePolicy?.allowedModelIdsJson.length ? activePolicy.allowedModelIdsJson.join(", ") : "none configured"}
                    </dd>
                  </div>
                  <div>
                    <dt className="mono text-xs text-slate-400">Fallback model</dt>
                    <dd className="mono text-xs text-slate-700">{activePolicy?.fallbackModelId ?? "none configured"}</dd>
                  </div>
                  <div>
                    <dt className="mono text-xs text-slate-400">Require citation</dt>
                    <dd className="mono text-xs text-slate-700">{activePolicy?.requireCitation ? "true" : "false"}</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-900">Quota Summary</h2>
                <p className="mono mt-0.5 text-xs text-slate-400">Current thresholds that can influence runtime downgrade or block decisions</p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <AlertStateBadge state={tenantUsage?.alertState ?? null} />
                  <QuotaProgressBar value={tenantUsage?.quotaUsagePercent ?? null} testId="tenant-detail-quota-progress" />
                </div>
                <dl className="mt-4 space-y-3">
                  <div>
                    <dt className="mono text-xs text-slate-400">Monthly request limit</dt>
                    <dd className="mono text-xs text-slate-700">{quotaForm.requestLimitMonthly ?? "unlimited"}</dd>
                  </div>
                  <div>
                    <dt className="mono text-xs text-slate-400">Monthly token limit</dt>
                    <dd className="mono text-xs text-slate-700">{quotaForm.tokenLimitMonthly ?? "unlimited"}</dd>
                  </div>
                  <div>
                    <dt className="mono text-xs text-slate-400">Monthly cost limit</dt>
                    <dd className="mono text-xs text-slate-700">{quotaForm.costLimitMonthly ?? "unlimited"}</dd>
                  </div>
                  <div>
                    <dt className="mono text-xs text-slate-400">Soft threshold</dt>
                    <dd className="mono text-xs text-slate-700">{quotaForm.softThresholdPercent}%</dd>
                  </div>
                  <div>
                    <dt className="mono text-xs text-slate-400">Hard threshold</dt>
                    <dd className="mono text-xs text-slate-700">{quotaForm.hardThresholdPercent}%</dd>
                  </div>
                </dl>
              </div>
            </div>
          ) : null}

          {initialTab === "ledger" ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Recent ledger activity</h2>
                  <p className="mono mt-0.5 text-xs text-slate-400">Latest 20 request-level evidence records for this tenant</p>
                </div>
                <Link
                  href={`/ledger`}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 mono text-xs text-slate-600 transition-colors duration-150 hover:bg-slate-50"
                >
                  Open full ledger
                </Link>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full" aria-label="Recent ledger table">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-4 py-2.5 text-left mono text-xs font-medium text-slate-400">Request</th>
                      <th className="px-4 py-2.5 text-left mono text-xs font-medium text-slate-400">Application</th>
                      <th className="px-4 py-2.5 text-left mono text-xs font-medium text-slate-400">Status</th>
                      <th className="px-4 py-2.5 text-left mono text-xs font-medium text-slate-400">Latency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentLedger.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-sm text-slate-500">
                          No recent ledger activity.
                        </td>
                      </tr>
                    ) : (
                      recentLedger.map((item) => (
                        <tr key={item.requestId} className="transition-colors duration-100 hover:bg-slate-50/60">
                          <td className="px-4 py-3">
                            <Link href={`/ledger?request_id=${item.requestId}`} className="mono text-xs font-semibold text-slate-900 hover:text-sky-600">
                              {item.requestId}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700">{item.applicationName}</td>
                          <td className="px-4 py-3 mono text-xs text-slate-700">{item.status}</td>
                          <td className="px-4 py-3 mono text-xs text-slate-500">{item.latencyMs ?? 0} ms</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {initialTab === "applications" ? (
            <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4">
                  <h2 className="text-sm font-semibold text-slate-900">Create Application</h2>
                  <p className="mono mt-0.5 text-xs text-slate-400">Create a runtime identity. Plaintext keys are shown once on create and rotate.</p>
                </div>

                <form onSubmit={onCreateApplication} className="space-y-4">
                  <div>
                    <label htmlFor="application-name" className="mb-1.5 block mono text-xs font-medium text-slate-700">
                      Application name
                    </label>
                    <input
                      id="application-name"
                      value={newApplication.name}
                      onChange={(event) => setNewApplication((current) => ({ ...current, name: event.target.value }))}
                      className={inputClassName}
                    />
                  </div>

                  <div>
                    <label htmlFor="application-environment" className="mb-1.5 block mono text-xs font-medium text-slate-700">
                      Environment
                    </label>
                    <select
                      id="application-environment"
                      value={newApplication.environment}
                      onChange={(event) => setNewApplication((current) => ({ ...current, environment: event.target.value as CreateApplicationInput["environment"] }))}
                      className={inputClassName}
                    >
                      <option value="dev">dev</option>
                      <option value="staging">staging</option>
                      <option value="prod">prod</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="application-status" className="mb-1.5 block mono text-xs font-medium text-slate-700">
                      Application status
                    </label>
                    <select
                      id="application-status"
                      value={newApplication.status}
                      onChange={(event) => setNewApplication((current) => ({ ...current, status: event.target.value as CreateApplicationInput["status"] }))}
                      className={inputClassName}
                    >
                      <option value="active">active</option>
                      <option value="disabled">disabled</option>
                      <option value="archived">archived</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 mono text-xs font-medium text-white transition-colors duration-150 hover:bg-slate-800"
                  >
                    Create application
                  </button>
                </form>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4">
                  <h2 className="text-sm font-semibold text-slate-900">Applications</h2>
                  <p className="mono mt-0.5 text-xs text-slate-400">Rotate runtime keys and control active, disabled, or archived state</p>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full" aria-label="Applications table">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="px-4 py-2.5 text-left mono text-xs font-medium text-slate-400">Application</th>
                        <th className="px-4 py-2.5 text-left mono text-xs font-medium text-slate-400">Environment</th>
                        <th className="px-4 py-2.5 text-left mono text-xs font-medium text-slate-400">Status</th>
                        <th className="px-4 py-2.5 text-left mono text-xs font-medium text-slate-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {applications.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-sm text-slate-500">
                            No applications have been registered for this tenant.
                          </td>
                        </tr>
                      ) : (
                        applications.map((application) => (
                          <tr key={application.id}>
                            <td className="px-4 py-3">
                              <p className="text-sm font-semibold text-slate-900">{application.name}</p>
                              <p className="mono mt-0.5 text-xs text-slate-400">{application.id.slice(0, 8)}</p>
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={applicationDrafts[application.id]?.environment ?? application.environment}
                                onChange={(event) =>
                                  setApplicationDrafts((current) => ({
                                    ...current,
                                    [application.id]: {
                                      ...(current[application.id] ?? {
                                        name: application.name,
                                        environment: application.environment,
                                        status: application.status
                                      }),
                                      environment: event.target.value as CreateApplicationInput["environment"]
                                    }
                                  }))
                                }
                                className={inputClassName}
                              >
                                <option value="dev">dev</option>
                                <option value="staging">staging</option>
                                <option value="prod">prod</option>
                              </select>
                            </td>
                            <td className="px-4 py-3">
                              <select
                                aria-label="Row status"
                                value={applicationDrafts[application.id]?.status ?? application.status}
                                onChange={(event) =>
                                  setApplicationDrafts((current) => ({
                                    ...current,
                                    [application.id]: {
                                      ...(current[application.id] ?? {
                                        name: application.name,
                                        environment: application.environment,
                                        status: application.status
                                      }),
                                      status: event.target.value as CreateApplicationInput["status"]
                                    }
                                  }))
                                }
                                className={inputClassName}
                              >
                                <option value="active">active</option>
                                <option value="disabled">disabled</option>
                                <option value="archived">archived</option>
                              </select>
                              <p className="mono mt-1 text-xs text-slate-400">
                                {applicationDrafts[application.id]?.status ?? application.status}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => void onSaveApplication(application.id)}
                                  className="rounded-lg border border-slate-200 px-3 py-1.5 mono text-xs text-slate-600 transition-colors duration-150 hover:bg-slate-50"
                                >
                                  Save application
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void onRotateKey(application.id)}
                                  className="rounded-lg bg-slate-900 px-3 py-1.5 mono text-xs text-white transition-colors duration-150 hover:bg-slate-800"
                                >
                                  Rotate key
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}

          {initialTab === "quota" ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-slate-900">Quota Settings</h2>
                <p className="mono mt-0.5 text-xs text-slate-400">Monthly limits and soft or hard thresholds for advisory enforcement</p>
              </div>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <AlertStateBadge state={tenantUsage?.alertState ?? null} />
                <QuotaProgressBar value={tenantUsage?.quotaUsagePercent ?? null} />
              </div>

              <form onSubmit={onSaveQuota} className="grid gap-4 lg:grid-cols-2">
                <div>
                  <label htmlFor="quota-request-limit" className="mb-1.5 block mono text-xs font-medium text-slate-700">
                    Monthly request limit
                  </label>
                  <input
                    id="quota-request-limit"
                    value={quotaForm.requestLimitMonthly ?? ""}
                    onChange={(event) =>
                      setQuotaForm((current) => ({
                        ...current,
                        requestLimitMonthly: event.target.value ? Number(event.target.value) : null
                      }))
                    }
                    className={inputClassName}
                  />
                </div>

                <div>
                  <label htmlFor="quota-token-limit" className="mb-1.5 block mono text-xs font-medium text-slate-700">
                    Monthly token limit
                  </label>
                  <input
                    id="quota-token-limit"
                    value={quotaForm.tokenLimitMonthly ?? ""}
                    onChange={(event) =>
                      setQuotaForm((current) => ({
                        ...current,
                        tokenLimitMonthly: event.target.value ? Number(event.target.value) : null
                      }))
                    }
                    className={inputClassName}
                  />
                </div>

                <div>
                  <label htmlFor="quota-cost-limit" className="mb-1.5 block mono text-xs font-medium text-slate-700">
                    Monthly cost limit
                  </label>
                  <input
                    id="quota-cost-limit"
                    value={quotaForm.costLimitMonthly ?? ""}
                    onChange={(event) =>
                      setQuotaForm((current) => ({
                        ...current,
                        costLimitMonthly: event.target.value || null
                      }))
                    }
                    className={inputClassName}
                  />
                </div>

                <div>
                  <label htmlFor="quota-soft-threshold" className="mb-1.5 block mono text-xs font-medium text-slate-700">
                    Soft threshold percent
                  </label>
                  <input
                    id="quota-soft-threshold"
                    value={quotaForm.softThresholdPercent}
                    onChange={(event) =>
                      setQuotaForm((current) => ({
                        ...current,
                        softThresholdPercent: Number(event.target.value)
                      }))
                    }
                    className={inputClassName}
                  />
                </div>

                <div>
                  <label htmlFor="quota-hard-threshold" className="mb-1.5 block mono text-xs font-medium text-slate-700">
                    Hard threshold percent
                  </label>
                  <input
                    id="quota-hard-threshold"
                    value={quotaForm.hardThresholdPercent}
                    onChange={(event) =>
                      setQuotaForm((current) => ({
                        ...current,
                        hardThresholdPercent: Number(event.target.value)
                      }))
                    }
                    className={inputClassName}
                  />
                </div>

                <div>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 mono text-xs font-medium text-white transition-colors duration-150 hover:bg-slate-800"
                  >
                    Save quota
                  </button>
                </div>
              </form>
            </div>
          ) : null}

          {initialTab === "policy" ? (
            <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4">
                  <h2 className="text-sm font-semibold text-slate-900">Tenant Policies</h2>
                  <p className="mono mt-0.5 text-xs text-slate-400">Tenant-scoped policy only. Applications do not define their own policy boundary.</p>
                </div>

                <div className="space-y-3">
                  {policies.length === 0 ? (
                    <p className="text-sm text-slate-500">No policies exist for this tenant yet.</p>
                  ) : (
                    policies.map((policy) => (
                      <div key={policy.id} className="rounded-xl border border-slate-200 p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-semibold text-slate-900">{policy.name}</h3>
                            <p className="mono mt-0.5 text-xs text-slate-400">{policy.enabled ? "enabled" : "disabled"}</p>
                          </div>
                          <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 mono text-xs text-slate-600">
                            {policy.requireCitation ? "citations required" : "citations optional"}
                          </span>
                        </div>
                        <dl className="mt-4 grid gap-3 md:grid-cols-2">
                          <div>
                            <dt className="mono text-xs text-slate-400">Allowed KB IDs</dt>
                            <dd className="mono text-xs text-slate-700">{policy.allowedKbIdsJson.join(", ") || "none configured"}</dd>
                          </div>
                          <div>
                            <dt className="mono text-xs text-slate-400">Allowed model IDs</dt>
                            <dd className="mono text-xs text-slate-700">{policy.allowedModelIdsJson.join(", ") || "none configured"}</dd>
                          </div>
                          <div>
                            <dt className="mono text-xs text-slate-400">Fallback model</dt>
                            <dd className="mono text-xs text-slate-700">{policy.fallbackModelId ?? "none configured"}</dd>
                          </div>
                          <div>
                            <dt className="mono text-xs text-slate-400">Notes</dt>
                            <dd className="text-sm text-slate-700">{policy.notes ?? "No notes"}</dd>
                          </div>
                        </dl>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4">
                  <h2 className="text-sm font-semibold text-slate-900">Edit Entry</h2>
                  <p className="mono mt-0.5 text-xs text-slate-400">Use the shared policy management page to create, edit, and test tenant policy records.</p>
                </div>
                <Link
                  href={`/policies?tenantId=${tenantId}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 mono text-xs font-medium text-white transition-colors duration-150 hover:bg-slate-800"
                >
                  Manage policies
                </Link>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </>
  );
}
