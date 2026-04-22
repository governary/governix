import { tenantRepository } from "@governix/db";
import { updateTenantSchema } from "@governix/shared";

import { handleRouteError, jsonData, jsonMessage, jsonNotFound, parseJsonBody, requireSession } from "../../../../lib/api";

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

    return jsonData(tenant);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ tenantId: string }> }) {
  const auth = await requireSession({ write: true });
  if (auth.error) {
    return auth.error;
  }

  const payload = await parseJsonBody(request, updateTenantSchema);
  if (payload.error) {
    return payload.error;
  }

  try {
    const { tenantId } = await context.params;
    const tenant = await tenantRepository.update(tenantId, payload.data);

    if (!tenant) {
      return jsonNotFound("Tenant");
    }

    return jsonMessage("Tenant updated.", tenant);
  } catch (error) {
    return handleRouteError(error);
  }
}
