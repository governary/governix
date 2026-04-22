import { applicationRepository } from "@governix/db";

import { createApiKeyHashPair } from "../../../../../lib/api-keys";
import { handleRouteError, jsonMessage, jsonNotFound, requireSession } from "../../../../../lib/api";

export const runtime = "nodejs";

export async function POST(_: Request, context: { params: Promise<{ applicationId: string }> }) {
  const auth = await requireSession({ write: true });
  if (auth.error) {
    return auth.error;
  }

  try {
    const { applicationId } = await context.params;
    const apiKey = await createApiKeyHashPair();
    const application = await applicationRepository.rotateKey(applicationId, apiKey.hashed);

    if (!application) {
      return jsonNotFound("Application");
    }

    return jsonMessage("API key rotated.", { application, apiKey: apiKey.plaintext });
  } catch (error) {
    return handleRouteError(error);
  }
}
