import { expect, test } from "@playwright/test";

async function signUp(page: import("@playwright/test").Page, email: string, username: string) {
  await page.goto("/login");
  await page.getByRole("textbox", { name: /email/i }).fill(email);
  await page.getByRole("button", { name: /email me a link/i }).click();
  await page.getByRole("link", { name: /dev: open magic link/i }).click();
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByRole("button", { name: /let's set you up/i }).click();
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Display name").fill(`Trader ${username}`);
  await page.getByLabel("Location").fill("Madison, WI");
  await page.getByRole("button", { name: /^continue/i }).click();
  await page.getByRole("button", { name: /^continue/i }).click();
  await page.getByRole("button", { name: /finish setup/i }).click();
  await expect(page.getByText("Account live")).toBeVisible();
}

test("new trader posts a publicly discoverable listing with duplicate protection", async ({ page, browser }, testInfo) => {
  const suffix = `${testInfo.project.name}-${testInfo.workerIndex}-${Date.now()}`.replace(/[^a-z0-9]/gi, "").toLowerCase();
  const email = `e2e-${suffix}@example.test`;
  const username = `e2e${suffix}`.slice(0, 28);
  const title = `E2E Nationals Jersey ${suffix}`;

  await page.goto("/login");
  await page.getByRole("textbox", { name: /email/i }).fill(email);
  await page.getByRole("button", { name: /email me a link/i }).click();
  await page.getByRole("link", { name: /dev: open magic link/i }).click();
  await expect(page).toHaveURL(/\/onboarding/);

  await page.getByRole("button", { name: /let's set you up/i }).click();
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Display name").fill("Playwright Trader");
  await page.getByLabel("Location").fill("Madison, WI");
  await page.getByRole("button", { name: /^continue/i }).click();
  await page.getByRole("button", { name: /^continue/i }).click();
  await page.getByRole("button", { name: /finish setup/i }).click();

  await expect(page.getByText("Account live")).toBeVisible();
  await page.getByRole("button", { name: /post your first listing/i }).click();
  await expect(page).toHaveURL(/\/app\/create/);

  const completeListing = async () => {
    await page.getByLabel("Listing title").fill(title);
    await page.getByLabel("Team / Tournament").fill("USAU Nationals");
    await page.getByLabel("Description").fill("Current photos, no tears, and the condition is accurately represented.");
    await page.getByRole("button", { name: "Stock photo" }).first().click();
    await page.getByRole("button", { name: /post listing/i }).click();
  };

  await completeListing();
  await expect(page).toHaveURL(/\/app\/listings\//);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  await page.goto("/app/create");
  await completeListing();
  await expect(page.getByText(/looks like a duplicate/i)).toBeVisible();
  await expect(page).toHaveURL(/\/app\/create/);

  const visitorContext = await browser.newContext({ baseURL: String(testInfo.project.use.baseURL) });
  try {
    const visitor = await visitorContext.newPage();
    await visitor.goto("/");
    const listing = visitor.getByRole("region", { name: "Fresh drops" }).getByRole("link", { name: new RegExp(title) });
    await expect(listing).toHaveAttribute("href", /^\/l\//);
    await listing.click();
    await expect(visitor).toHaveURL(/\/l\//);
    await expect(visitor.getByRole("heading", { name: title })).toBeVisible();
  } finally {
    await visitorContext.close();
  }
});

test("two traders complete an offer and fulfillment lifecycle", async ({ browser }, testInfo) => {
  const suffix = `${testInfo.project.name}-${testInfo.workerIndex}-${Date.now()}`.replace(/[^a-z0-9]/gi, "").toLowerCase();
  const baseURL = String(testInfo.project.use.baseURL);
  const sellerContext = await browser.newContext({ baseURL });
  const buyerContext = await browser.newContext({ baseURL });
  const observerContext = await browser.newContext({ baseURL });
  const seller = await sellerContext.newPage();
  const buyer = await buyerContext.newPage();
  const observer = await observerContext.newPage();
  const sellerName = `sell${suffix.slice(-16)}`;
  const buyerName = `buy${suffix.slice(-16)}`;
  const title = `Lifecycle Disc ${suffix}`;

  try {
    await signUp(seller, `seller-${suffix}@example.test`, sellerName);
    await seller.goto("/app/create");
    await seller.getByLabel("Listing title").fill(title);
    await seller.getByLabel("Team / Tournament").fill("Madison Radicals");
    await seller.getByLabel("Description").fill("Accurately described collectible disc for the full browser lifecycle test.");
    await seller.getByRole("button", { name: /for sale/i }).click();
    await seller.getByLabel("Asking price").fill("75");
    await seller.getByRole("button", { name: "Stock photo" }).first().click();
    await seller.getByRole("button", { name: /post listing/i }).click();
    await expect(seller.getByRole("heading", { name: title })).toBeVisible();
    await expect(seller).toHaveURL(/\/app\/listings\//);
    const listingUrl = seller.url();

    await signUp(buyer, `buyer-${suffix}@example.test`, buyerName);
    await buyer.goto(listingUrl);
    await buyer.getByRole("button", { name: /buy for \$75/i }).click();
    await buyer.getByRole("button", { name: /send \$75 offer/i }).click();
    await expect(buyer).toHaveURL(/\/app\/trades\//);
    await expect(buyer.getByRole("button", { name: /accept offer/i })).toHaveCount(0);
    const dealUrl = buyer.url();

    await signUp(observer, `observer-${suffix}@example.test`, `watch${suffix}`.slice(0, 28));
    await observer.goto(dealUrl);
    await expect(observer.getByRole("heading", { name: /no deal here/i })).toBeVisible();
    await expect(observer.getByText(title)).toHaveCount(0);

    await seller.goto(dealUrl);
    await seller.getByRole("button", { name: /accept offer/i }).click();
    await seller.getByRole("button", { name: /lock it in/i }).click();
    await expect(seller.getByText(/deal agreed — time to deliver/i)).toBeVisible();
    await seller.getByLabel("Tracking number").fill("9400111899560000000000");
    await seller.getByRole("button", { name: /mark shipped/i }).click();
    await expect(seller.getByRole("button", { name: /cancel deal/i })).toHaveCount(0);
    await expect(seller.getByText(/shipping started—use report a problem/i)).toBeVisible();
    await seller.getByRole("button", { name: /confirm complete/i }).click();
    await seller.getByRole("button", { name: /^confirm$/i }).click();

    await buyer.goto(dealUrl);
    await expect(buyer.getByText(/deal agreed — time to deliver/i)).toBeVisible();
    await buyer.getByRole("button", { name: /mark shipped/i }).click();
    await buyer.getByRole("button", { name: /confirm complete/i }).click();
    await buyer.getByRole("button", { name: /^confirm$/i }).click();
    await expect(buyer.getByText(/^deal complete$/i)).toBeVisible();
    await buyer.getByPlaceholder(/a line about how it went/i).fill("Clear communication and an accurately described disc.");
    await buyer.getByRole("button", { name: /submit rating/i }).click();
    await expect(buyer.getByText(`Your rating of @${sellerName}`)).toBeVisible();

    await expect(async () => {
      await seller.goto(dealUrl);
      await expect(seller.getByText(`@${buyerName}'s rating of you`)).toBeVisible();
      await expect(seller.getByText(/clear communication and an accurately described disc/i)).toBeVisible();
    }).toPass({ timeout: 10_000 });
  } finally {
    await sellerContext.close();
    await buyerContext.close();
    await observerContext.close();
  }
});

test("an accepted deal can be disputed and is visible to both parties", async ({ browser }, testInfo) => {
  const suffix = `dispute${testInfo.project.name}${testInfo.workerIndex}${Date.now()}`.replace(/[^a-z0-9]/gi, "").toLowerCase();
  const baseURL = String(testInfo.project.use.baseURL);
  const sellerContext = await browser.newContext({ baseURL });
  const buyerContext = await browser.newContext({ baseURL });
  const seller = await sellerContext.newPage();
  const buyer = await buyerContext.newPage();
  const title = `Dispute Disc ${suffix}`;
  const reason = "The delivered item does not match the listing photos.";

  try {
    await signUp(seller, `dispute-seller-${suffix}@example.test`, `ds${suffix}`.slice(0, 28));
    await seller.goto("/app/create");
    await seller.getByLabel("Listing title").fill(title);
    await seller.getByLabel("Team / Tournament").fill("Raleigh Ring of Fire");
    await seller.getByLabel("Description").fill("A photographed collectible disc used to exercise the dispute workflow.");
    await seller.getByRole("button", { name: /for sale/i }).click();
    await seller.getByLabel("Asking price").fill("45");
    await seller.getByRole("button", { name: "Stock photo" }).first().click();
    await seller.getByRole("button", { name: /post listing/i }).click();
    await expect(seller).toHaveURL(/\/app\/listings\//);
    const listingUrl = seller.url();

    await signUp(buyer, `dispute-buyer-${suffix}@example.test`, `db${suffix}`.slice(0, 28));
    await buyer.goto(listingUrl);
    await buyer.getByRole("button", { name: /buy for \$45/i }).click();
    await buyer.getByRole("button", { name: /send \$45 offer/i }).click();
    await expect(buyer).toHaveURL(/\/app\/trades\//);
    const dealUrl = buyer.url();

    await seller.goto(dealUrl);
    await seller.getByRole("button", { name: /accept offer/i }).click();
    await seller.getByRole("button", { name: /lock it in/i }).click();
    await expect(seller.getByText(/deal agreed — time to deliver/i)).toBeVisible();

    await buyer.goto(dealUrl);
    await buyer.getByRole("button", { name: /report a problem/i }).click();
    await buyer.getByPlaceholder("Describe what went wrong").fill(reason);
    await buyer.getByRole("button", { name: /open dispute/i }).click();
    await expect(buyer.getByText(/under review by moderators/i)).toBeVisible();
    await expect(buyer.getByText(`“${reason}”`, { exact: true })).toBeVisible();

    await seller.goto(dealUrl);
    await expect(seller.getByText(/under review by moderators/i)).toBeVisible();
    await expect(seller.getByText(`“${reason}”`, { exact: true })).toBeVisible();
    await expect(seller.getByRole("button", { name: /mark shipped/i })).toHaveCount(0);
  } finally {
    await sellerContext.close();
    await buyerContext.close();
  }
});

test("an accepted deal can be cancelled and releases its listing", async ({ browser }, testInfo) => {
  const suffix = `cancel${testInfo.project.name}${testInfo.workerIndex}${Date.now()}`.replace(/[^a-z0-9]/gi, "").toLowerCase();
  const baseURL = String(testInfo.project.use.baseURL);
  const sellerContext = await browser.newContext({ baseURL });
  const buyerContext = await browser.newContext({ baseURL });
  const seller = await sellerContext.newPage();
  const buyer = await buyerContext.newPage();
  const title = `Cancellation Jersey ${suffix}`;

  try {
    await signUp(seller, `cancel-seller-${suffix}@example.test`, `cs${suffix}`.slice(0, 28));
    await seller.goto("/app/create");
    await seller.getByLabel("Listing title").fill(title);
    await seller.getByLabel("Team / Tournament").fill("Denver Johnny Bravo");
    await seller.getByLabel("Description").fill("A current listing used to verify cancellation and inventory release.");
    await seller.getByRole("button", { name: /for sale/i }).click();
    await seller.getByLabel("Asking price").fill("60");
    await seller.getByRole("button", { name: "Stock photo" }).first().click();
    await seller.getByRole("button", { name: /post listing/i }).click();
    await expect(seller).toHaveURL(/\/app\/listings\//);
    const listingUrl = seller.url();

    await signUp(buyer, `cancel-buyer-${suffix}@example.test`, `cb${suffix}`.slice(0, 28));
    await buyer.goto(listingUrl);
    await buyer.getByRole("button", { name: /buy for \$60/i }).click();
    await buyer.getByRole("button", { name: /send \$60 offer/i }).click();
    await expect(buyer).toHaveURL(/\/app\/trades\//);
    const dealUrl = buyer.url();

    await seller.goto(dealUrl);
    await seller.getByRole("button", { name: /accept offer/i }).click();
    await seller.getByRole("button", { name: /lock it in/i }).click();
    await seller.getByRole("button", { name: /cancel deal/i }).click();
    await seller.getByPlaceholder("Reason (at least 10 characters)").fill("Unable to fulfill this order safely.");
    await seller.getByRole("button", { name: /cancel the deal/i }).click();
    await expect(seller.getByText(/deal cancelled after acceptance/i)).toBeVisible();

    await expect(async () => {
      await buyer.goto(dealUrl);
      await expect(buyer.getByText(/deal cancelled after acceptance/i)).toBeVisible();
    }).toPass({ timeout: 10_000 });
    await buyer.goto(listingUrl);
    await expect(buyer.getByRole("button", { name: /buy for \$60/i })).toBeVisible();
  } finally {
    await sellerContext.close();
    await buyerContext.close();
  }
});
