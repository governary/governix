"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { DashboardIcon, LedgerIcon, ShieldIcon, TenantsIcon, UsageIcon } from "./icons";
import { BrandMark } from "./brand";

const navItems = [
  { href: "/", label: "Dashboard", icon: DashboardIcon },
  { href: "/tenants", label: "Tenants", icon: TenantsIcon },
  { href: "/usage", label: "Usage", icon: UsageIcon },
  { href: "/ledger", label: "Audit Ledger", icon: LedgerIcon },
  { href: "/policies", label: "Policy", icon: ShieldIcon }
];

export function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-48 flex-shrink-0 flex-col bg-slate-900" aria-label="Main navigation">
      <BrandMark />

      <nav className="flex-1 space-y-0.5 px-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;

          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "flex items-center gap-2.5 rounded-lg bg-slate-800 px-3 py-2 text-white"
                  : "flex items-center gap-2.5 rounded-lg px-3 py-2 text-slate-400 transition-colors duration-150 hover:bg-slate-800/60 hover:text-slate-200"
              }
            >
              <Icon className={active ? "h-4 w-4 flex-shrink-0 text-sky-400" : "h-4 w-4 flex-shrink-0"} />
              <span className="text-xs font-medium">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-700/50 px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-600">
            <span className="mono text-xs text-slate-300">A</span>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-300">Admin</p>
            <p className="mono text-xs text-slate-500">{email}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
