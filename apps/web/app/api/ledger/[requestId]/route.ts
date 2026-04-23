import { handleRouteError, jsonData, jsonNotFound, requireSession } from "../../../../lib/api";
import { getLedgerDetail } from "../../../../lib/ledger";

export const runtime = "nodejs";

export async function GET(_: Request, context: { params: Promise<{ requestId: string }> }) {
  const auth = await requireSession();
  if (auth.error) {
    return auth.error;
  }

  try {
    const { requestId } = await context.params;
    const entry = await getLedgerDetail(requestId);

    if (!entry) {
      return jsonNotFound("Ledger entry");
    }

    return jsonData(entry);
  } catch (error) {
    return handleRouteError(error);
  }
}
