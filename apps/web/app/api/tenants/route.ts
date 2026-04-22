import { tenantRepository } from "@governix/db";
import { createTenantSchema, tenantListQuerySchema } from "@governix/shared";

import { handleRouteError, jsonData, jsonMessage, parseJsonBody, parseSearchParams, requireSession } from "../../../lib/api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireSession();
  if (auth.error) {
    return auth.error;
  }

  const query = parseSearchParams(new URL(request.url).searchParams, tenantListQuerySchema);
  if (query.error) {
    return query.error;
  }

  try {
    const result = await tenantRepository.list(query.data);
    return jsonData(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  const auth = await requireSession({ write: true });
  if (auth.error) {
    return auth.error;
  }

  const payload = await parseJsonBody(request, createTenantSchema);
  if (payload.error) {
    return payload.error;
  }

  try {
    const tenant = await tenantRepository.create(payload.data);
    return jsonMessage("Tenant created.", tenant, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
