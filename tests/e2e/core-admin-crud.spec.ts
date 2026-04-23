import { expect, test } from "@playwright/test";

import { loginAsSeedAdmin } from "../fixtures/auth";

const ACME_TENANT_ID = "22222222-2222-2222-2222-222222222221";

test("tenant api list and tenant UI support create, search, and update", async ({ page }) => {
  await loginAsSeedAdmin(page);

  const listResponse = await page.request.get("/api/tenants?search=Acme&status=active&page=1&page_size=10");
  expect(listResponse.ok()).toBeTruthy();

  const listPayload = (await listResponse.json()) as {
    data: {
      items: Array<{ name: string }>;
      total: number;
    };
  };

  expect(listPayload.data.total).toBeGreaterThan(0);
  expect(listPayload.data.items.some((tenant) => tenant.name === "Acme Corp")).toBeTruthy();

  const suffix = Date.now();
  const tenantName = `Spec Tenant ${suffix}`;
  const externalKey = `spec-tenant-${suffix}`;

  await page.goto("/tenants");

  await page.getByLabel("Tenant name").fill(tenantName);
  await page.getByLabel("External key").fill(externalKey);
  await page.getByLabel("Tenant status").selectOption("active");
  await page.getByLabel("Tenant description").fill("Created from Playwright");
  await page.getByRole("button", { name: "Create tenant" }).click();

  await expect(page.getByText("Tenant created.")).toBeVisible();
  await expect(page.getByRole("link", { name: tenantName })).toBeVisible();

  await page.getByPlaceholder("Search tenants").fill(tenantName);
  await expect(page.getByRole("link", { name: tenantName })).toBeVisible();
  await page.getByRole("link", { name: tenantName }).click();

  await expect(page).toHaveURL(/\/tenants\/[^/?]+/);

  await page.getByLabel("Tenant name").fill(`${tenantName} Updated`);
  await page.getByLabel("Tenant status").selectOption("paused");
  await page.getByLabel("Tenant description").fill("Updated from Playwright");
  await page.getByRole("button", { name: "Save tenant" }).click();

  await expect(page.getByText("Tenant updated.")).toBeVisible();
  await expect(page.getByLabel("Tenant status")).toHaveValue("paused");
});

test("tenant applications support create, rotate key, and disable flows", async ({ page }) => {
  await loginAsSeedAdmin(page);

  const suffix = Date.now();
  const appName = `playwright-app-${suffix}`;

  await page.goto(`/tenants/${ACME_TENANT_ID}?tab=applications`);

  await page.getByLabel("Application name").fill(appName);
  await page.getByLabel("Environment").selectOption("staging");
  await page.getByLabel("Application status").selectOption("active");
  await page.getByRole("button", { name: "Create application" }).click();

  await expect(page.getByText("Application created.")).toBeVisible();
  await expect(page.getByText("Plaintext API key")).toBeVisible();
  await expect(page.getByText(/govx_/)).toBeVisible();

  const row = page.getByRole("row", { name: new RegExp(appName) });
  page.once("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: "Rotate key" }).click();

  await expect(page.getByText("API key rotated.")).toBeVisible();
  await expect(page.getByText(/govx_/)).toBeVisible();

  await row.getByLabel("Row status").selectOption("disabled");
  await row.getByRole("button", { name: "Save application" }).click();

  await expect(page.getByText("Application updated.")).toBeVisible();
  await expect(row.getByLabel("Row status")).toHaveValue("disabled");
});

test("policy management and quota editing work across policy and tenant detail pages", async ({ page }) => {
  await loginAsSeedAdmin(page);

  const suffix = Date.now();
  const policyName = `Acme Policy ${suffix}`;

  await page.goto("/policies");

  await page.getByLabel("Tenant").selectOption(ACME_TENANT_ID);
  await page.getByLabel("Policy name").fill(policyName);
  await page.getByLabel("Allowed KB IDs").fill("kb-acme,kb-shared");
  await page.getByLabel("Allowed model IDs").fill("claude-sonnet");
  await page.getByLabel("Fallback model ID").fill("claude-haiku");
  await page.getByLabel("Require citation").check();
  await page.getByLabel("Notes").fill("Created from Playwright");
  await page.getByRole("button", { name: "Create policy" }).click();

  await expect(page.getByText("Policy created.")).toBeVisible();
  await expect(page.getByRole("row", { name: new RegExp(policyName) })).toBeVisible();

  const policyRow = page.getByRole("row", { name: new RegExp(policyName) });
  await policyRow.getByRole("button", { name: "Edit policy" }).click();

  await page.getByLabel("Allowed model IDs").fill("claude-sonnet,claude-opus");
  await page.getByRole("button", { name: "Save policy" }).click();

  await expect(page.getByText("Policy updated.")).toBeVisible();

  await page.getByLabel("Policy under test").selectOption({ label: policyName });
  await page.getByLabel("Requested KB ID").fill("kb-acme");
  await page.getByLabel("Requested model ID").fill("claude-unknown");
  await page.getByLabel("Request type").selectOption("retrieve_and_generate");
  await page.getByRole("button", { name: "Run policy test" }).click();

  await expect(page.getByText("downgrade_model")).toBeVisible();
  await expect(page.getByText("claude-haiku", { exact: true })).toBeVisible();

  await page.goto(`/tenants/${ACME_TENANT_ID}?tab=quota`);

  await page.getByLabel("Monthly request limit").fill("120000");
  await page.getByLabel("Monthly token limit").fill("2500000");
  await page.getByLabel("Monthly cost limit").fill("650");
  await page.getByLabel("Soft threshold percent").fill("70");
  await page.getByLabel("Hard threshold percent").fill("95");
  await page.getByRole("button", { name: "Save quota" }).click();

  await expect(page.getByText("Quota updated.")).toBeVisible();
  await expect(page.getByLabel("Monthly request limit")).toHaveValue("120000");
  await expect(page.getByLabel("Hard threshold percent")).toHaveValue("95");
});
