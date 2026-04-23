import { policyEvaluationLogRepository, requestLedgerRepository, withTransaction } from "@governix/db";
import { runtimeEventRequestSchema } from "@governix/shared";

import { handleRouteError, jsonMessage, parseJsonBody } from "../../../../lib/api";
import { requireRuntimeApplicationAccess } from "../../../../lib/runtime-api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = await parseJsonBody(request, runtimeEventRequestSchema);
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
    await withTransaction(async (tx) => {
      await requestLedgerRepository.create(payload.data, tx);
      await policyEvaluationLogRepository.create(payload.data, tx);
    });

    return jsonMessage(
      "Runtime event accepted.",
      {
        accepted: true,
        requestId: payload.data.requestId
      },
      { status: 201 }
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
