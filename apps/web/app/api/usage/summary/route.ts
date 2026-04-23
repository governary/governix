import { usageSummaryQuerySchema } from "@governix/shared";

import { getUsageSummary } from "../../../../lib/usage";
import { handleRouteError, jsonData, jsonError, requireSession } from "../../../../lib/api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireSession();
  if (auth.error) {
    return auth.error;
  }

  const searchParams = new URL(request.url).searchParams;
  const query = usageSummaryQuerySchema.safeParse({
    dateFrom: searchParams.get("date_from") ?? searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("date_to") ?? searchParams.get("dateTo") ?? undefined,
    groupBy: searchParams.get("group_by") ?? searchParams.get("groupBy") ?? undefined
  });

  if (!query.success) {
    return jsonError(400, "VALIDATION_ERROR", "Invalid query parameters.", query.error.flatten());
  }

  try {
    const result = await getUsageSummary(query.data);
    return jsonData(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
