import { expect, test } from "@playwright/test";

import { loginAsSeedAdmin } from "../fixtures/auth";

test("login page is accessible", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible();
  await expect(page.getByText("Governix", { exact: true })).toBeVisible();
});

test("unauthenticated users are redirected to login", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL("/login");
});

test("seed admin can sign in and see the dashboard shell", async ({ page }) => {
  await loginAsSeedAdmin(page);

  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("Platform overview")).toBeVisible();
  await expect(page.getByText("admin@acme.io")).toBeVisible();
});
