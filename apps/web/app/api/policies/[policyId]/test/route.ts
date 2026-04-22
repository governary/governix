import { policyRepository } from "@governix/db";
import { evaluateTenantPolicy } from "@governix/policy-engine";
import { policyTestRequestSchema } from "@governix/shared";

import { handleRouteError, jsonData, jsonNotFound, parseJsonBody, requireSession } from "../../../../../lib/api";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ policyId: string }> }) {
  const auth = await requireSession();
  if (auth.error) {
    return auth.error;
  }

  const payload = await parseJsonBody(request, policyTestRequestSchema);
  if (payload.error) {
    return payload.error;
  }

  try {
    const { policyId } = await context.params;
    const policy = await policyRepository.findById(policyId);

    if (!policy) {
      return jsonNotFound("Policy");
    }

    const result = evaluateTenantPolicy(policy, payload.data);
    return jsonData(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
