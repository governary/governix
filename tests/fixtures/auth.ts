import { expect, type Page } from "@playwright/test";

export async function loginAsSeedAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email address *").fill("admin@acme.io");
  await page.getByLabel("Password *").fill("governix-admin");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
}

