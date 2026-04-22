import { applicationRepository } from "@governix/db";
import { updateApplicationSchema } from "@governix/shared";

import { handleRouteError, jsonMessage, jsonNotFound, parseJsonBody, requireSession } from "../../../../lib/api";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ applicationId: string }> }) {
  const auth = await requireSession({ write: true });
  if (auth.error) {
    return auth.error;
  }

  const payload = await parseJsonBody(request, updateApplicationSchema);
  if (payload.error) {
    return payload.error;
  }

  try {
    const { applicationId } = await context.params;
    const application = await applicationRepository.update(applicationId, payload.data);

    if (!application) {
      return jsonNotFound("Application");
    }

    return jsonMessage("Application updated.", application);
  } catch (error) {
    return handleRouteError(error);
  }
}
