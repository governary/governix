import { auditExportRepository } from "@governix/db";

import { jsonError, jsonNotFound, requireSession } from "../../../../../../lib/api";
import { getObjectStorage } from "../../../../../../lib/object-storage";

export const runtime = "nodejs";

export async function GET(_: Request, context: { params: Promise<{ exportId: string }> }) {
  const auth = await requireSession();
  if (auth.error) {
    return auth.error;
  }

  const { exportId } = await context.params;
  const entry = await auditExportRepository.findById(exportId);

  if (!entry) {
    return jsonNotFound("Audit export");
  }

  if (entry.status !== "ready" || !entry.fileUrl) {
    return jsonError(409, "EXPORT_NOT_READY", "The export file is not ready yet.");
  }

  const key = `ledger/${entry.id}.csv`;
  const content = await getObjectStorage().readText(key);

  return new Response(content, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename=\"ledger-${entry.id}.csv\"`
    }
  });
}
