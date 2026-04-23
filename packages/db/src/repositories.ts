import { compare } from "bcryptjs";
import { and, count, desc, eq, gte, ilike, inArray, lte, lt, or, sum } from "drizzle-orm";

import type {
  CreateApplicationInput,
  CreatePolicyInput,
  CreateTenantInput,
  LedgerListQuery,
  PolicyEvaluationResult,
  RuntimeEventRequest,
  TenantListQuery,
  UpdateApplicationInput,
  UpdatePolicyInput,
  UpdateTenantInput,
  UpsertQuotaInput
} from "@governix/shared";

import { getDb } from "./client";
import { applications, auditExports, policyEvaluationLogs, requestLedger, tenantPolicies, tenantQuotas, tenants, usageDaily, users } from "./schema";

function getMonthRange(referenceAt: Date) {
  const start = new Date(Date.UTC(referenceAt.getUTCFullYear(), referenceAt.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(referenceAt.getUTCFullYear(), referenceAt.getUTCMonth() + 1, 1, 0, 0, 0, 0));

  return { start, end };
}

function toNumericString(value: number | null | undefined, scale: number) {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return null;
  }

  return value.toFixed(scale);
}

function buildTenantFilters(query: TenantListQuery) {
  const filters = [];

  if (query.search) {
    filters.push(
      or(ilike(tenants.name, `%${query.search}%`), ilike(tenants.externalKey, `%${query.search}%`), ilike(tenants.description, `%${query.search}%`))
    );
  }

  if (query.status !== "all") {
    filters.push(eq(tenants.status, query.status));
  }

  return filters;
}

export const userRepository = {
  async findByEmail(email: string) {
    const [user] = await getDb().select().from(users).where(eq(users.email, email)).limit(1);
    return user ?? null;
  }
};

export const tenantRepository = {
  async list(query: TenantListQuery) {
    const filters = buildTenantFilters(query);
    const whereClause = filters.length > 0 ? and(...filters) : undefined;
    const db = getDb();
    const offset = (query.page - 1) * query.pageSize;

    const [items, allMatching] = await Promise.all([
      db.select().from(tenants).where(whereClause).orderBy(desc(tenants.createdAt)).limit(query.pageSize).offset(offset),
      db.select({ id: tenants.id }).from(tenants).where(whereClause)
    ]);

    return {
      items,
      total: allMatching.length,
      page: query.page,
      pageSize: query.pageSize
    };
  },

  async listAll() {
    return getDb().select().from(tenants).orderBy(desc(tenants.createdAt));
  },

  async findById(id: string) {
    const [tenant] = await getDb().select().from(tenants).where(eq(tenants.id, id)).limit(1);
    return tenant ?? null;
  },

  async create(input: CreateTenantInput) {
    const [tenant] = await getDb()
      .insert(tenants)
      .values({
        name: input.name,
        externalKey: input.externalKey,
        status: input.status,
        description: input.description
      })
      .returning();

    return tenant;
  },

  async update(id: string, input: UpdateTenantInput) {
    const [tenant] = await getDb()
      .update(tenants)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.externalKey !== undefined ? { externalKey: input.externalKey } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        updatedAt: new Date()
      })
      .where(eq(tenants.id, id))
      .returning();

    return tenant ?? null;
  }
};

export const applicationRepository = {
  async listAll() {
    return getDb().select().from(applications).orderBy(desc(applications.createdAt));
  },

  async listByTenantId(tenantId: string) {
    return getDb().select().from(applications).where(eq(applications.tenantId, tenantId)).orderBy(desc(applications.createdAt));
  },

  async listByIds(ids: string[]) {
    if (ids.length === 0) {
      return [];
    }

    return getDb().select().from(applications).where(inArray(applications.id, ids)).orderBy(desc(applications.createdAt));
  },

  async findById(id: string) {
    const [application] = await getDb().select().from(applications).where(eq(applications.id, id)).limit(1);
    return application ?? null;
  },

  async findAuthorizedRuntimeApplication(id: string, plaintextApiKey: string) {
    const application = await this.findById(id);

    if (!application || application.status !== "active") {
      return null;
    }

    const isMatch = await compare(plaintextApiKey, application.apiKeyHash);
    return isMatch ? application : null;
  },

  async create(tenantId: string, input: CreateApplicationInput, apiKeyHash: string) {
    const [application] = await getDb()
      .insert(applications)
      .values({
        tenantId,
        name: input.name,
        environment: input.environment,
        status: input.status,
        apiKeyHash
      })
      .returning();

    return application;
  },

  async update(id: string, input: UpdateApplicationInput) {
    const [application] = await getDb()
      .update(applications)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.environment !== undefined ? { environment: input.environment } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        updatedAt: new Date()
      })
      .where(eq(applications.id, id))
      .returning();

    return application ?? null;
  },

  async rotateKey(id: string, apiKeyHash: string) {
    const [application] = await getDb()
      .update(applications)
      .set({
        apiKeyHash,
        updatedAt: new Date()
      })
      .where(eq(applications.id, id))
      .returning();

    return application ?? null;
  }
};

export const policyRepository = {
  async listAll() {
    return getDb()
      .select({
        id: tenantPolicies.id,
        tenantId: tenantPolicies.tenantId,
        tenantName: tenants.name,
        name: tenantPolicies.name,
        allowedKbIdsJson: tenantPolicies.allowedKbIdsJson,
        allowedModelIdsJson: tenantPolicies.allowedModelIdsJson,
        requireCitation: tenantPolicies.requireCitation,
        fallbackModelId: tenantPolicies.fallbackModelId,
        enabled: tenantPolicies.enabled,
        notes: tenantPolicies.notes,
        createdAt: tenantPolicies.createdAt,
        updatedAt: tenantPolicies.updatedAt
      })
      .from(tenantPolicies)
      .innerJoin(tenants, eq(tenantPolicies.tenantId, tenants.id))
      .orderBy(desc(tenantPolicies.createdAt));
  },

  async listByTenantId(tenantId: string) {
    return getDb()
      .select()
      .from(tenantPolicies)
      .where(eq(tenantPolicies.tenantId, tenantId))
      .orderBy(desc(tenantPolicies.createdAt));
  },

  async findById(id: string) {
    const [policy] = await getDb().select().from(tenantPolicies).where(eq(tenantPolicies.id, id)).limit(1);
    return policy ?? null;
  },

  async findLatestEnabledByTenantId(tenantId: string) {
    const [policy] = await getDb()
      .select()
      .from(tenantPolicies)
      .where(and(eq(tenantPolicies.tenantId, tenantId), eq(tenantPolicies.enabled, true)))
      .orderBy(desc(tenantPolicies.createdAt))
      .limit(1);

    return policy ?? null;
  },

  async listEnabledByTenantId(tenantId: string) {
    return getDb()
      .select()
      .from(tenantPolicies)
      .where(and(eq(tenantPolicies.tenantId, tenantId), eq(tenantPolicies.enabled, true)))
      .orderBy(desc(tenantPolicies.createdAt));
  },

  async create(input: CreatePolicyInput) {
    const [policy] = await getDb()
      .insert(tenantPolicies)
      .values({
        tenantId: input.tenantId,
        name: input.name,
        allowedKbIdsJson: input.allowedKbIds,
        allowedModelIdsJson: input.allowedModelIds,
        requireCitation: input.requireCitation,
        fallbackModelId: input.fallbackModelId,
        enabled: input.enabled,
        notes: input.notes
      })
      .returning();

    return policy;
  },

  async update(id: string, input: UpdatePolicyInput) {
    const [policy] = await getDb()
      .update(tenantPolicies)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.allowedKbIds !== undefined ? { allowedKbIdsJson: input.allowedKbIds } : {}),
        ...(input.allowedModelIds !== undefined ? { allowedModelIdsJson: input.allowedModelIds } : {}),
        ...(input.requireCitation !== undefined ? { requireCitation: input.requireCitation } : {}),
        ...(input.fallbackModelId !== undefined ? { fallbackModelId: input.fallbackModelId } : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        updatedAt: new Date()
      })
      .where(eq(tenantPolicies.id, id))
      .returning();

    return policy ?? null;
  }
};

export const quotaRepository = {
  async findByTenantId(tenantId: string) {
    const [quota] = await getDb().select().from(tenantQuotas).where(eq(tenantQuotas.tenantId, tenantId)).limit(1);
    return quota ?? null;
  },

  async upsertByTenantId(tenantId: string, input: UpsertQuotaInput) {
    const [quota] = await getDb()
      .insert(tenantQuotas)
      .values({
        tenantId,
        requestLimitMonthly: input.requestLimitMonthly,
        tokenLimitMonthly: input.tokenLimitMonthly,
        costLimitMonthly: input.costLimitMonthly,
        softThresholdPercent: input.softThresholdPercent,
        hardThresholdPercent: input.hardThresholdPercent
      })
      .onConflictDoUpdate({
        target: tenantQuotas.tenantId,
        set: {
          requestLimitMonthly: input.requestLimitMonthly,
          tokenLimitMonthly: input.tokenLimitMonthly,
          costLimitMonthly: input.costLimitMonthly,
          softThresholdPercent: input.softThresholdPercent,
          hardThresholdPercent: input.hardThresholdPercent,
          updatedAt: new Date()
        }
      })
      .returning();

    return quota;
  }
};

export const runtimeUsageRepository = {
  async getCurrentMonthSnapshot(tenantId: string, referenceAt = new Date()) {
    const { start, end } = getMonthRange(referenceAt);
    const [snapshot] = await getDb()
      .select({
        requestCount: count(requestLedger.id),
        inputTokens: sum(requestLedger.inputTokens),
        outputTokens: sum(requestLedger.outputTokens),
        estimatedCost: sum(requestLedger.estimatedCost)
      })
      .from(requestLedger)
      .where(and(eq(requestLedger.tenantId, tenantId), gte(requestLedger.createdAt, start), lt(requestLedger.createdAt, end)));

    return {
      requestCount: Number(snapshot?.requestCount ?? 0),
      inputTokens: Number(snapshot?.inputTokens ?? 0),
      outputTokens: Number(snapshot?.outputTokens ?? 0),
      estimatedCost: Number(snapshot?.estimatedCost ?? 0)
    };
  }
};

export const requestLedgerRepository = {
  async create(input: RuntimeEventRequest, executor?: ReturnType<typeof getDb>) {
    const db = executor ?? getDb();
    const createdAt = new Date(input.timestamp);
    const [entry] = await db
      .insert(requestLedger)
      .values({
        requestId: input.requestId,
        tenantId: input.tenant.tenantId,
        applicationId: input.application.applicationId,
        userId: input.tenant.userId,
        sessionId: input.tenant.sessionId,
        requestType: input.request.requestType,
        rawQuerySummary: input.request.rawQuerySummary,
        selectedModelId: input.policy.finalModelId ?? input.request.modelId,
        selectedKbId: input.policy.finalKbId ?? input.request.kbId,
        policyResultJson: input.policy satisfies PolicyEvaluationResult,
        retrievalFilterJson: input.policy.retrievalFilter ?? null,
        retrievedChunksJson: input.retrieval.chunkRefs,
        generationSummaryText: input.generation.summary,
        citationsPresent: input.generation.citationsPresent,
        status: input.generation.status,
        latencyMs: input.generation.latencyMs,
        inputTokens: input.generation.inputTokens,
        outputTokens: input.generation.outputTokens,
        embeddingCount: input.generation.embeddingCount ?? 0,
        estimatedCost: toNumericString(input.generation.estimatedCost, 6),
        errorCode: input.error?.code ?? null,
        errorMessage: input.error?.message ?? null,
        createdAt
      })
      .returning();

    return entry;
  },

  async findByRequestId(requestId: string) {
    const [entry] = await getDb().select().from(requestLedger).where(eq(requestLedger.requestId, requestId)).limit(1);
    return entry ?? null;
  },

  async listByDateRange(input: { dateFrom: string; dateTo: string; tenantId?: string | null }) {
    const start = new Date(`${input.dateFrom}T00:00:00Z`);
    const end = new Date(`${input.dateTo}T23:59:59.999Z`);
    const filters = [gte(requestLedger.createdAt, start), lte(requestLedger.createdAt, end)];

    if (input.tenantId) {
      filters.push(eq(requestLedger.tenantId, input.tenantId));
    }

    return getDb()
      .select()
      .from(requestLedger)
      .where(and(...filters))
      .orderBy(desc(requestLedger.createdAt));
  },

  async list(query: LedgerListQuery) {
    const filters = [
      gte(requestLedger.createdAt, new Date(`${query.dateFrom}T00:00:00Z`)),
      lte(requestLedger.createdAt, new Date(`${query.dateTo}T23:59:59.999Z`))
    ];

    if (query.tenantId) {
      filters.push(eq(requestLedger.tenantId, query.tenantId));
    }

    if (query.applicationId) {
      filters.push(eq(requestLedger.applicationId, query.applicationId));
    }

    if (query.status !== "all") {
      filters.push(eq(requestLedger.status, query.status));
    }

    if (query.modelId) {
      filters.push(eq(requestLedger.selectedModelId, query.modelId));
    }

    if (query.kbId) {
      filters.push(eq(requestLedger.selectedKbId, query.kbId));
    }

    if (query.requestId) {
      filters.push(eq(requestLedger.requestId, query.requestId));
    }

    const whereClause = and(...filters);
    const offset = (query.page - 1) * query.pageSize;
    const db = getDb();

    const [items, totalRows] = await Promise.all([
      db
        .select({
          id: requestLedger.id,
          requestId: requestLedger.requestId,
          tenantId: requestLedger.tenantId,
          tenantName: tenants.name,
          applicationId: requestLedger.applicationId,
          applicationName: applications.name,
          requestType: requestLedger.requestType,
          selectedModelId: requestLedger.selectedModelId,
          selectedKbId: requestLedger.selectedKbId,
          status: requestLedger.status,
          estimatedCost: requestLedger.estimatedCost,
          latencyMs: requestLedger.latencyMs,
          createdAt: requestLedger.createdAt
        })
        .from(requestLedger)
        .innerJoin(tenants, eq(requestLedger.tenantId, tenants.id))
        .innerJoin(applications, eq(requestLedger.applicationId, applications.id))
        .where(whereClause)
        .orderBy(desc(requestLedger.createdAt))
        .limit(query.pageSize)
        .offset(offset),
      db.select({ id: requestLedger.id }).from(requestLedger).where(whereClause)
    ]);

    return {
      items,
      total: totalRows.length,
      page: query.page,
      pageSize: query.pageSize
    };
  },

  async findDetailByRequestId(requestId: string) {
    const [entry] = await getDb()
      .select({
        id: requestLedger.id,
        requestId: requestLedger.requestId,
        tenantId: requestLedger.tenantId,
        tenantName: tenants.name,
        applicationId: requestLedger.applicationId,
        applicationName: applications.name,
        userId: requestLedger.userId,
        sessionId: requestLedger.sessionId,
        requestType: requestLedger.requestType,
        rawQuerySummary: requestLedger.rawQuerySummary,
        selectedModelId: requestLedger.selectedModelId,
        selectedKbId: requestLedger.selectedKbId,
        policyResultJson: requestLedger.policyResultJson,
        retrievalFilterJson: requestLedger.retrievalFilterJson,
        retrievedChunksJson: requestLedger.retrievedChunksJson,
        generationSummaryText: requestLedger.generationSummaryText,
        citationsPresent: requestLedger.citationsPresent,
        status: requestLedger.status,
        latencyMs: requestLedger.latencyMs,
        inputTokens: requestLedger.inputTokens,
        outputTokens: requestLedger.outputTokens,
        embeddingCount: requestLedger.embeddingCount,
        estimatedCost: requestLedger.estimatedCost,
        errorCode: requestLedger.errorCode,
        errorMessage: requestLedger.errorMessage,
        createdAt: requestLedger.createdAt
      })
      .from(requestLedger)
      .innerJoin(tenants, eq(requestLedger.tenantId, tenants.id))
      .innerJoin(applications, eq(requestLedger.applicationId, applications.id))
      .where(eq(requestLedger.requestId, requestId))
      .limit(1);

    return entry ?? null;
  },

  async listRecentByTenantId(tenantId: string, limit = 20) {
    return getDb()
      .select({
        requestId: requestLedger.requestId,
        applicationId: requestLedger.applicationId,
        applicationName: applications.name,
        requestType: requestLedger.requestType,
        selectedModelId: requestLedger.selectedModelId,
        selectedKbId: requestLedger.selectedKbId,
        status: requestLedger.status,
        estimatedCost: requestLedger.estimatedCost,
        latencyMs: requestLedger.latencyMs,
        createdAt: requestLedger.createdAt
      })
      .from(requestLedger)
      .innerJoin(applications, eq(requestLedger.applicationId, applications.id))
      .where(eq(requestLedger.tenantId, tenantId))
      .orderBy(desc(requestLedger.createdAt))
      .limit(limit);
  }
};

export const policyEvaluationLogRepository = {
  async create(input: RuntimeEventRequest, executor?: ReturnType<typeof getDb>) {
    const db = executor ?? getDb();
    const createdAt = new Date(input.timestamp);
    const [log] = await db
      .insert(policyEvaluationLogs)
      .values({
        requestId: input.requestId,
        tenantId: input.tenant.tenantId,
        matchedPolicyIdsJson: input.policy.matchedPolicyIds,
        finalAction: input.policy.finalAction,
        finalModelId: input.policy.finalModelId ?? null,
        finalKbId: input.policy.finalKbId ?? null,
        reasonsJson: input.policy.reasons,
        createdAt
      })
      .returning();

    return log;
  },

  async findByRequestId(requestId: string) {
    const [log] = await getDb().select().from(policyEvaluationLogs).where(eq(policyEvaluationLogs.requestId, requestId)).limit(1);
    return log ?? null;
  }
};

export const usageDailyRepository = {
  async replaceAggregateRow(
    row: {
      tenantId: string;
      applicationId: string | null;
      usageDate: string;
      ragRequestCount: number;
      retrieveCount: number;
      generateCount: number;
      inputTokens: number;
      outputTokens: number;
      embeddingCount: number;
      estimatedCost: string;
      blockedCount: number;
      throttledCount: number;
    }
  ) {
    const [result] = await getDb()
      .insert(usageDaily)
      .values(row)
      .onConflictDoUpdate({
        target: [usageDaily.tenantId, usageDaily.applicationId, usageDaily.usageDate],
        set: {
          ragRequestCount: row.ragRequestCount,
          retrieveCount: row.retrieveCount,
          generateCount: row.generateCount,
          inputTokens: row.inputTokens,
          outputTokens: row.outputTokens,
          embeddingCount: row.embeddingCount,
          estimatedCost: row.estimatedCost,
          blockedCount: row.blockedCount,
          throttledCount: row.throttledCount,
          updatedAt: new Date()
        }
      })
      .returning();

    return result;
  },

  async listByDateRange(input: { dateFrom: string; dateTo: string; tenantId?: string | null }) {
    const filters = [gte(usageDaily.usageDate, input.dateFrom), lte(usageDaily.usageDate, input.dateTo)];

    if (input.tenantId) {
      filters.push(eq(usageDaily.tenantId, input.tenantId));
    }

    return getDb()
      .select()
      .from(usageDaily)
      .where(and(...filters))
      .orderBy(desc(usageDaily.usageDate));
  }
};

export const auditExportRepository = {
  async create(input: {
    requestedBy: string;
    exportType: string;
    tenantScopeJson: Record<string, unknown>;
    dateFrom: Date;
    dateTo: Date;
    format: string;
    status: string;
  }) {
    const [entry] = await getDb()
      .insert(auditExports)
      .values(input)
      .returning();

    return entry;
  },

  async findById(id: string) {
    const [entry] = await getDb().select().from(auditExports).where(eq(auditExports.id, id)).limit(1);
    return entry ?? null;
  },

  async update(id: string, input: { status?: string; fileUrl?: string | null; errorMessage?: string | null }) {
    const [entry] = await getDb()
      .update(auditExports)
      .set({
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.fileUrl !== undefined ? { fileUrl: input.fileUrl } : {}),
        ...(input.errorMessage !== undefined ? { errorMessage: input.errorMessage } : {}),
        updatedAt: new Date()
      })
      .where(eq(auditExports.id, id))
      .returning();

    return entry ?? null;
  }
};
