import { ledgerListQuerySchema } from "@governix/shared";

import { handleRouteError, jsonData, jsonError, requireSession } from "../../../lib/api";
import { getLedgerList } from "../../../lib/ledger";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireSession();
  if (auth.error) {
    return auth.error;
  }

  const params = new URL(request.url).searchParams;
  const query = ledgerListQuerySchema.safeParse({
    tenantId: params.get("tenant_id") ?? params.get("tenantId") ?? undefined,
    applicationId: params.get("application_id") ?? params.get("applicationId") ?? undefined,
    status: params.get("status") ?? undefined,
    modelId: params.get("model_id") ?? params.get("modelId") ?? undefined,
    kbId: params.get("kb_id") ?? params.get("kbId") ?? undefined,
    requestId: params.get("request_id") ?? params.get("requestId") ?? undefined,
    dateFrom: params.get("date_from") ?? params.get("dateFrom") ?? undefined,
    dateTo: params.get("date_to") ?? params.get("dateTo") ?? undefined,
    page: params.get("page") ?? undefined,
    pageSize: params.get("page_size") ?? params.get("pageSize") ?? undefined
  });

  if (!query.success) {
    return jsonError(400, "VALIDATION_ERROR", "Invalid query parameters.", query.error.flatten());
  }

  try {
    const result = await getLedgerList(query.data);
    return jsonData(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
