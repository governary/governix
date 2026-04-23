import { auditExportRepository } from "@governix/db";

import { handleRouteError, jsonData, jsonNotFound, requireSession } from "../../../../../lib/api";

export const runtime = "nodejs";

export async function GET(_: Request, context: { params: Promise<{ exportId: string }> }) {
  const auth = await requireSession();
  if (auth.error) {
    return auth.error;
  }

  try {
    const { exportId } = await context.params;
    const entry = await auditExportRepository.findById(exportId);

    if (!entry) {
      return jsonNotFound("Audit export");
    }

    return jsonData(entry);
  } catch (error) {
    return handleRouteError(error);
  }
}
