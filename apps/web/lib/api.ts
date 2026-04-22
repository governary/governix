import { z, type ZodTypeAny } from "zod";

import { NextResponse } from "next/server";

import { getSession } from "./auth";

const writeRoles = new Set(["admin", "operator"]);

export async function requireSession(options?: { write?: boolean }) {
  const session = await getSession();

  if (!session || session.status !== "active") {
    return {
      error: jsonError(401, "UNAUTHORIZED", "Authentication is required.")
    };
  }

  if (options?.write && !writeRoles.has(session.role)) {
    return {
      error: jsonError(403, "FORBIDDEN", "You do not have permission to modify this resource.")
    };
  }

  return { session };
}

export async function parseJsonBody<TSchema extends ZodTypeAny>(request: Request, schema: TSchema) {
  const payload = await request.json().catch(() => null);
  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    return {
      error: jsonError(400, "VALIDATION_ERROR", "Invalid request payload.", parsed.error.flatten())
    };
  }

  return { data: parsed.data as z.infer<TSchema> };
}

export function parseSearchParams<TSchema extends ZodTypeAny>(params: URLSearchParams, schema: TSchema) {
  const raw = Object.fromEntries(params.entries());
  const parsed = schema.safeParse({
    ...raw,
    pageSize: raw.page_size ?? raw.pageSize
  });

  if (!parsed.success) {
    return {
      error: jsonError(400, "VALIDATION_ERROR", "Invalid query parameters.", parsed.error.flatten())
    };
  }

  return { data: parsed.data as z.infer<TSchema> };
}

export function jsonData(data: unknown, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function jsonMessage(message: string, data?: unknown, init?: ResponseInit) {
  return NextResponse.json({ message, data }, init);
}

export function jsonError(status: number, code: string, message: string, issues?: unknown) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(issues ? { issues } : {})
      }
    },
    { status }
  );
}

export function jsonNotFound(resource: string) {
  return jsonError(404, "NOT_FOUND", `${resource} was not found.`);
}

export function handleRouteError(error: unknown) {
  if (isUniqueViolation(error)) {
    return jsonError(409, "CONFLICT", "A resource with the same unique fields already exists.");
  }

  console.error(error);
  return jsonError(500, "INTERNAL_ERROR", "An unexpected error occurred.");
}

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}
