import { policyRepository } from "@governix/db";
import { updatePolicySchema } from "@governix/shared";

import { handleRouteError, jsonMessage, jsonNotFound, parseJsonBody, requireSession } from "../../../../lib/api";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ policyId: string }> }) {
  const auth = await requireSession({ write: true });
  if (auth.error) {
    return auth.error;
  }

  const payload = await parseJsonBody(request, updatePolicySchema);
  if (payload.error) {
    return payload.error;
  }

  try {
    const { policyId } = await context.params;
    const policy = await policyRepository.update(policyId, payload.data);

    if (!policy) {
      return jsonNotFound("Policy");
    }

    return jsonMessage("Policy updated.", policy);
  } catch (error) {
    return handleRouteError(error);
  }
}
