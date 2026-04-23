import { ledgerExportRequestSchema } from "@governix/shared";

import { handleRouteError, jsonMessage, parseJsonBody, requireSession } from "../../../../lib/api";
import { createLedgerExport } from "../../../../lib/ledger";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireSession({ write: true });
  if (auth.error) {
    return auth.error;
  }

  const payload = await parseJsonBody(request, ledgerExportRequestSchema);
  if (payload.error) {
    return payload.error;
  }

  try {
    const exportRecord = await createLedgerExport({
      ...payload.data,
      requestedBy: auth.session.id
    });

    return jsonMessage(
      "Ledger export queued.",
      {
        exportId: exportRecord.id,
        status: exportRecord.status
      },
      { status: 202 }
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
