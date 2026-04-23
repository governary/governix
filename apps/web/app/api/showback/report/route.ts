import { showbackReportQuerySchema } from "@governix/shared";

import { formatShowbackCsv, getShowbackReport } from "../../../../lib/usage";
import { handleRouteError, jsonData, jsonError, requireSession } from "../../../../lib/api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireSession();
  if (auth.error) {
    return auth.error;
  }

  const searchParams = new URL(request.url).searchParams;
  const query = showbackReportQuerySchema.safeParse({
    dateFrom: searchParams.get("date_from") ?? searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("date_to") ?? searchParams.get("dateTo") ?? undefined,
    format: searchParams.get("format") ?? undefined,
    tenantId: searchParams.get("tenant_id") ?? searchParams.get("tenantId") ?? undefined
  });

  if (!query.success) {
    return jsonError(400, "VALIDATION_ERROR", "Invalid query parameters.", query.error.flatten());
  }

  try {
    const items = await getShowbackReport(query.data);

    if (query.data.format === "csv") {
      return new Response(formatShowbackCsv(items, query.data), {
        status: 200,
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename=\"showback-${query.data.dateFrom}-${query.data.dateTo}.csv\"`
        }
      });
    }

    return jsonData({
      dateFrom: query.data.dateFrom,
      dateTo: query.data.dateTo,
      items
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
