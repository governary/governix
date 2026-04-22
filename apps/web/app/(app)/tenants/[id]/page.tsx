import { TenantDetailClient } from "../../../../components/admin/tenant-detail-client";

type SearchParams = {
  tab?: string;
};

export default async function TenantDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ id }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const tab = resolvedSearchParams.tab;
  const initialTab = tab === "applications" || tab === "quota" || tab === "policy" ? tab : "overview";

  return <TenantDetailClient tenantId={id} initialTab={initialTab} />;
}
