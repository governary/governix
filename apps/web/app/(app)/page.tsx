import { dashboardMetrics, tenantRows } from "../../lib/dashboard-data";
import { DashboardIcon, TenantsIcon, UsageIcon } from "../../components/icons";

const accentIconMap = {
  sky: DashboardIcon,
  violet: TenantsIcon,
  emerald: UsageIcon,
  amber: UsageIcon
};

const avatarToneClasses = {
  violet: "bg-violet-100 text-violet-700",
  sky: "bg-sky-100 text-sky-700",
  emerald: "bg-emerald-100 text-emerald-700"
} as const;

const statusToneClasses = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  error: "border-red-200 bg-red-50 text-red-700"
} as const;

const statusDotClasses = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-red-500"
} as const;

export default function DashboardPage() {
  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-slate-900">Dashboard</h1>
          <p className="mono mt-0.5 text-xs text-slate-400">Platform overview</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="mono text-xs text-slate-400">Apr 2026</span>
          <button className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 mono text-xs font-medium text-white transition-colors duration-150 hover:bg-slate-800">
            Export
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {dashboardMetrics.map((metric) => {
          const Icon = accentIconMap[metric.accent];

          return (
            <div key={metric.label} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="mono text-xs text-slate-400">{metric.label}</p>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50">
                  <Icon className="h-3.5 w-3.5 text-sky-500" />
                </div>
              </div>
              <p className="mono text-2xl font-bold text-slate-900">{metric.value}</p>
              <p className="mono mt-1 text-xs text-emerald-600">{metric.trend}</p>
            </div>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <p className="text-xs font-semibold text-slate-700">Tenants</p>
          <button className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 mono text-xs font-medium text-white transition-colors duration-150 hover:bg-slate-800">
            Add tenant
          </button>
        </div>

        <table className="w-full" aria-label="Tenant overview">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-2.5 text-left mono text-xs font-medium text-slate-400">Tenant</th>
              <th className="hidden px-4 py-2.5 text-left mono text-xs font-medium text-slate-400 sm:table-cell">Apps</th>
              <th className="px-4 py-2.5 text-left mono text-xs font-medium text-slate-400">Quota</th>
              <th className="hidden px-4 py-2.5 text-left mono text-xs font-medium text-slate-400 lg:table-cell">Requests</th>
              <th className="px-4 py-2.5 text-left mono text-xs font-medium text-slate-400">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tenantRows.map((row) => {
              const quotaBarClass =
                row.quotaPercent >= 100 ? "bg-red-500" : row.quotaPercent >= 80 ? "bg-amber-400" : "bg-sky-500";

              return (
                <tr key={row.externalKey} className="cursor-pointer transition-colors duration-100 hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${avatarToneClasses[row.avatarTone]}`}
                      >
                        <span className="mono text-xs font-bold">{row.initials}</span>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-900">{row.tenantName}</p>
                        <p className="mono text-xs text-slate-400">{row.externalKey}</p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-slate-500 sm:table-cell">{row.apps}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-1.5 w-16 flex-shrink-0 overflow-hidden rounded-full bg-slate-100"
                        role="progressbar"
                        aria-valuenow={row.quotaPercent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div className={`h-full rounded-full ${quotaBarClass}`} style={{ width: `${row.quotaPercent}%` }} />
                      </div>
                      <span className="mono text-xs text-slate-500">{row.quotaPercent}%</span>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    <span className="mono text-xs text-slate-700">{row.requests}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${statusToneClasses[row.statusTone]}`}
                    >
                      <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${statusDotClasses[row.statusTone]}`} />
                      {row.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

