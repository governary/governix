import { bigint, boolean, date, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const tenants = pgTable("tenants", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  externalKey: text("external_key").unique(),
  status: text("status").notNull().default("active"),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const applications = pgTable(
  "applications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: text("name").notNull(),
    environment: text("environment").notNull(),
    status: text("status").notNull().default("active"),
    apiKeyHash: text("api_key_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    tenantEnvironmentNameIdx: uniqueIndex("applications_tenant_name_environment_idx").on(
      table.tenantId,
      table.name,
      table.environment
    )
  })
);

export const tenantPolicies = pgTable("tenant_policies", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  name: text("name").notNull(),
  allowedKbIdsJson: jsonb("allowed_kb_ids_json").$type<string[]>().notNull().default([]),
  allowedModelIdsJson: jsonb("allowed_model_ids_json").$type<string[]>().notNull().default([]),
  requireCitation: boolean("require_citation").notNull().default(false),
  fallbackModelId: text("fallback_model_id"),
  enabled: boolean("enabled").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const tenantQuotas = pgTable("tenant_quotas", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .unique()
    .references(() => tenants.id),
  requestLimitMonthly: integer("request_limit_monthly"),
  tokenLimitMonthly: bigint("token_limit_monthly", { mode: "number" }),
  costLimitMonthly: numeric("cost_limit_monthly", { precision: 14, scale: 4 }),
  softThresholdPercent: integer("soft_threshold_percent").notNull().default(80),
  hardThresholdPercent: integer("hard_threshold_percent").notNull().default(100),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const requestLedger = pgTable("request_ledger", {
  id: uuid("id").defaultRandom().primaryKey(),
  requestId: text("request_id").notNull().unique(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  applicationId: uuid("application_id")
    .notNull()
    .references(() => applications.id),
  userId: text("user_id"),
  sessionId: text("session_id"),
  requestType: text("request_type").notNull(),
  rawQuerySummary: text("raw_query_summary"),
  selectedModelId: text("selected_model_id"),
  selectedKbId: text("selected_kb_id"),
  policyResultJson: jsonb("policy_result_json").notNull(),
  retrievalFilterJson: jsonb("retrieval_filter_json"),
  retrievedChunksJson: jsonb("retrieved_chunks_json"),
  generationSummaryText: text("generation_summary_text"),
  citationsPresent: boolean("citations_present").notNull().default(false),
  status: text("status").notNull(),
  latencyMs: integer("latency_ms"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  embeddingCount: integer("embedding_count").notNull().default(0),
  estimatedCost: numeric("estimated_cost", { precision: 14, scale: 6 }),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const usageDaily = pgTable(
  "usage_daily",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    applicationId: uuid("application_id").references(() => applications.id),
    usageDate: date("usage_date").notNull(),
    ragRequestCount: integer("rag_request_count").notNull().default(0),
    retrieveCount: integer("retrieve_count").notNull().default(0),
    generateCount: integer("generate_count").notNull().default(0),
    inputTokens: bigint("input_tokens", { mode: "number" }).notNull().default(0),
    outputTokens: bigint("output_tokens", { mode: "number" }).notNull().default(0),
    embeddingCount: bigint("embedding_count", { mode: "number" }).notNull().default(0),
    estimatedCost: numeric("estimated_cost", { precision: 14, scale: 6 }).notNull().default("0"),
    blockedCount: integer("blocked_count").notNull().default(0),
    throttledCount: integer("throttled_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    usageDailyTenantApplicationDateIdx: uniqueIndex("usage_daily_tenant_application_date_idx").on(
      table.tenantId,
      table.applicationId,
      table.usageDate
    )
  })
);

export const policyEvaluationLogs = pgTable("policy_evaluation_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  requestId: text("request_id").notNull(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  matchedPolicyIdsJson: jsonb("matched_policy_ids_json").$type<string[]>().notNull(),
  finalAction: text("final_action").notNull(),
  finalModelId: text("final_model_id"),
  finalKbId: text("final_kb_id"),
  reasonsJson: jsonb("reasons_json").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const auditExports = pgTable("audit_exports", {
  id: uuid("id").defaultRandom().primaryKey(),
  requestedBy: uuid("requested_by")
    .notNull()
    .references(() => users.id),
  exportType: text("export_type").notNull(),
  tenantScopeJson: jsonb("tenant_scope_json").notNull(),
  dateFrom: timestamp("date_from", { withTimezone: true }).notNull(),
  dateTo: timestamp("date_to", { withTimezone: true }).notNull(),
  format: text("format").notNull(),
  status: text("status").notNull(),
  fileUrl: text("file_url"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

