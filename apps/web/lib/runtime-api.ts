import { applicationRepository } from "@governix/db";
import { RUNTIME_API_KEY_HEADER } from "@governix/shared";

import { jsonError } from "./api";

function extractBearerToken(value: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = trimmed.slice(7).trim();
  return token.length > 0 ? token : null;
}

export function getRuntimeApiKey(request: Request) {
  const explicitKey = request.headers.get(RUNTIME_API_KEY_HEADER) ?? request.headers.get("x-api-key");

  if (explicitKey && explicitKey.trim().length > 0) {
    return explicitKey.trim();
  }

  return extractBearerToken(request.headers.get("authorization"));
}

export async function requireRuntimeApplicationAccess(request: Request, applicationId: string, tenantId: string) {
  const apiKey = getRuntimeApiKey(request);

  if (!apiKey) {
    return {
      error: jsonError(401, "UNAUTHORIZED", "A valid runtime application API key is required.")
    };
  }

  const application = await applicationRepository.findAuthorizedRuntimeApplication(applicationId, apiKey);

  if (!application || application.tenantId !== tenantId) {
    return {
      error: jsonError(401, "UNAUTHORIZED", "The runtime application API key is invalid for this tenant/application context.")
    };
  }

  return { application };
}
