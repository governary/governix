import { redirect } from "next/navigation";

import { BrandMark } from "../../components/brand";
import { LoginForm } from "../../components/login-form";
import { getSession } from "../../lib/auth";

export default async function LoginPage() {
  const session = await getSession();

  if (session) {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm">
        <BrandMark large />

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
          <h1 className="mb-1 text-sm font-bold text-slate-900">Sign in to your account</h1>
          <p className="mono mb-6 text-xs text-slate-400">Enter your credentials to continue</p>
          <LoginForm />
        </div>

        <p className="mono mt-6 text-center text-xs text-slate-400">Governix control plane · v0.1.0</p>
      </div>
    </main>
  );
}

