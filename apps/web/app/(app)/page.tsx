import Link from "next/link";

import { AlertStateBadge, QuotaProgressBar } from "../../components/admin/ui-primitives";
import { DashboardIcon, LedgerIcon, ShieldIcon, TenantsIcon, UsageIcon } from "../../components/icons";
import { getDashboardOverview } from "../../lib/dashboard";

const metricConfig = [
  { id: "total-tenants", label: "Total tenants", key: "totalTenants", Icon: TenantsIcon },
  { id: "total-requests", label: "Requests MTD", key: "totalRequests", Icon: DashboardIcon },
  { id: "total-tokens", label: "Tokens MTD", key: "totalTokens", Icon: UsageIcon },
  { id: "estimated-cost", label: "Estimated cost MTD", key: "estimatedCost", Icon: LedgerIcon },
  { id: "tenants-in-alert", label: "Tenants in alert", key: "tenantsInAlert", Icon: ShieldIcon },
  { id: "tenants-over-limit", label: "Tenants over limit", key: "tenantsOverLimit", Icon: TenantsIcon },
  { id: "errors-24h", label: "Errors (24h)", key: "errors24h", Icon: LedgerIcon },
  { id: "policy-blocks-24h", label: "Policy blocks (24h)", key: "policyBlocks24h", Icon: ShieldIcon }
] as const;

function formatMetricValue(id: (typeof metricConfig)[number]["id"], value: number) {
  if (id === "estimated-cost") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 4,
      maximumFractionDigits: 4
    }).format(value);
  }

  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

export default async function DashboardPage() {
  const overview = await getDashboardOverview();
  const metricsByKey = overview.metrics as Record<(typeof metricConfig)[number]["key"], number>;

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-slate-900">Dashboard</h1>
          <p className="mono mt-0.5 text-xs text-slate-400">Platform overview</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="mono text-xs text-slate-400">{overview.monthLabel}</span>
          <Link
            href="/usage"
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 mono text-xs font-medium text-white transition-colors duration-150 hover:bg-slate-800"
          >
            Open usage
          </Link>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricConfig.map(({ id, label, key, Icon }) => (
          <div key={id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="mono text-xs text-slate-400">{label}</p>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50">
                <Icon className="h-3.5 w-3.5 text-sky-500" />
              </div>
            </div>
            <p data-testid={`dashboard-kpi-${id}`} className="mono text-2xl font-bold text-slate-900">
              {formatMetricValue(id, metricsByKey[key])}
            </p>
            <p className="mono mt-1 text-xs text-slate-500">
              {id === "errors-24h" || id === "policy-blocks-24h" ? "Rolling 24 hour window" : `Window ${overview.dateFrom} to ${overview.dateTo}`}
            </p>
          </div>
        ))}
      </div>

      <div className="mb-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Risk tenants</h2>
              <p className="mono mt-0.5 text-xs text-slate-400">Warning and hard-limit tenants ranked by current estimated cost</p>
            </div>
            <Link href="/tenants" className="mono text-xs text-sky-600 hover:text-sky-700">
              Open tenants
            </Link>
          </div>

          <div className="space-y-3">
            {overview.riskTenants.length === 0 ? (
              <p className="text-sm text-slate-500">No tenants are above their configured warning threshold.</p>
            ) : (
              overview.riskTenants.map((tenant) => (
                <div key={tenant.tenantId} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{tenant.tenantName}</h3>
                      <p className="mono mt-0.5 text-xs text-slate-400">{tenant.requestCount} requests this month</p>
                    </div>
                    <AlertStateBadge state={tenant.alertState} testId={`tenant-alert-state-${tenant.tenantId}`} />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <QuotaProgressBar value={tenant.quotaUsagePercent} />
                    <span className="mono text-xs text-slate-500">
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "USD",
                        minimumFractionDigits: 4,
                        maximumFractionDigits: 4
                      }).format(tenant.estimatedCost)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-900">Status overview</h2>
            <p className="mono mt-0.5 text-xs text-slate-400">Current tenant lifecycle distribution</p>
          </div>
          <dl className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5">
              <dt className="text-sm text-slate-700">Active tenants</dt>
              <dd className="mono text-xs font-semibold text-slate-900">{overview.statusOverview.active}</dd>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5">
              <dt className="text-sm text-slate-700">Paused tenants</dt>
              <dd className="mono text-xs font-semibold text-slate-900">{overview.statusOverview.paused}</dd>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5">
              <dt className="text-sm text-slate-700">Archived tenants</dt>
              <dd className="mono text-xs font-semibold text-slate-900">{overview.statusOverview.archived}</dd>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5">
              <dt className="text-sm text-slate-700">Applications</dt>
              <dd className="mono text-xs font-semibold text-slate-900">{overview.metrics.totalApplications}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-900">Quick jumps</h2>
            <p className="mono mt-0.5 text-xs text-slate-400">Fast access to the main control-plane workflows</p>
          </div>
          <div className="space-y-2">
            <Link
              href="/tenants"
              className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 transition-colors duration-150 hover:bg-slate-50"
            >
              <span>Tenants and applications</span>
              <span className="mono text-xs text-slate-400">/tenants</span>
            </Link>
            <Link
              href="/usage"
              className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 transition-colors duration-150 hover:bg-slate-50"
            >
              <span>Usage and showback</span>
              <span className="mono text-xs text-slate-400">/usage</span>
            </Link>
            <Link
              href="/ledger"
              className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 transition-colors duration-150 hover:bg-slate-50"
            >
              <span>Audit ledger</span>
              <span className="mono text-xs text-slate-400">/ledger</span>
            </Link>
            <Link
              href="/policies"
              className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 transition-colors duration-150 hover:bg-slate-50"
            >
              <span>Policy management</span>
              <span className="mono text-xs text-slate-400">/policies</span>
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
