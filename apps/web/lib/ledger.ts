import "server-only";

import { applicationRepository, auditExportRepository, requestLedgerRepository, tenantRepository } from "@governix/db";
import { ledgerListQuerySchema, type LedgerExportRequest, type LedgerListQuery } from "@governix/shared";

import { getObjectStorage } from "./object-storage";

function escapeCsvCell(value: string | number | null) {
  const text = value === null ? "" : String(value);
  if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
    return `"${text.replaceAll("\"", "\"\"")}"`;
  }

  return text;
}

export async function getLedgerList(query: LedgerListQuery) {
  return requestLedgerRepository.list(ledgerListQuerySchema.parse(query));
}

export async function getLedgerDetail(requestId: string) {
  return requestLedgerRepository.findDetailByRequestId(requestId);
}

export async function getRecentTenantLedger(tenantId: string, limit = 20) {
  return requestLedgerRepository.listRecentByTenantId(tenantId, limit);
}

export function formatLedgerCsv(items: Awaited<ReturnType<typeof requestLedgerRepository.listByDateRange>>) {
  return buildLedgerCsv(
    items.map((item) => ({
      ...item,
      tenantName: item.tenantId,
      applicationName: item.applicationId
    }))
  );
}

type LedgerCsvItem = Awaited<ReturnType<typeof requestLedgerRepository.listByDateRange>>[number] & {
  tenantName: string;
  applicationName: string;
};

function buildLedgerCsv(items: LedgerCsvItem[]) {
  const header = [
    "request_id",
    "tenant_name",
    "application_name",
    "request_type",
    "model_id",
    "kb_id",
    "status",
    "estimated_cost",
    "latency_ms",
    "input_tokens",
    "output_tokens",
    "error_code",
    "error_message",
    "cost_type"
  ];

  const rows = items.map((item) =>
    [
      item.requestId,
      item.tenantName,
      item.applicationName,
      item.requestType,
      item.selectedModelId,
      item.selectedKbId,
      item.status,
      item.estimatedCost,
      item.latencyMs,
      item.inputTokens,
      item.outputTokens,
      item.errorCode,
      item.errorMessage,
      "showback_estimate"
    ]
      .map((value) => escapeCsvCell(value as string | number | null))
      .join(",")
  );

  return [header.join(","), ...rows].join("\n");
}

export async function processLedgerExport(exportId: string) {
  const exportRecord = await auditExportRepository.findById(exportId);
  if (!exportRecord) {
    return;
  }

  try {
    const tenantIds = Array.isArray((exportRecord.tenantScopeJson as Record<string, unknown>).tenantIds)
      ? ((exportRecord.tenantScopeJson as Record<string, unknown>).tenantIds as string[])
      : [];

    const allItems = await Promise.all(
      (tenantIds.length > 0 ? tenantIds : [null]).map((tenantId) =>
        requestLedgerRepository.listByDateRange({
          dateFrom: exportRecord.dateFrom.toISOString().slice(0, 10),
          dateTo: exportRecord.dateTo.toISOString().slice(0, 10),
          tenantId
        })
      )
    );

    const items = allItems.flat();
    const [tenants, applications] = await Promise.all([tenantRepository.listAll(), applicationRepository.listAll()]);
    const tenantMap = new Map(tenants.map((tenant) => [tenant.id, tenant.name]));
    const applicationMap = new Map(applications.map((application) => [application.id, application.name]));
    const csv = buildLedgerCsv(
      items.map((item) => ({
        ...item,
        tenantName: tenantMap.get(item.tenantId) ?? item.tenantId,
        applicationName: applicationMap.get(item.applicationId) ?? item.applicationId
      }))
    );
    const key = `ledger/${exportRecord.id}.csv`;
    await getObjectStorage().uploadText({ key, body: csv });

    await auditExportRepository.update(exportRecord.id, {
      status: "ready",
      fileUrl: `/api/ledger/exports/${exportRecord.id}/download`,
      errorMessage: null
    });
  } catch (error) {
    await auditExportRepository.update(exportId, {
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Export failed."
    });
  }
}

export async function createLedgerExport(input: LedgerExportRequest & { requestedBy: string }) {
  const exportRecord = await auditExportRepository.create({
    requestedBy: input.requestedBy,
    exportType: "ledger",
    tenantScopeJson: { tenantIds: input.tenantIds },
    dateFrom: new Date(input.dateFrom),
    dateTo: new Date(input.dateTo),
    format: input.format,
    status: "pending"
  });

  setTimeout(() => {
    void processLedgerExport(exportRecord.id);
  }, 0);

  return exportRecord;
}
