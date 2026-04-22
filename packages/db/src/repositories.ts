import { and, desc, eq, ilike, or } from "drizzle-orm";

import type {
  CreateApplicationInput,
  CreatePolicyInput,
  CreateTenantInput,
  TenantListQuery,
  UpdateApplicationInput,
  UpdatePolicyInput,
  UpdateTenantInput,
  UpsertQuotaInput
} from "@governix/shared";

import { getDb } from "./client";
import { applications, tenantPolicies, tenantQuotas, tenants, users } from "./schema";

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
  async listByTenantId(tenantId: string) {
    return getDb().select().from(applications).where(eq(applications.tenantId, tenantId)).orderBy(desc(applications.createdAt));
  },

  async findById(id: string) {
    const [application] = await getDb().select().from(applications).where(eq(applications.id, id)).limit(1);
    return application ?? null;
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
