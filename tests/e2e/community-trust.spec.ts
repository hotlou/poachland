import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function signIn(page: Page, email: string, username: string) {
  await page.goto("/login");
  await page.getByRole("textbox", { name: /email/i }).fill(email);
  await page.getByRole("button", { name: /email me a link/i }).click();
  await page.getByRole("link", { name: /dev: open magic link/i }).click();
  await page.waitForURL(/\/(onboarding|app)/);
  if (!page.url().includes("/onboarding")) return;
  await page.getByRole("button", { name: /let's set you up/i }).click();
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Display name").fill(`Trust test ${username}`);
  await page.getByLabel("Location").fill("Madison, WI");
  await page.getByRole("button", { name: /^continue/i }).click();
  await page.getByRole("button", { name: /^continue/i }).click();
  await page.getByRole("button", { name: /finish setup/i }).click();
  await expect(page.getByText("Account live")).toBeVisible();
}

test("staff review, two independent vouches, withdrawal, and Instagram draft controls", async ({ page, browser }, info) => {
  test.setTimeout(180_000);
  const tag = Date.now().toString(36) + info.project.name.slice(0, 1);
  const names = [`trust_a${tag}`, `trust_b${tag}`, `trust_c${tag}`];
  const contexts = await Promise.all(names.map(() => browser.newContext({ ...info.project.use, baseURL: String(info.project.use.baseURL) })));
  try {
    const members = await Promise.all(contexts.map((context) => context.newPage()));
    for (let i = 0; i < members.length; i++) await signIn(members[i], `${names[i]}@example.test`, names[i]);
    const target = members[2];
    await target.goto("/app/settings");
    await expect(target.getByText("Not yet community verified", { exact: true })).toBeVisible();
    await target.getByRole("button", { name: "Request staff review", exact: true }).click();
    await expect(target.getByText(/Staff review requested/)).toBeVisible();
    const consent = target.getByRole("switch", { name: "Include my public activity on Instagram" });
    await expect(consent).not.toBeChecked();
    await consent.click();
    await expect(consent).toBeChecked();
    await target.reload();
    await expect(consent).toBeChecked();
    await consent.click();
    await expect(consent).not.toBeChecked();
    await target.goto("/app/create");
    await expect(target.getByLabel("Listing title")).toBeVisible();

    await signIn(page, "e2e-admin@example.test", "e2eadmin");
    await page.goto("/admin");
    await page.getByRole("tab", { name: "Verification", exact: true }).click();
    for (const username of names.slice(0, 2)) {
      await page.getByLabel("Search verification members").fill(username);
      await page.getByRole("button", { name: `Review @${username}`, exact: true }).click();
      await page.getByRole("button", { name: "Grant staff check", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Reason and verification method").fill("Staff confirmed this isolated test member through an in-person conversation.");
      await dialog.getByRole("button", { name: "Grant staff check", exact: true }).click();
      await expect(dialog).toBeHidden();
      await expect(page.getByText(/Eligible to vouch · 3 remaining/)).toBeVisible();
    }
    for (let i = 0; i < 2; i++) {
      const member = members[i];
      await member.goto(`/u/${names[2]}`);
      const section = member.getByRole("region", { name: "Community verification" });
      await section.getByRole("checkbox").check();
      await section.getByRole("button", { name: `Vouch for @${names[2]}`, exact: true }).click();
      await expect(section.getByText(`You vouched for @${names[2]}.`, { exact: true })).toBeVisible();
    }
    await target.goto("/app/settings");
    await expect(target.getByText("Verified by the community", { exact: true })).toBeVisible();
    await expect(target.getByText(/Newly community-verified members wait seven days/)).toBeVisible();
    await target.screenshot({ path: info.outputPath("community-check-settings.png"), fullPage: true });
    const checks = await new AxeBuilder({ page: target }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).exclude("[data-sonner-toaster]").analyze();
    expect(checks.violations).toEqual([]);
    const issuer = members[1].getByRole("region", { name: "Community verification" });
    await issuer.getByRole("button", { name: "Withdraw my vouch", exact: true }).click();
    await issuer.getByRole("button", { name: "Confirm withdrawal", exact: true }).click();
    await expect(issuer.getByText(/This vouch was withdrawn or revoked/)).toBeVisible();
    await target.reload();
    await expect(target.getByText("Not yet community verified", { exact: true })).toBeVisible();

    await page.getByRole("tab", { name: "Instagram", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Instagram setup needed", exact: true })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "Pause all scheduled publishing" })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Automatically approve future highlights" })).toBeDisabled();
    await page.getByRole("button", { name: "Yesterday", exact: true }).click();
    await expect(page.getByText(/No eligible real activity with photo permission/)).toBeVisible();
    await page.screenshot({ path: info.outputPath("instagram-admin-empty.png"), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    const adminChecks = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).exclude("[data-sonner-toaster]").analyze();
    expect(adminChecks.violations).toEqual([]);
  } finally { for (const context of contexts) await context.close(); }
});
