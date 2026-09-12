import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

async function signUp(page: import("@playwright/test").Page, suffix: string) {
  await page.goto("/login");
  await page.getByRole("textbox", { name: /email/i }).fill(`a11y-${suffix}@example.test`);
  await page.getByRole("button", { name: /email me a link/i }).click();
  await page.getByRole("link", { name: /dev: open magic link/i }).click();
  await page.getByRole("button", { name: /let's set you up/i }).click();
  await page.getByLabel("Username").fill(`a11y${suffix}`.replace(/[^a-z0-9]/gi, "").slice(0, 28));
  await page.getByLabel("Display name").fill("Accessibility Tester");
  await page.getByLabel("Location").fill("Madison, WI");
  await page.getByRole("button", { name: /^continue/i }).click();
  await page.getByRole("button", { name: /^continue/i }).click();
  await page.getByRole("button", { name: /finish setup/i }).click();
  await expect(page.getByText("Account live")).toBeVisible();
}

const publicRoutes = [
  "/",
  "/login",
  "/browse",
  "/wanted",
  "/haul",
  "/shop",
  "/accessibility",
  "/buyer-protection",
  "/community-guidelines",
];

for (const route of publicRoutes) {
  test(`@a11y ${route} has no WCAG A/AA violations`, async ({ page }) => {
    await page.goto(route);
    await page.locator("body").waitFor();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .exclude("[data-sonner-toaster]")
      .analyze();
    expect(
      results.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
        targets: violation.nodes.flatMap((node) => node.target),
      })),
    ).toEqual([]);
  });
}

test("@a11y skip link moves keyboard focus to main content", async ({ page }) => {
  await page.goto("/login");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
});

test("@a11y login form has keyboard-operable labeled controls", async ({ page }) => {
  await page.goto("/login");
  const email = page.getByRole("textbox", { name: /email/i });
  await email.focus();
  await email.fill("player@example.com");
  await expect(email).toHaveValue("player@example.com");
  await expect(page.getByRole("button", { name: /email me a link/i })).toBeEnabled();
});

test("@a11y authenticated marketplace surfaces have no WCAG A/AA violations", async ({ page }, testInfo) => {
  const suffix = `${testInfo.project.name}${testInfo.workerIndex}${Date.now()}`;
  await signUp(page, suffix);
  for (const route of ["/app", "/app/create", "/app/inbox", "/app/trades", "/app/settings"]) {
    await page.goto(route);
    await expect(page.locator("#main-content")).toBeVisible();
    await page.locator(".animate-pulse").first().waitFor({ state: "detached" });
    await expect(page.getByRole("link", { name: "Post a listing", exact: true })).toBeVisible();
    if (route === "/app/create") {
      await expect(page.getByRole("link", { name: "Post a listing", exact: true })).toHaveAttribute("aria-current", "page");
    }
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .exclude("[data-sonner-toaster]")
      .analyze();
    expect(results.violations.map((violation) => ({
      route,
      id: violation.id,
      impact: violation.impact,
      targets: violation.nodes.flatMap((node) => node.target),
    }))).toEqual([]);
  }
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  for (const route of ["/", "/wanted", "/app/wanted"]) {
    await page.goto(route);
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.locator(".animate-pulse").first().waitFor({ state: "detached" });
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .exclude("[data-sonner-toaster]")
      .analyze();
    expect(results.violations.map((violation) => ({
      route,
      theme: "dark",
      id: violation.id,
      nodes: violation.nodes.map((node) => ({ target: node.target, detail: node.failureSummary })),
    }))).toEqual([]);
  }
});
