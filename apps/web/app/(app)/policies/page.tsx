import { policyRepository, tenantRepository } from "@governix/db";

import { PoliciesPageClient } from "../../../components/admin/policies-page-client";

type SearchParams = {
  tenantId?: string;
};

export default async function PoliciesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [tenants, policies, resolvedSearchParams] = await Promise.all([
    tenantRepository.listAll(),
    policyRepository.listAll(),
    searchParams
  ]);

  return (
    <PoliciesPageClient
      initialTenants={tenants.map((tenant) => ({ id: tenant.id, name: tenant.name }))}
      initialPolicies={policies.map((policy) => ({
        ...policy,
        createdAt: policy.createdAt.toISOString(),
        updatedAt: policy.updatedAt.toISOString()
      }))}
      initialTenantId={resolvedSearchParams.tenantId ?? null}
    />
  );
}
