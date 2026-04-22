"use client";

import { useState, type FormEvent } from "react";

type FormState = {
  email: string;
  password: string;
};

export function LoginForm() {
  const [formState, setFormState] = useState<FormState>({
    email: "",
    password: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(formState)
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      setSubmitting(false);
      setError(payload?.error?.message ?? "Unable to sign in.");
      return;
    }

    window.location.href = "/";
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="mb-4">
        <label htmlFor="email" className="mb-1.5 block mono text-xs font-medium text-slate-700">
          Email address <span className="text-red-500">*</span>
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={formState.email}
          onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))}
          placeholder="you@company.com"
          className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 mono text-sm text-slate-900 placeholder-slate-300 transition-colors duration-150 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
      </div>

      <div className="mb-6">
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="password" className="block mono text-xs font-medium text-slate-700">
            Password <span className="text-red-500">*</span>
          </label>
          <span className="mono text-xs text-sky-600">Seed login only</span>
        </div>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={formState.password}
            onChange={(event) => setFormState((current) => ({ ...current, password: event.target.value }))}
            placeholder="••••••••"
            className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 pr-10 mono text-sm text-slate-900 placeholder-slate-300 transition-colors duration-150 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          <button
            type="button"
            aria-label="Toggle password visibility"
            onClick={() => setShowPassword((current) => !current)}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 transition-colors duration-150 hover:text-slate-600"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {submitting ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
