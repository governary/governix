import { tenantUsageQuerySchema } from "@governix/shared";

import { getTenantUsage } from "../../../../../lib/usage";
import { handleRouteError, jsonData, jsonError, requireSession } from "../../../../../lib/api";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ tenantId: string }> }) {
  const auth = await requireSession();
  if (auth.error) {
    return auth.error;
  }

  const { tenantId } = await context.params;
  const searchParams = new URL(request.url).searchParams;
  const query = tenantUsageQuerySchema.safeParse({
    dateFrom: searchParams.get("date_from") ?? searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("date_to") ?? searchParams.get("dateTo") ?? undefined
  });

  if (!query.success) {
    return jsonError(400, "VALIDATION_ERROR", "Invalid query parameters.", query.error.flatten());
  }

  try {
    const result = await getTenantUsage({
      tenantId,
      dateFrom: query.data.dateFrom,
      dateTo: query.data.dateTo
    });
    return jsonData(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
