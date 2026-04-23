import { policyRepository, quotaRepository, runtimeUsageRepository } from "@governix/db";
import { evaluateRuntimePolicy } from "@governix/policy-engine";
import { runtimeEvaluateRequestSchema } from "@governix/shared";

import { handleRouteError, jsonData, parseJsonBody } from "../../../../../lib/api";
import { requireRuntimeApplicationAccess } from "../../../../../lib/runtime-api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = await parseJsonBody(request, runtimeEvaluateRequestSchema);
  if (payload.error) {
    return payload.error;
  }

  const auth = await requireRuntimeApplicationAccess(
    request,
    payload.data.application.applicationId,
    payload.data.tenant.tenantId
  );
  if (auth.error) {
    return auth.error;
  }

  try {
    const [policy, quota, usage] = await Promise.all([
      policyRepository.listEnabledByTenantId(payload.data.tenant.tenantId),
      quotaRepository.findByTenantId(payload.data.tenant.tenantId),
      runtimeUsageRepository.getCurrentMonthSnapshot(payload.data.tenant.tenantId)
    ]);

    const result = evaluateRuntimePolicy({
      policies: policy,
      quota,
      usage,
      request: payload.data.request
    });

    return jsonData(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
