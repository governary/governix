import { z } from "zod";

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function getCurrentMonthStartDateString() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

export const usageGroupBySchema = z.enum(["tenant", "application", "model"]);
export const alertStateSchema = z.enum(["normal", "warning", "hard_limit"]);
export const showbackFormatSchema = z.enum(["csv", "json"]);
export const isoDateSchema = z.string().regex(isoDatePattern, "Expected YYYY-MM-DD date format.");

export const usageSummaryQuerySchema = z.object({
  dateFrom: isoDateSchema.default(getCurrentMonthStartDateString()),
  dateTo: isoDateSchema.default(getTodayDateString()),
  groupBy: usageGroupBySchema.default("tenant")
});

export const tenantUsageQuerySchema = z.object({
  dateFrom: isoDateSchema.default(getCurrentMonthStartDateString()),
  dateTo: isoDateSchema.default(getTodayDateString())
});

export const showbackReportQuerySchema = z.object({
  dateFrom: isoDateSchema.default(getCurrentMonthStartDateString()),
  dateTo: isoDateSchema.default(getTodayDateString()),
  format: showbackFormatSchema.default("json"),
  tenantId: z.string().uuid().nullable().optional().default(null)
});

export type UsageGroupBy = z.infer<typeof usageGroupBySchema>;
export type AlertState = z.infer<typeof alertStateSchema>;
export type UsageSummaryQuery = z.infer<typeof usageSummaryQuerySchema>;
export type TenantUsageQuery = z.infer<typeof tenantUsageQuerySchema>;
export type ShowbackReportQuery = z.infer<typeof showbackReportQuerySchema>;
