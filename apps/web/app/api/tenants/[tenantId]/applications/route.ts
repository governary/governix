import { applicationRepository, tenantRepository } from "@governix/db";
import { createApplicationSchema } from "@governix/shared";

import { createApiKeyHashPair } from "../../../../../lib/api-keys";
import { handleRouteError, jsonData, jsonMessage, jsonNotFound, parseJsonBody, requireSession } from "../../../../../lib/api";

export const runtime = "nodejs";

export async function GET(_: Request, context: { params: Promise<{ tenantId: string }> }) {
  const auth = await requireSession();
  if (auth.error) {
    return auth.error;
  }

  try {
    const { tenantId } = await context.params;
    const tenant = await tenantRepository.findById(tenantId);

    if (!tenant) {
      return jsonNotFound("Tenant");
    }

    const items = await applicationRepository.listByTenantId(tenantId);
    return jsonData(items);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ tenantId: string }> }) {
  const auth = await requireSession({ write: true });
  if (auth.error) {
    return auth.error;
  }

  const payload = await parseJsonBody(request, createApplicationSchema);
  if (payload.error) {
    return payload.error;
  }

  try {
    const { tenantId } = await context.params;
    const tenant = await tenantRepository.findById(tenantId);

    if (!tenant) {
      return jsonNotFound("Tenant");
    }

    const apiKey = await createApiKeyHashPair();
    const application = await applicationRepository.create(tenantId, payload.data, apiKey.hashed);

    return jsonMessage(
      "Application created.",
      {
        application,
        apiKey: apiKey.plaintext
      },
      { status: 201 }
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
