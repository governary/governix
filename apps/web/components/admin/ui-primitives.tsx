"use client";

import type { AlertState } from "@governix/shared";

function getAlertToneClasses(state: AlertState | null) {
  if (state === "hard_limit") {
    return {
      badge: "border-red-200 bg-red-50 text-red-700",
      dot: "bg-red-500"
    };
  }

  if (state === "warning") {
    return {
      badge: "border-amber-200 bg-amber-50 text-amber-700",
      dot: "bg-amber-500"
    };
  }

  return {
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500"
  };
}

function getQuotaBarClass(value: number | null) {
  if (value === null) {
    return "bg-slate-300";
  }

  if (value >= 100) {
    return "bg-red-500";
  }

  if (value >= 80) {
    return "bg-amber-400";
  }

  return "bg-sky-500";
}

export function AlertStateBadge({
  state,
  testId
}: {
  state: AlertState | null;
  testId?: string;
}) {
  if (!state) {
    return <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 mono text-xs text-slate-500">n/a</span>;
  }

  const tone = getAlertToneClasses(state);

  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 mono text-xs font-medium ${tone.badge}`}
    >
      <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${tone.dot}`} />
      {state}
    </span>
  );
}

export function QuotaProgressBar({
  value,
  testId
}: {
  value: number | null;
  testId?: string;
}) {
  const clampedValue = value === null ? 0 : Math.min(100, Math.max(0, Number(value.toFixed(2))));

  return (
    <div data-testid={testId} className="flex items-center gap-2">
      <div
        className="h-1.5 w-16 flex-shrink-0 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuenow={clampedValue}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={`h-full rounded-full ${getQuotaBarClass(value)}`} style={{ width: `${clampedValue}%` }} />
      </div>
      <span className="mono text-xs text-slate-500">{value === null ? "n/a" : `${clampedValue}%`}</span>
    </div>
  );
}

type NoticeTone = "success" | "error" | "info" | "warning";

const noticeToneClasses: Record<NoticeTone, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  error: "border-red-200 bg-red-50 text-red-700",
  info: "border-sky-200 bg-sky-50 text-sky-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700"
};

export function InlineNotice({
  tone,
  message,
  details
}: {
  tone: NoticeTone;
  message: string;
  details?: string[];
}) {
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${noticeToneClasses[tone]}`}>
      <p>{message}</p>
      {details && details.length > 0 ? (
        <ul className="mt-2 list-disc pl-5 mono text-xs">
          {details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
