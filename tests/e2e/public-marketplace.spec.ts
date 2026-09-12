import { expect, test } from "@playwright/test";

test("homepage discovery stays public", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /join free/i })).toBeVisible();
  const drops = page.getByRole("region", { name: "Fresh drops" });
  await drops.getByRole("link", { name: "See all" }).click();
  await expect(page).toHaveURL(/\/browse$/);
  await expect(page.getByRole("heading", { name: "The crate", exact: true })).toBeVisible();

  await page.goto("/");
  const wanted = page.getByRole("region", { name: "The wanted board" });
  await wanted.getByRole("link", { name: "View all" }).click();
  await expect(page).toHaveURL(/\/wanted$/);
  await expect(page.getByRole("heading", { name: "The wanted board", exact: true })).toBeVisible();
});

test("homepage browsing action and inventory fit mobile and tablet screens", async ({ page }) => {
  for (const width of [320, 375, 414, 768]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    const browse = page.getByRole("link", { name: "Browse the crate", exact: true });
    await expect(browse).toBeVisible();
    const actionBox = await browse.boundingBox();
    expect(actionBox).not.toBeNull();
    expect(actionBox!.y + actionBox!.height).toBeLessThan(500);
    const dropsBox = await page.getByRole("heading", { name: "Fresh drops" }).boundingBox();
    expect(dropsBox!.y).toBeLessThan(600);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});

test("browse exposes filter selections and lets visitors recover from no results", async ({ page }) => {
  await page.goto("/browse");
  const items = page.getByRole("group", { name: "Item type" });
  const types = page.getByRole("group", { name: "Listing type" });
  await expect(items.getByRole("button", { name: "All", exact: true })).toHaveAttribute("aria-pressed", "true");
  await items.getByRole("button", { name: "Jerseys" }).click();
  await types.getByRole("button", { name: "Free", exact: true }).click();
  await page.getByRole("textbox", { name: "Search listings" }).fill("no-such-gear-hallmark-7b30819");
  await expect(items.getByRole("button", { name: "Jerseys" })).toHaveAttribute("aria-pressed", "true");
  await expect(types.getByRole("button", { name: "Free", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "No gear matches those filters." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Join the swap meet" })).toHaveCount(0);
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Search listings" })).toHaveValue("");
  await expect(items.getByRole("button", { name: "All", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(types.getByRole("button", { name: "All", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "No gear matches those filters." })).toHaveCount(0);
  await expect(page.getByText("Loosen the filters", { exact: false })).toHaveCount(0);
});

test("wanted filters expose their state and offer a reset when empty", async ({ page }) => {
  await page.goto("/wanted");
  const items = page.getByRole("group", { name: "Item type" });
  await items.getByRole("button", { name: "Discs" }).click();
  await expect(items.getByRole("button", { name: "Discs" })).toHaveAttribute("aria-pressed", "true");
  await expect(items.getByRole("button", { name: "All", exact: true })).toHaveAttribute("aria-pressed", "false");
  await page.locator("main .animate-pulse").first().waitFor({ state: "detached" });
  if (await page.getByRole("button", { name: "Clear filter", exact: true }).isVisible()) {
    await expect(page.getByRole("heading", { name: "Join the swap meet" })).toHaveCount(0);
    await page.getByRole("button", { name: "Clear filter", exact: true }).click();
    await expect(items.getByRole("button", { name: "All", exact: true })).toHaveAttribute("aria-pressed", "true");
  }
});

test("empty public pages have one relevant next action", async ({ page }) => {
  const states = [
    { route: "/browse", heading: "The crate is waiting for its first drop.", action: "Join to list your gear", href: "/login" },
    { route: "/wanted", heading: "Be the first to pin a request.", action: "Join to post a request", href: "/login" },
    { route: "/haul", heading: "No hauls on the wall yet.", action: "Browse the crate", href: "/browse" },
  ];
  for (const state of states) {
    await page.goto(state.route);
    await page.locator("main .animate-pulse").first().waitFor({ state: "detached" });
    if (await page.getByRole("heading", { name: state.heading }).isVisible()) {
      await expect(page.getByRole("link", { name: state.action, exact: true })).toHaveAttribute("href", state.href);
      await expect(page.getByRole("heading", { name: "Join the swap meet" })).toHaveCount(0);
      await expect(page.locator("main").getByRole("link")).toHaveCount(1);
    }
  }
});
