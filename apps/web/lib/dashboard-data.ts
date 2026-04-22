export const dashboardMetrics = [
  {
    label: "Total Tenants",
    value: "12",
    trend: "+2 this month",
    accent: "sky"
  },
  {
    label: "Active Apps",
    value: "34",
    trend: "across 12 tenants",
    accent: "violet"
  },
  {
    label: "Requests Today",
    value: "142,891",
    trend: "+12% vs yesterday",
    accent: "emerald"
  },
  {
    label: "Cost MTD",
    value: "$1,284.50",
    trend: "est. $2,100 EOM",
    accent: "amber"
  }
] as const;

export const tenantRows = [
  {
    initials: "AC",
    tenantName: "Acme Corp",
    externalKey: "tenant_01",
    apps: "2 apps",
    quotaPercent: 72,
    requests: "14,321",
    status: "Active",
    statusTone: "success",
    avatarTone: "violet"
  },
  {
    initials: "GX",
    tenantName: "GlobalTech",
    externalKey: "tenant_02",
    apps: "1 app",
    quotaPercent: 89,
    requests: "28,104",
    status: "Warning",
    statusTone: "warning",
    avatarTone: "sky"
  },
  {
    initials: "NV",
    tenantName: "Nova Health",
    externalKey: "tenant_03",
    apps: "3 apps",
    quotaPercent: 100,
    requests: "40,900",
    status: "Blocked",
    statusTone: "error",
    avatarTone: "emerald"
  }
] as const;

