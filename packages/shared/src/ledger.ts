import { z } from "zod";

import { ledgerStatusSchema } from "./runtime";

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function getCurrentMonthStartDateString() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

export const ledgerListQuerySchema = z.object({
  tenantId: z.string().uuid().nullable().optional().default(null),
  applicationId: z.string().uuid().nullable().optional().default(null),
  status: z.union([ledgerStatusSchema, z.literal("all")]).default("all"),
  modelId: z.string().trim().nullable().optional().default(null),
  kbId: z.string().trim().nullable().optional().default(null),
  requestId: z.string().trim().nullable().optional().default(null),
  dateFrom: z.string().regex(isoDatePattern, "Expected YYYY-MM-DD date format.").default(getCurrentMonthStartDateString()),
  dateTo: z.string().regex(isoDatePattern, "Expected YYYY-MM-DD date format.").default(getTodayDateString()),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});

export const ledgerExportRequestSchema = z.object({
  tenantIds: z.array(z.string().uuid()).min(1).optional(),
  tenant_ids: z.array(z.string().uuid()).min(1).optional(),
  dateFrom: z.string().datetime().optional(),
  date_from: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
  format: z.literal("csv")
}).transform((value) => ({
  tenantIds: value.tenantIds ?? value.tenant_ids ?? [],
  dateFrom: value.dateFrom ?? value.date_from ?? "",
  dateTo: value.dateTo ?? value.date_to ?? "",
  format: value.format
}));

export type LedgerListQuery = z.infer<typeof ledgerListQuerySchema>;
export type LedgerExportRequest = z.infer<typeof ledgerExportRequestSchema>;
