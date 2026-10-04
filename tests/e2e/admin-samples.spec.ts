import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("admin can prepare, archive, edit privately, and delete a sample batch", async ({ page, browser }, testInfo) => {
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
  await expect(page.getByRole("heading", { name: "Private sample content", exact: true })).toBeVisible();
  const confirm = async (action: "PREPARE" | "DELETE") => {
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Reason for the audit log").fill("Checking the reversible sample controls in an isolated browser test.");
    await dialog.getByRole("textbox", { name: new RegExp(`Type ${action}`) }).fill(`${action} samples_202609_v1`);
    await dialog.getByRole("button", { name: action === "PREPARE" ? "Prepare private sample batch" : "Delete sample batch", exact: true }).click();
    await expect(dialog).toBeHidden();
  };
  await page.getByRole("button", { name: /^(Prepare private examples|Extend private workspace)$/ }).click();
  await confirm("PREPARE");
  await expect(page.getByRole("button", { name: "Archive private examples" })).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath("admin-samples.png"), fullPage: true });
  const visitorContext = await browser.newContext({ baseURL: String(testInfo.project.use.baseURL) });
  try {
    const visitor = await visitorContext.newPage();
    const listingPage = await visitor.goto("/l/l_samplev1a1");
    expect(listingPage?.status()).toBe(404);
    expect((await visitor.request.get("/u/sample_sparelight")).status()).toBe(404);
    const anonymousMarket = await visitor.request.get("/browse");
    expect(anonymousMarket.ok()).toBeTruthy();
    expect(await anonymousMarket.text()).not.toContain("l_samplev1a1");
    // Sample image routes must return the same generic card as missing records.
    const image = await visitor.request.get("/l/l_samplev1a1/opengraph-image");
    const missingImage = await visitor.request.get("/l/l_private_missing/opengraph-image");
    expect(image.ok()).toBeTruthy();
    expect(Buffer.compare(await image.body(), await missingImage.body())).toBe(0);
    const profileImage = await visitor.request.get("/u/sample_sparelight/opengraph-image");
    const missingProfileImage = await visitor.request.get("/u/private_missing/opengraph-image");
    expect(Buffer.compare(await profileImage.body(), await missingProfileImage.body())).toBe(0);
    await page.getByRole("button", { name: "Archive private examples" }).click();
    await expect(page.getByRole("button", { name: "Prepare private examples", exact: true })).toBeVisible();
    expect((await visitor.request.get("/l/l_samplev1a1")).status()).toBe(404);
    await page.getByRole("button", { name: "Prepare private examples", exact: true }).click();
    await confirm("PREPARE");
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
    // Audit the settled page rather than a toast's partially transparent exit frame.
    // Keep notifications in axe's scope; wait for their normal lifecycle to finish.
    await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, { timeout: 15_000 });
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(results.violations).toEqual([]);
    await page.getByLabel("Search members").fill("sample_sparelight");
    await page.screenshot({ path: testInfo.outputPath("admin-act-as-members.png"), fullPage: true });
    await page.getByRole("button", { name: "Act as @sample_sparelight", exact: true }).click();
    await page.waitForURL("**/app/profile");
    await expect(page.getByText("Acting as", { exact: false }).first()).toBeVisible();
    await page.goto("/app/listings/l_samplev1a1");
    await expect(page.getByRole("heading", { name: "Publish as real inventory" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Publish as real inventory", exact: true }).first()).toBeDisabled();
    await page.screenshot({ path: testInfo.outputPath("act-as-inventory.png"), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await page.goto("/app/listings/l_samplev1a1/edit");
    await page.getByLabel("Listing title", { exact: true }).fill("My gear — preparing actual photos");
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(page.getByRole("heading", { name: "My gear — preparing actual photos", exact: true }).first()).toBeVisible();
    expect((await visitor.request.get("/l/l_samplev1a1")).status()).toBe(404);
    expect(await (await visitor.request.get("/l/l_samplev1a1")).text()).not.toContain("My gear — preparing actual photos");
    await page.getByRole("button", { name: "Exit", exact: true }).click();
    await page.waitForURL("**/admin");
    await page.getByRole("tab", { name: "Audit log", exact: true }).click();
    await expect(page.getByText("actAs.updateListing", { exact: true }).first()).toBeVisible();
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
