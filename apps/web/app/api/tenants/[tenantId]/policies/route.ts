import { policyRepository, tenantRepository } from "@governix/db";
import { createPolicySchema } from "@governix/shared";

import { handleRouteError, jsonData, jsonError, jsonMessage, jsonNotFound, parseJsonBody, requireSession } from "../../../../../lib/api";

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

    const items = await policyRepository.listByTenantId(tenantId);
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

  const payload = await parseJsonBody(request, createPolicySchema);
  if (payload.error) {
    return payload.error;
  }

  try {
    const { tenantId } = await context.params;

    if (payload.data.tenantId !== tenantId) {
      return jsonError(400, "VALIDATION_ERROR", "Tenant in path and payload must match.");
    }

    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) {
      return jsonNotFound("Tenant");
    }

    const policy = await policyRepository.create(payload.data);
    return jsonMessage("Policy created.", policy, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
