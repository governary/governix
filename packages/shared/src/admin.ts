import { z } from "zod";

export const tenantStatusSchema = z.enum(["active", "paused", "archived"]);
export const applicationEnvironmentSchema = z.enum(["dev", "staging", "prod"]);
export const applicationStatusSchema = z.enum(["active", "disabled", "archived"]);
export const requestTypeSchema = z.enum(["retrieve", "retrieve_and_generate", "generate"]);

const optionalNullableNumber = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return typeof value === "number" ? value : Number(value);
}, z.number().finite().nullable());

const optionalNullableString = z.union([z.string(), z.null()]).optional().transform((value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
});

const csvArraySchema = z
  .union([z.array(z.string()), z.string(), z.undefined()])
  .transform((value) => {
    if (Array.isArray(value)) {
      return value.map((item) => item.trim()).filter(Boolean);
    }

    if (!value) {
      return [];
    }

    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  });

export const tenantListQuerySchema = z.object({
  search: z.string().trim().default(""),
  status: z.union([tenantStatusSchema, z.literal("all")]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10)
});

export const createTenantSchema = z.object({
  name: z.string().trim().min(1).max(120),
  externalKey: optionalNullableString,
  status: tenantStatusSchema.default("active"),
  description: optionalNullableString
});

export const updateTenantSchema = createTenantSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "At least one field is required."
});

export const createApplicationSchema = z.object({
  name: z.string().trim().min(1).max(120),
  environment: applicationEnvironmentSchema,
  status: applicationStatusSchema.default("active")
});

export const updateApplicationSchema = createApplicationSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "At least one field is required."
});

export const createPolicySchema = z.object({
  tenantId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  allowedKbIds: csvArraySchema,
  allowedModelIds: csvArraySchema,
  requireCitation: z.coerce.boolean().default(false),
  fallbackModelId: optionalNullableString,
  enabled: z.coerce.boolean().default(true),
  notes: optionalNullableString
});

export const updatePolicySchema = createPolicySchema.omit({ tenantId: true }).partial().refine((value) => Object.keys(value).length > 0, {
  message: "At least one field is required."
});

export const policyTestRequestSchema = z.object({
  kbId: optionalNullableString,
  modelId: optionalNullableString,
  requestType: requestTypeSchema
});

export const upsertQuotaSchema = z
  .object({
    requestLimitMonthly: optionalNullableNumber,
    tokenLimitMonthly: optionalNullableNumber,
    costLimitMonthly: optionalNullableString,
    softThresholdPercent: z.coerce.number().int().min(1).max(100),
    hardThresholdPercent: z.coerce.number().int().min(1).max(100)
  })
  .refine((value) => value.softThresholdPercent <= value.hardThresholdPercent, {
    message: "Soft threshold must be less than or equal to hard threshold.",
    path: ["softThresholdPercent"]
  });

export const policyEvaluationResultSchema = z.object({
  matchedPolicyIds: z.array(z.string()),
  finalAction: z.enum(["allow", "deny", "force_filter", "downgrade_model", "quota_block"]),
  finalModelId: z.string().nullable().optional(),
  finalKbId: z.string().nullable().optional(),
  retrievalFilter: z.record(z.unknown()).nullable().optional(),
  reasons: z.array(z.string())
});

export type TenantListQuery = z.infer<typeof tenantListQuerySchema>;
export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>;
export type CreatePolicyInput = z.infer<typeof createPolicySchema>;
export type UpdatePolicyInput = z.infer<typeof updatePolicySchema>;
export type PolicyTestRequest = z.infer<typeof policyTestRequestSchema>;
export type UpsertQuotaInput = z.infer<typeof upsertQuotaSchema>;
export type PolicyEvaluationResult = z.infer<typeof policyEvaluationResultSchema>;
