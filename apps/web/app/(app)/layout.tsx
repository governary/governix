import type { ReactNode } from "react";

import { redirect } from "next/navigation";

import { Sidebar } from "../../components/sidebar";
import { getSession } from "../../lib/auth";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <Sidebar email={session.email} />
      <main className="flex-1 overflow-auto bg-slate-50/50 p-6">{children}</main>
    </div>
  );
}
