"use client";

import { useEffect, useState, type FormEvent } from "react";

import type { CreatePolicyInput, PolicyEvaluationResult, PolicyTestRequest } from "@governix/shared";

import { requestJson } from "../../lib/client-api";

type TenantOption = {
  id: string;
  name: string;
};

type PolicyRecord = {
  id: string;
  tenantId: string;
  tenantName: string;
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

const inputClassName =
  "block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 mono text-sm text-slate-900 transition-colors duration-150 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500";

const textAreaClassName = `${inputClassName} min-h-24 resize-y`;

export function PoliciesPageClient({
  initialTenants,
  initialPolicies,
  initialTenantId
}: {
  initialTenants: TenantOption[];
  initialPolicies: PolicyRecord[];
  initialTenantId: string | null;
}) {
  const [tenants] = useState(initialTenants);
  const [policies, setPolicies] = useState(initialPolicies);
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<PolicyEvaluationResult | null>(null);
  const [form, setForm] = useState<CreatePolicyInput>({
    tenantId: initialTenantId ?? initialTenants[0]?.id ?? "",
    name: "",
    allowedKbIds: [],
    allowedModelIds: [],
    requireCitation: false,
    fallbackModelId: null,
    enabled: true,
    notes: null
  });
  const [policyTestForm, setPolicyTestForm] = useState<PolicyTestRequest>({
    kbId: null,
    modelId: null,
    requestType: "retrieve_and_generate"
  });
  const [policyUnderTestId, setPolicyUnderTestId] = useState(initialPolicies[0]?.id ?? "");

  useEffect(() => {
    if (!editingPolicyId) {
      return;
    }

    const policy = policies.find((item) => item.id === editingPolicyId);
    if (!policy) {
      return;
    }

    setForm({
      tenantId: policy.tenantId,
      name: policy.name,
      allowedKbIds: policy.allowedKbIdsJson,
      allowedModelIds: policy.allowedModelIdsJson,
      requireCitation: policy.requireCitation,
      fallbackModelId: policy.fallbackModelId,
      enabled: policy.enabled,
      notes: policy.notes
    });
  }, [editingPolicyId, policies]);

  async function onSubmitPolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setTestResult(null);

    const body = {
      ...form,
      allowedKbIds: Array.isArray(form.allowedKbIds) ? form.allowedKbIds.join(",") : form.allowedKbIds,
      allowedModelIds: Array.isArray(form.allowedModelIds) ? form.allowedModelIds.join(",") : form.allowedModelIds
    };

    try {
      if (editingPolicyId) {
        const payload = await requestJson<PolicyRecord>(`/api/policies/${editingPolicyId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            allowedKbIds: body.allowedKbIds,
            allowedModelIds: body.allowedModelIds,
            requireCitation: form.requireCitation,
            fallbackModelId: form.fallbackModelId,
            enabled: form.enabled,
            notes: form.notes
          })
        });

        setPolicies((current) =>
          current.map((policy) =>
            policy.id === editingPolicyId
              ? {
                  ...policy,
                  ...(payload.data ?? policy),
                  tenantName: current.find((item) => item.id === editingPolicyId)?.tenantName ?? policy.tenantName
                }
              : policy
          )
        );
        setMessage(payload.message ?? "Policy updated.");
      } else {
        const payload = await requestJson<Omit<PolicyRecord, "tenantName">>(`/api/tenants/${form.tenantId}/policies`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });

        const tenantName = tenants.find((tenant) => tenant.id === form.tenantId)?.name ?? "Unknown tenant";
        const nextPolicy = payload.data ? { ...payload.data, tenantName } : null;
        if (nextPolicy) {
          setPolicies((current) => [nextPolicy, ...current]);
          setPolicyUnderTestId(nextPolicy.id);
        }

        setMessage(payload.message ?? "Policy created.");
      }

      setEditingPolicyId(null);
      setForm({
        tenantId: form.tenantId,
        name: "",
        allowedKbIds: [],
        allowedModelIds: [],
        requireCitation: false,
        fallbackModelId: null,
        enabled: true,
        notes: null
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to save policy.");
    }
  }

  async function onRunPolicyTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    try {
      const payload = await requestJson<PolicyEvaluationResult>(`/api/policies/${policyUnderTestId}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(policyTestForm)
      });

      setTestResult(payload.data ?? null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to run policy test.");
    }
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-slate-900">Policy</h1>
          <p className="mono mt-0.5 text-xs text-slate-400">Tenant-scoped policy CRUD and explainable evaluation testing</p>
        </div>
        <div className="mono text-xs text-slate-400">{policies.length} policies</div>
      </div>

      {message ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
      {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="mb-6 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-900">{editingPolicyId ? "Edit Policy" : "Create Policy"}</h2>
            <p className="mono mt-0.5 text-xs text-slate-400">Allowed knowledge bases, allowed models, fallback model, and citation requirements</p>
          </div>

          <form onSubmit={onSubmitPolicy} className="space-y-4">
            <div>
              <label htmlFor="policy-tenant" className="mb-1.5 block mono text-xs font-medium text-slate-700">
                Tenant
              </label>
              <select
                id="policy-tenant"
                value={form.tenantId}
                onChange={(event) => setForm((current) => ({ ...current, tenantId: event.target.value }))}
                className={inputClassName}
              >
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="policy-name" className="mb-1.5 block mono text-xs font-medium text-slate-700">
                Policy name
              </label>
              <input
                id="policy-name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className={inputClassName}
              />
            </div>

            <div>
              <label htmlFor="policy-kb-ids" className="mb-1.5 block mono text-xs font-medium text-slate-700">
                Allowed KB IDs
              </label>
              <input
                id="policy-kb-ids"
                value={Array.isArray(form.allowedKbIds) ? form.allowedKbIds.join(",") : ""}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    allowedKbIds: event.target.value.split(",").map((item) => item.trim()).filter(Boolean)
                  }))
                }
                className={inputClassName}
              />
            </div>

            <div>
              <label htmlFor="policy-model-ids" className="mb-1.5 block mono text-xs font-medium text-slate-700">
                Allowed model IDs
              </label>
              <input
                id="policy-model-ids"
                value={Array.isArray(form.allowedModelIds) ? form.allowedModelIds.join(",") : ""}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    allowedModelIds: event.target.value.split(",").map((item) => item.trim()).filter(Boolean)
                  }))
                }
                className={inputClassName}
              />
            </div>

            <div>
              <label htmlFor="policy-fallback-model" className="mb-1.5 block mono text-xs font-medium text-slate-700">
                Fallback model ID
              </label>
              <input
                id="policy-fallback-model"
                value={form.fallbackModelId ?? ""}
                onChange={(event) => setForm((current) => ({ ...current, fallbackModelId: event.target.value || null }))}
                className={inputClassName}
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 mono text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={form.requireCitation}
                  onChange={(event) => setForm((current) => ({ ...current, requireCitation: event.target.checked }))}
                />
                Require citation
              </label>

              <label className="inline-flex items-center gap-2 mono text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
                />
                Enabled
              </label>
            </div>

            <div>
              <label htmlFor="policy-notes" className="mb-1.5 block mono text-xs font-medium text-slate-700">
                Notes
              </label>
              <textarea
                id="policy-notes"
                value={form.notes ?? ""}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value || null }))}
                className={textAreaClassName}
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 mono text-xs font-medium text-white transition-colors duration-150 hover:bg-slate-800"
              >
                {editingPolicyId ? "Save policy" : "Create policy"}
              </button>
              {editingPolicyId ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditingPolicyId(null);
                    setForm({
                      tenantId: initialTenantId ?? tenants[0]?.id ?? "",
                      name: "",
                      allowedKbIds: [],
                      allowedModelIds: [],
                      requireCitation: false,
                      fallbackModelId: null,
                      enabled: true,
                      notes: null
                    });
                  }}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 mono text-xs text-slate-600 transition-colors duration-150 hover:bg-slate-50"
                >
                  Cancel edit
                </button>
              ) : null}
            </div>
          </form>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-900">Policy List</h2>
            <p className="mono mt-0.5 text-xs text-slate-400">Single tenant scope only. No application-scoped policy is introduced here.</p>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full" aria-label="Policies table">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-2.5 text-left mono text-xs font-medium text-slate-400">Policy</th>
                  <th className="px-4 py-2.5 text-left mono text-xs font-medium text-slate-400">Tenant</th>
                  <th className="px-4 py-2.5 text-left mono text-xs font-medium text-slate-400">Status</th>
                  <th className="px-4 py-2.5 text-left mono text-xs font-medium text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {policies.map((policy) => (
                  <tr key={policy.id}>
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-slate-900">{policy.name}</p>
                      <p className="mono mt-0.5 text-xs text-slate-400">
                        {policy.allowedModelIdsJson.join(", ") || "no models configured"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{policy.tenantName}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 mono text-xs text-slate-600">
                        {policy.enabled ? "enabled" : "disabled"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setEditingPolicyId(policy.id)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 mono text-xs text-slate-600 transition-colors duration-150 hover:bg-slate-50"
                      >
                        Edit policy
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-slate-900">Policy Test Panel</h2>
          <p className="mono mt-0.5 text-xs text-slate-400">Run explainable evaluation against the selected tenant policy record</p>
        </div>

        <form onSubmit={onRunPolicyTest} className="grid gap-4 lg:grid-cols-[220px_1fr_1fr_220px_auto]">
          <div>
            <label htmlFor="policy-under-test" className="mb-1.5 block mono text-xs font-medium text-slate-700">
              Policy under test
            </label>
            <select
              id="policy-under-test"
              value={policyUnderTestId}
              onChange={(event) => setPolicyUnderTestId(event.target.value)}
              className={inputClassName}
            >
              {policies.map((policy) => (
                <option key={policy.id} value={policy.id}>
                  {policy.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="requested-kb-id" className="mb-1.5 block mono text-xs font-medium text-slate-700">
              Requested KB ID
            </label>
            <input
              id="requested-kb-id"
              value={policyTestForm.kbId ?? ""}
              onChange={(event) => setPolicyTestForm((current) => ({ ...current, kbId: event.target.value || null }))}
              className={inputClassName}
            />
          </div>

          <div>
            <label htmlFor="requested-model-id" className="mb-1.5 block mono text-xs font-medium text-slate-700">
              Requested model ID
            </label>
            <input
              id="requested-model-id"
              value={policyTestForm.modelId ?? ""}
              onChange={(event) => setPolicyTestForm((current) => ({ ...current, modelId: event.target.value || null }))}
              className={inputClassName}
            />
          </div>

          <div>
            <label htmlFor="policy-request-type" className="mb-1.5 block mono text-xs font-medium text-slate-700">
              Request type
            </label>
            <select
              id="policy-request-type"
              value={policyTestForm.requestType}
              onChange={(event) => setPolicyTestForm((current) => ({ ...current, requestType: event.target.value as PolicyTestRequest["requestType"] }))}
              className={inputClassName}
            >
              <option value="retrieve">retrieve</option>
              <option value="retrieve_and_generate">retrieve_and_generate</option>
              <option value="generate">generate</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 mono text-xs font-medium text-white transition-colors duration-150 hover:bg-slate-800"
            >
              Run policy test
            </button>
          </div>
        </form>

        {testResult ? (
          <div className="mt-4 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-2">
            <div>
              <p className="mono text-xs text-slate-400">Final action</p>
              <p className="mono mt-1 text-sm font-semibold text-slate-900">{testResult.finalAction}</p>
            </div>
            <div>
              <p className="mono text-xs text-slate-400">Final model</p>
              <p className="mono mt-1 text-sm font-semibold text-slate-900">{testResult.finalModelId ?? "none"}</p>
            </div>
            <div>
              <p className="mono text-xs text-slate-400">Final KB</p>
              <p className="mono mt-1 text-sm font-semibold text-slate-900">{testResult.finalKbId ?? "none"}</p>
            </div>
            <div>
              <p className="mono text-xs text-slate-400">Matched policy IDs</p>
              <p className="mono mt-1 text-xs text-slate-700">{testResult.matchedPolicyIds.join(", ") || "none"}</p>
            </div>
            <div className="lg:col-span-2">
              <p className="mono text-xs text-slate-400">Reasons</p>
              <p className="mt-1 text-sm text-slate-700">{testResult.reasons.join(" ")}</p>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
