export type ApiSuccess<T> = {
  data?: T;
  message?: string;
};

type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
    issues?: {
      formErrors?: string[];
      fieldErrors?: Record<string, string[] | undefined>;
    };
  };
};

export class ApiClientError extends Error {
  status: number;
  code: string | null;
  details: string[];

  constructor(input: { status: number; code?: string | null; message: string; details?: string[] }) {
    super(input.message);
    this.name = "ApiClientError";
    this.status = input.status;
    this.code = input.code ?? null;
    this.details = input.details ?? [];
  }
}

function collectIssueDetails(
  issues:
    | {
        formErrors?: string[];
        fieldErrors?: Record<string, string[] | undefined>;
      }
    | undefined
) {
  if (!issues) {
    return [];
  }

  const details = [...(issues.formErrors ?? [])];

  for (const [field, messages] of Object.entries(issues.fieldErrors ?? {})) {
    for (const message of messages ?? []) {
      details.push(`${field}: ${message}`);
    }
  }

  return details;
}

export function getApiErrorDetails(error: unknown) {
  if (error instanceof ApiClientError) {
    return error.details;
  }

  return [];
}

export async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  const payload = (await response.json().catch(() => null)) as
    | (ApiSuccess<T> & ApiErrorPayload)
    | null;

  if (!response.ok) {
    throw new ApiClientError({
      status: response.status,
      code: payload?.error?.code ?? null,
      message: payload?.error?.message ?? "Request failed.",
      details: collectIssueDetails(payload?.error?.issues)
    });
  }

  return payload ?? {};
}
