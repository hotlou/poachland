import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("admin can publish, hide, restore, inspect, and delete a sample batch", async ({ page, browser }, testInfo) => {
  test.setTimeout(180_000);
  await page.goto("/login");
  await page.getByRole("textbox", { name: /email/i }).fill("e2e-admin@example.test");
  await page.getByRole("button", { name: /email me a link/i }).click();
  await page.getByRole("link", { name: /dev: open magic link/i }).click();
  await page.waitForURL(/\/(onboarding|app)/);
  if (page.url().includes("/onboarding")) {
    await page.getByRole("button", { name: /let's set you up/i }).click();
    await page.getByLabel("Username").fill("e2eadmin");
    await page.getByLabel("Display name").fill("Test Moderator");
    await page.getByLabel("Location").fill("Test workspace");
    await page.getByRole("button", { name: /^continue/i }).click();
    await page.getByRole("button", { name: /^continue/i }).click();
    await page.getByRole("button", { name: /finish setup/i }).click();
    await expect(page.getByText("Account live")).toBeVisible();
  }
  await page.goto("/admin");
  await page.getByRole("tab", { name: "Samples", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sample content", exact: true })).toBeVisible();
  const confirm = async (action: "PUBLISH" | "DELETE") => {
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Reason for the audit log").fill("Checking the reversible sample controls in an isolated browser test.");
    await dialog.getByRole("textbox", { name: new RegExp(`Type ${action}`) }).fill(`${action} samples_202609_v1`);
    await dialog.getByRole("button", { name: action === "PUBLISH" ? "Publish sample batch" : "Delete sample batch", exact: true }).click();
    await expect(dialog).toBeHidden();
  };
  await page.getByRole("button", { name: /^(Publish examples|Extend publication)$/ }).click();
  await confirm("PUBLISH");
  await expect(page.getByRole("button", { name: "Hide all examples" })).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath("admin-samples.png"), fullPage: true });
  const visitorContext = await browser.newContext({ baseURL: String(testInfo.project.use.baseURL) });
  try {
    const visitor = await visitorContext.newPage();
    await visitor.goto("/l/l_samplev1a1");
    await expect(visitor.getByText("Example listing", { exact: true })).toBeVisible();
    await expect(visitor.getByRole("link", { name: "Message the seller" })).toHaveCount(0);
    await visitor.getByRole("button", { name: "Share listing" }).click();
    await expect(visitor.getByRole("textbox", { name: /post/i })).toHaveValue(/Example listing/);
    await visitor.keyboard.press("Escape");
    await expect(visitor.getByRole("dialog")).toBeHidden();
    await visitor.screenshot({ path: testInfo.outputPath("sample-listing.png"), fullPage: true });
    const image = await visitor.request.get("/l/l_samplev1a1/opengraph-image");
    expect(image.ok()).toBeTruthy();
    const bytes = await image.body();
    expect(bytes.readUInt32BE(16)).toBe(1200); expect(bytes.readUInt32BE(20)).toBe(630);
    await page.getByRole("button", { name: "Hide all examples" }).click();
    await expect(page.getByRole("button", { name: "Publish examples", exact: true })).toBeVisible();
    expect((await visitor.request.get("/l/l_samplev1a1")).status()).toBe(404);
    await page.getByRole("button", { name: "Publish examples", exact: true }).click();
    await confirm("PUBLISH");
    await page.getByRole("tab", { name: "Content", exact: true }).click();
    await page.getByLabel("Content source").selectOption("sample");
    await expect(page.getByText(/21 records/)).toBeVisible();
    await page.getByLabel("Search content").fill("l_samplev1a1");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.getByText(/^1 records/)).toBeVisible();
    await page.getByRole("button", { name: "Hide", exact: true }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Reason for the audit log").fill("Checking item-level visibility without changing its trade status.");
    await dialog.getByRole("button", { name: "Hide content", exact: true }).click();
    await expect(dialog).toBeHidden();
    expect((await visitor.request.get("/l/l_samplev1a1")).status()).toBe(404);
    await page.getByRole("button", { name: "Restore", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Reason for the audit log").fill("Restoring the item after checking its hidden state.");
    await dialog.getByRole("button", { name: "Restore content", exact: true }).click();
    await expect(dialog).toBeHidden();
    await page.getByRole("tab", { name: "Members", exact: true }).click();
    await page.getByLabel("Inspect member").selectOption("u_samplev1nora");
    await expect(page.getByText(/Sample history; excluded from real totals/)).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(results.violations).toEqual([]);
    await page.getByRole("tab", { name: "Audit log", exact: true }).click();
    await expect(page.getByText("content.hide", { exact: true }).first()).toBeVisible();
    await page.getByRole("tab", { name: "Samples", exact: true }).click();
    await page.getByRole("button", { name: "Delete batch permanently" }).click();
    await confirm("DELETE");
    await expect(page.getByRole("button", { name: "Delete batch permanently" })).toBeDisabled();
    expect((await visitor.request.get("/u/sample_sparelight")).status()).toBe(404);
  } finally {
    await visitorContext.close();
  }
});
