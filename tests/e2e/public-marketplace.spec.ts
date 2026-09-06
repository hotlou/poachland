import { expect, test } from "@playwright/test";

test("landing page exposes the primary marketplace journey", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: /join free/i })).toBeVisible();
});

test("public browse works at mobile width", async ({ page }) => {
  await page.goto("/browse");
  await expect(page.locator("main")).toBeVisible();
  await expect(page).toHaveTitle(/Poachland/i);
});
