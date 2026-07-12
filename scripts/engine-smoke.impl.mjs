/**
 * Engine smoke test implementation. Do not run directly — use
 * `node scripts/engine-smoke.mjs`, which launches this through tsx.
 *
 * Drives the full marketplace lifecycle through executeOp/buildSnapshot on a
 * throwaway PGlite database: onboarding, listings with client ids, ISO
 * matching, trade negotiation (propose → counter → accept with competing-deal
 * auto-decline), fulfillment, ratings → reputation, claims, blocks, saves,
 * view dedupe, identity review, snapshot privacy scoping, and admin gating.
 * The only raw SQL is a fixture time-warp of an offer's expiry.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// ── Environment: force the PGlite path, dev mode, one admin ─────────────────
delete process.env.DATABASE_URL;
delete process.env.RESEND_API_KEY;
process.env.ADMIN_EMAILS = "admin@smoke.local";

const dataDir = path.join(process.cwd(), ".pglite-engine-smoke");
fs.rmSync(dataDir, { recursive: true, force: true });
process.env.PGLITE_PATH = dataDir;

// Imported dynamically so the env setup above happens first.
const { getDb } = await import("../lib/server/db.ts");
const schema = await import("../lib/server/schema.ts");
const { requestMagicLink, verifyMagicLink, getSessionUser } = await import(
  "../lib/server/auth.ts"
);
const { executeOp } = await import("../lib/server/engine.ts");
const { buildSnapshot, buildAdminData } = await import("../lib/server/snapshot.ts");
const { eq } = await import("drizzle-orm");

// ── Harness ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (e) {
    failed += 1;
    const msg = (e && e.message ? e.message : String(e)).split("\n").slice(0, 3).join(" | ");
    console.log(`FAIL ${name}\n     ${msg}`);
  }
}

function cid(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;
}

async function signup(email) {
  const req = await requestMagicLink(email, "http://localhost:3000");
  assert.ok(req.ok && req.devLink, `magic link for ${email}`);
  const token = new URL(req.devLink).searchParams.get("token");
  const v = await verifyMagicLink(token);
  assert.ok(v.ok, `verify for ${email}`);
  return v.sessionId;
}

/** Dispatch an op as the (freshly re-read) session user — like the bridge does. */
async function op(sessionId, name, input) {
  const user = await getSessionUser(sessionId);
  assert.ok(user, "session resolves");
  return executeOp(user, name, input);
}

function expectOk(res, what = "op") {
  assert.equal(res.ok, true, `${what} should succeed, got: ${res.ok ? "" : res.error}`);
  return res.value;
}
function expectErr(res, error, what = "op") {
  assert.equal(res.ok, false, `${what} should fail`);
  assert.equal(res.error, error, `${what} error copy`);
}

const byId = (arr, id) => arr.find((x) => x.id === id);
const userNamed = (snap, username) => snap.users.find((u) => u.username === username);

function listingInput(overrides = {}) {
  return {
    type: "jersey",
    title: "Test Jersey",
    team: "Test Team",
    level: "club",
    condition: "Good",
    listingType: "trade",
    tradeFor: "open to offers",
    photos: ["/images/jersey-1.jpg"],
    description: "A well-loved jersey.",
    shippingPreference: "seller-pays",
    tags: ["Test "],
    ...overrides,
  };
}

// ── Scenario ─────────────────────────────────────────────────────────────────

const sA = await signup("alice@smoke.local");
const sB = await signup("bob@smoke.local");
const sC = await signup("carol@smoke.local");
const sM = await signup("admin@smoke.local");
const A = (await getSessionUser(sA)).id;
const B = (await getSessionUser(sB)).id;
const C = (await getSessionUser(sC)).id;

const L1 = cid("l"); // A: Sockeye jersey (trade)
const L2 = cid("l"); // A: Truck Stop jersey (sell $40)
const L3 = cid("l"); // A: second Sockeye jersey (ISO-match trigger)
const FL1 = cid("l"); // A: free disc
const BL1 = cid("l"); // B: disc
const BL2 = cid("l"); // B: jersey
const CL1 = cid("l"); // C: disc
const d1 = cid("d"); // B → A trade on L1
const t1 = cid("t");
const d2 = cid("d"); // C → A buy on L1 (competing)
const t2 = cid("t");
const d3 = cid("d"); // C → A claim on FL1
const t3 = cid("t");
const d5 = cid("d"); // C → A trade on L2 (expiry sweep)
const t5x = cid("t");
const d6 = cid("d"); // C → A trade on L3 (lazy expiry guard)
const t6 = cid("t");
const iso1 = cid("iso");
const t5 = cid("t"); // B ↔ C direct thread
const m1 = cid("m");
const m2 = cid("m");
const idn1 = cid("idn");

try {
  await check("ops are gated until onboarding completes", async () => {
    expectErr(
      await op(sA, "createListing", { id: cid("l"), input: listingInput() }),
      "Complete onboarding first",
    );
  });

  await check("completeOnboarding sanitizes username, welcomes, logs activity", async () => {
    expectOk(
      await op(sA, "completeOnboarding", {
        username: " Alice!! ",
        displayName: " Alice A ",
        location: "Boston, MA",
        bio: "hi",
        favoriteTeams: ["Sockeye"],
      }),
    );
    const snap = await buildSnapshot(A);
    assert.equal(snap.me.needsOnboarding, false);
    assert.equal(snap.me.username, "alice");
    assert.equal(snap.me.displayName, "Alice A");
    assert.ok(
      snap.notifications.some((n) => n.title === "Welcome to Poachland"),
      "welcome notification",
    );
    assert.ok(
      snap.activity.some((a) => a.type === "new_member" && a.summary === "alice joined Poachland"),
      "new_member activity",
    );
  });

  await check("duplicate username rejected at onboarding", async () => {
    expectErr(
      await op(sB, "completeOnboarding", { username: "ALICE", displayName: "Bob", location: "" }),
      "That username is taken",
    );
  });

  await check("remaining users onboard; re-onboarding rejected", async () => {
    expectOk(await op(sB, "completeOnboarding", { username: "bob", displayName: "Bob B", location: "Chicago" }));
    expectOk(await op(sC, "completeOnboarding", { username: "carol", displayName: "Carol C", location: "Austin" }));
    expectOk(await op(sM, "completeOnboarding", { username: "mod", displayName: "The Mod", location: "" }));
    expectErr(
      await op(sA, "completeOnboarding", { username: "alice2", displayName: "Alice", location: "" }),
      "Already onboarded",
    );
  });

  await check("createListing rejects bad/duplicate client ids and bad input", async () => {
    expectErr(
      await op(sA, "createListing", { id: "L_ABCDEF", input: listingInput() }),
      "Invalid id",
    );
    expectOk(
      await op(sA, "createListing", {
        id: L1,
        input: listingInput({ title: "Sockeye 2019 Game Jersey", team: "Sockeye" }),
      }),
      "create L1",
    );
    expectErr(
      await op(sA, "createListing", { id: L1, input: listingInput() }),
      "Duplicate id",
    );
    expectErr(
      await op(sA, "createListing", { id: cid("l"), input: listingInput({ photos: [] }) }),
      "Add at least one photo",
    );
  });

  await check("listing fixtures created; snapshot shows them active", async () => {
    expectOk(
      await op(sA, "createListing", {
        id: L2,
        input: listingInput({ title: "Truck Stop Jersey", team: "Truck Stop", listingType: "sell", askingPrice: 40 }),
      }),
    );
    expectOk(
      await op(sB, "createListing", {
        id: BL1,
        input: listingInput({ type: "disc", title: "Machine Practice Disc", team: "Machine" }),
      }),
    );
    expectOk(
      await op(sB, "createListing", {
        id: BL2,
        input: listingInput({ title: "Ring of Fire Jersey", team: "Ring of Fire" }),
      }),
    );
    expectOk(
      await op(sC, "createListing", {
        id: CL1,
        input: listingInput({ type: "disc", title: "Waterloo Disc", team: "Waterloo" }),
      }),
    );
    const snap = await buildSnapshot(A);
    for (const id of [L1, L2, BL1, BL2, CL1]) {
      assert.equal(byId(snap.listings, id)?.status, "active", `${id} active`);
    }
    assert.deepEqual(byId(snap.listings, L1).tags, ["test"], "tags lowercased+trimmed");
  });

  await check("createISOPost notifies the poster about existing matches", async () => {
    expectErr(
      await op(sB, "createISOPost", { id: cid("iso"), input: { itemType: "jersey", description: "short" } }),
      "Describe what you're hunting (at least 10 characters)",
    );
    expectOk(
      await op(sB, "createISOPost", {
        id: iso1,
        input: { itemType: "jersey", description: "Hunting a Sockeye game jersey, size M", team: "Sockeye" },
      }),
    );
    const snap = await buildSnapshot(B);
    const match = snap.notifications.find((n) =>
      n.title === "1 current listing might match your hunt",
    );
    assert.ok(match, "existing-match notification");
    assert.equal(match.linkTo, `/app/listings/${L1}`);
    assert.ok(snap.activity.some((a) => a.type === "new_iso"), "new_iso activity");
  });

  await check("new listing notifies matching ISO poster (cross-user)", async () => {
    expectOk(
      await op(sA, "createListing", {
        id: L3,
        input: listingInput({ title: "Sockeye Throwback Jersey", team: "Sockeye" }),
      }),
    );
    const snap = await buildSnapshot(B);
    const n = snap.notifications.find((x) => x.title === "ISO match found");
    assert.ok(n, "iso_match notification");
    assert.ok(n.body.includes("Sockeye Throwback Jersey"), "body names the listing");
    assert.equal(n.linkTo, `/app/listings/${L3}`);
  });

  await check("proposeTrade rejects self-deals and empty offers", async () => {
    expectErr(
      await op(sA, "proposeTrade", {
        dealId: cid("d"), threadId: cid("t"), listingId: L1, offeredListingIds: [L2],
      }),
      "You can't open a deal on your own listing",
    );
    expectErr(
      await op(sB, "proposeTrade", {
        dealId: cid("d"), threadId: cid("t"), listingId: L1, offeredListingIds: [],
      }),
      "Pick at least one of your items to offer",
    );
  });

  await check("proposeTrade creates deal + thread + offer + messages + notification", async () => {
    expectOk(
      await op(sB, "proposeTrade", {
        dealId: d1, threadId: t1, listingId: L1, offeredListingIds: [BL1], note: "swap?",
      }),
    );
    const snap = await buildSnapshot(B);
    const deal = byId(snap.deals, d1);
    assert.ok(deal, "deal exists with the client-supplied id");
    assert.equal(deal.status, "open");
    assert.equal(deal.kind, "trade");
    assert.equal(deal.threadId, t1);
    assert.equal(deal.offers.length, 1);
    assert.equal(deal.offers[0].byUserId, B);
    assert.deepEqual(deal.offers[0].proposerListingIds, [BL1]);
    assert.deepEqual(deal.offers[0].ownerListingIds, [L1]);
    const thread = byId(snap.threads, t1);
    assert.equal(thread?.dealId, d1);
    const threadMsgs = snap.messages.filter((m) => m.threadId === t1);
    assert.equal(threadMsgs.length, 2, "offer message + note message");
    assert.equal(threadMsgs[0].kind, "offer");
    assert.equal(
      threadMsgs[0].content,
      '"Machine Practice Disc" ⇄ "Sockeye 2019 Game Jersey"',
      "describeOffer copy",
    );
    assert.equal(threadMsgs[1].content, "swap?");
    const aSnap = await buildSnapshot(A);
    assert.ok(
      aSnap.notifications.some((n) => n.title === "New trade proposal"),
      "owner notified",
    );
  });

  await check("duplicate active deal on the same listing rejected", async () => {
    expectErr(
      await op(sB, "proposeTrade", {
        dealId: cid("d"), threadId: cid("t"), listingId: L1, offeredListingIds: [BL2],
      }),
      "You already have an active deal on this listing",
    );
  });

  await check("counterOffer respects turn order", async () => {
    expectErr(
      await op(sB, "counterOffer", {
        dealId: d1,
        terms: { proposerListingIds: [BL1], ownerListingIds: [L1], cashFromProposer: 5, cashFromOwner: 0, note: "" },
      }),
      "Your offer is already on the table — wait for a response or withdraw it",
    );
  });

  await check("owner counters with absolute sides; old offer superseded", async () => {
    expectOk(
      await op(sA, "counterOffer", {
        dealId: d1,
        terms: { proposerListingIds: [BL1], ownerListingIds: [L1], cashFromProposer: 20, cashFromOwner: 0, note: "add $20" },
      }),
    );
    const snap = await buildSnapshot(A);
    const deal = byId(snap.deals, d1);
    assert.equal(deal.offers.length, 2);
    assert.equal(deal.offers[0].status, "superseded");
    const current = deal.offers[1];
    assert.equal(current.byUserId, A, "counter authored by owner");
    assert.deepEqual(current.proposerListingIds, [BL1], "sides stay absolute");
    assert.equal(current.cashFromProposer, 20, "cash still on the proposer side");
    const bSnap = await buildSnapshot(B);
    assert.ok(bSnap.notifications.some((n) => n.title === "Counter-offer received"));
  });

  await check("accept guards: own offer / not your deal", async () => {
    expectErr(await op(sA, "acceptOffer", { dealId: d1 }), "You can't accept your own offer");
    expectErr(await op(sC, "acceptOffer", { dealId: d1 }), "Not your deal");
  });

  await check("makeBuyOffer validates amount and opens a competing deal", async () => {
    expectErr(
      await op(sC, "makeBuyOffer", { dealId: cid("d"), threadId: cid("t"), listingId: L1, amount: 0 }),
      "Enter an offer amount",
    );
    expectOk(await op(sC, "makeBuyOffer", { dealId: d2, threadId: t2, listingId: L1, amount: 50 }));
    const snap = await buildSnapshot(C);
    assert.equal(byId(snap.deals, d2)?.status, "open");
  });

  await check("acceptOffer locks listings, auto-declines competitor, notifies third party", async () => {
    expectOk(await op(sB, "acceptOffer", { dealId: d1 }));
    const snap = await buildSnapshot(B);
    assert.equal(byId(snap.deals, d1).status, "accepted");
    assert.equal(byId(snap.listings, L1).status, "pending", "L1 locked");
    assert.equal(byId(snap.listings, BL1).status, "pending", "BL1 locked");
    const cSnap = await buildSnapshot(C);
    const d2rec = byId(cSnap.deals, d2);
    assert.equal(d2rec.status, "declined", "competing deal auto-declined");
    assert.equal(d2rec.declineReason, "The item went to another trade.");
    assert.equal(d2rec.offers[0].status, "declined");
    assert.ok(
      cSnap.notifications.some((n) => n.title === "Item no longer available"),
      "third party notified",
    );
    const aSnap = await buildSnapshot(A);
    assert.ok(aSnap.notifications.some((n) => n.title === "Offer accepted 🤝"));
  });

  await check("double-accept rejected", async () => {
    expectErr(await op(sB, "acceptOffer", { dealId: d1 }), "This deal is not open");
  });

  await check("markShipped records fulfillment and notifies", async () => {
    expectOk(await op(sA, "markShipped", { dealId: d1, tracking: "TRK123" }));
    expectOk(await op(sB, "markShipped", { dealId: d1 }));
    const snap = await buildSnapshot(B);
    const deal = byId(snap.deals, d1);
    assert.ok(deal.fulfillment[A]?.shippedAt, "A shipped");
    assert.equal(deal.fulfillment[A]?.tracking, "TRK123");
    assert.ok(deal.fulfillment[B]?.shippedAt, "B shipped");
    assert.ok(
      snap.notifications.some(
        (n) => n.title === "Shipment on the way 📦" && n.body.includes("TRK123"),
      ),
    );
  });

  await check("confirmComplete completes on the second confirmation", async () => {
    assert.deepEqual(expectOk(await op(sA, "confirmComplete", { dealId: d1 })), { completed: false });
    assert.deepEqual(expectOk(await op(sB, "confirmComplete", { dealId: d1 })), { completed: true });
    const snap = await buildSnapshot(A);
    assert.equal(byId(snap.deals, d1).status, "completed");
    assert.equal(byId(snap.listings, L1).status, "traded", "owner listing traded");
    assert.equal(byId(snap.listings, BL1).status, "traded", "proposer listing traded");
    assert.equal(userNamed(snap, "alice").tradesCompleted, 1);
    assert.equal(userNamed(snap, "bob").tradesCompleted, 1);
    assert.ok(
      userNamed(snap, "alice").badges.some((b) => b.type === "first-trade"),
      "first-trade badge (alice)",
    );
    assert.ok(
      userNamed(snap, "bob").badges.some((b) => b.type === "first-trade"),
      "first-trade badge (bob)",
    );
    assert.ok(
      snap.notifications.some((n) => n.title === "Badge earned: First Trade"),
      "badge_earned notification",
    );
    assert.ok(
      snap.notifications.some((n) => n.title === "Deal complete 🎉"),
      "deal_complete notification",
    );
    assert.ok(
      snap.activity.some(
        (a) => a.type === "deal_completed" && a.summary.includes("bob and alice completed a trade"),
      ),
      "deal_completed activity",
    );
  });

  await check("rateDeal recomputes trustScore to the hand-computed value", async () => {
    // bob → alice: (5+4+5)/3 = 4.666… → rounded to 4.7
    expectOk(
      await op(sB, "rateDeal", {
        dealId: d1,
        input: { communication: 5, shippingSpeed: 4, itemAccuracy: 5, wouldTradeAgain: true, comment: "great" },
      }),
    );
    // alice → bob: (3+4+5)/3 = 4.0
    expectOk(
      await op(sA, "rateDeal", {
        dealId: d1,
        input: { communication: 3, shippingSpeed: 4, itemAccuracy: 5, wouldTradeAgain: true },
      }),
    );
    const snap = await buildSnapshot(A);
    assert.equal(userNamed(snap, "alice").trustScore, 4.7, "alice trustScore");
    assert.equal(userNamed(snap, "alice").ratingsCount, 1);
    assert.equal(userNamed(snap, "bob").trustScore, 4, "bob trustScore");
    assert.ok(
      snap.notifications.some((n) => n.title === "New rating from bob"),
      "new_rating notification",
    );
    assert.ok(
      snap.activity.some((a) => a.type === "new_rating" && a.summary === "bob rated alice 4.7★"),
      "new_rating activity",
    );
  });

  await check("double rating rejected", async () => {
    expectErr(
      await op(sB, "rateDeal", {
        dealId: d1,
        input: { communication: 5, shippingSpeed: 5, itemAccuracy: 5, wouldTradeAgain: true },
      }),
      "You already rated this deal",
    );
  });

  await check("claim flow: free listing ends 'claimed'; non-free can't be claimed", async () => {
    expectOk(
      await op(sA, "createListing", {
        id: FL1,
        input: listingInput({ type: "disc", title: "Free Practice Disc", team: "Anonymous", listingType: "free" }),
      }),
    );
    expectErr(
      await op(sC, "claimListing", { dealId: cid("d"), threadId: cid("t"), listingId: L2 }),
      "Only free listings can be claimed",
    );
    expectOk(await op(sC, "claimListing", { dealId: d3, threadId: t3, listingId: FL1, note: "yes please" }));
    const aSnap0 = await buildSnapshot(A);
    assert.ok(
      aSnap0.notifications.some((n) => n.title === "Someone wants to claim your item"),
      "claim_request notification",
    );
    expectOk(await op(sA, "acceptOffer", { dealId: d3 }));
    expectOk(await op(sA, "confirmComplete", { dealId: d3 }));
    expectOk(await op(sC, "confirmComplete", { dealId: d3 }));
    const snap = await buildSnapshot(C);
    assert.equal(byId(snap.deals, d3).status, "completed");
    assert.equal(byId(snap.listings, FL1).status, "claimed", "free listing claimed");
    assert.equal(userNamed(snap, "carol").tradesCompleted, 1);
  });

  await check("toggleSave rejects own content, maintains counters", async () => {
    expectErr(
      await op(sA, "toggleSave", { targetType: "listing", targetId: L2 }),
      "It's already yours — no need to save it",
    );
    assert.equal(expectOk(await op(sB, "toggleSave", { targetType: "listing", targetId: L2 })), true);
    let snap = await buildSnapshot(B);
    assert.equal(byId(snap.listings, L2).saves, 1);
    assert.equal(snap.saves.length, 1);
    assert.equal(expectOk(await op(sB, "toggleSave", { targetType: "listing", targetId: L2 })), false);
    snap = await buildSnapshot(B);
    assert.equal(byId(snap.listings, L2).saves, 0);
    assert.equal(snap.saves.length, 0);
  });

  await check("markListingViewed dedupes per viewer and ignores the owner", async () => {
    expectOk(await op(sC, "markListingViewed", { id: L2 }));
    expectOk(await op(sC, "markListingViewed", { id: L2 }));
    expectOk(await op(sA, "markListingViewed", { id: L2 })); // owner
    const snap = await buildSnapshot(A);
    assert.equal(byId(snap.listings, L2).views, 1, "two viewer calls + owner call → 1 view");
  });

  await check("getOrCreateThread dedupes on the participant pair", async () => {
    assert.equal(
      expectOk(await op(sB, "getOrCreateThread", { threadId: t5, otherUserId: C })),
      t5,
    );
    assert.equal(
      expectOk(await op(sB, "getOrCreateThread", { threadId: cid("t"), otherUserId: C })),
      t5,
      "second call returns the existing thread",
    );
    expectErr(await op(sB, "getOrCreateThread", { threadId: cid("t"), otherUserId: B }), "That's you");
  });

  await check("sendMessage notifies and collapses unread per-thread notifications", async () => {
    expectOk(await op(sB, "sendMessage", { id: m1, threadId: t5, content: "yo carol" }));
    expectOk(await op(sB, "sendMessage", { id: m2, threadId: t5, content: "still there?" }));
    const snap = await buildSnapshot(C);
    const msgNotifs = snap.notifications.filter(
      (n) => n.type === "new_message" && n.linkTo === `/app/inbox/${t5}` && !n.read,
    );
    assert.equal(msgNotifs.length, 1, "unread message notifications collapse to one");
    assert.equal(msgNotifs[0].title, "Message from bob");
    assert.equal(msgNotifs[0].body, "still there?");
    expectErr(await op(sB, "sendMessage", { id: cid("m"), threadId: t5, content: "  " }), "Message is empty");
  });

  await check("blockUser enforces trade + message bans in both directions", async () => {
    expectErr(await op(sC, "blockUser", { targetId: C }), "You can't block yourself");
    expectOk(await op(sC, "blockUser", { targetId: B }));
    expectErr(await op(sC, "blockUser", { targetId: B }), "Already blocked");
    expectErr(
      await op(sB, "proposeTrade", {
        dealId: cid("d"), threadId: cid("t"), listingId: CL1, offeredListingIds: [BL2],
      }),
      "You can't trade with this user",
    );
    expectErr(
      await op(sC, "proposeTrade", {
        dealId: cid("d"), threadId: cid("t"), listingId: BL2, offeredListingIds: [CL1],
      }),
      "You can't trade with this user",
    );
    expectErr(
      await op(sB, "sendMessage", { id: cid("m"), threadId: t5, content: "hello?" }),
      "You can't message this user",
    );
    expectErr(
      await op(sC, "sendMessage", { id: cid("m"), threadId: t5, content: "no" }),
      "You can't message this user",
    );
    expectErr(
      await op(sB, "getOrCreateThread", { threadId: cid("t"), otherUserId: C }),
      "You can't message this user",
    );
    const snap = await buildSnapshot(C);
    assert.ok(
      snap.blocks.some((b) => b.blockerId === C && b.blockedId === B),
      "block visible to blocker",
    );
  });

  await check("buildSnapshot sweeps the viewer's expired open deals", async () => {
    expectOk(
      await op(sC, "proposeTrade", {
        dealId: d5, threadId: t5x, listingId: L2, offeredListingIds: [CL1],
      }),
    );
    // Fixture time-warp: push the pending offer past its deadline.
    const db = await getDb();
    await db
      .update(schema.offers)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(schema.offers.dealId, d5));
    const snap = await buildSnapshot(C);
    const deal = byId(snap.deals, d5);
    assert.equal(deal.status, "expired");
    assert.equal(deal.offers[0].status, "expired");
    assert.ok(
      snap.notifications.some(
        (n) => n.title === "Offer expired" && n.body.includes("Truck Stop Jersey"),
      ),
      "proposer notified",
    );
    const aSnap = await buildSnapshot(A);
    assert.ok(
      aSnap.notifications.some((n) => n.title === "Offer expired"),
      "owner notified",
    );
  });

  await check("expired offers can't be accepted (lazy expiry inside the mutation)", async () => {
    expectOk(
      await op(sC, "proposeTrade", {
        dealId: d6, threadId: t6, listingId: L3, offeredListingIds: [CL1],
      }),
    );
    const db = await getDb();
    await db
      .update(schema.offers)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(schema.offers.dealId, d6));
    expectErr(await op(sA, "acceptOffer", { dealId: d6 }), "This offer expired before a response");
    const snap = await buildSnapshot(A);
    assert.equal(byId(snap.deals, d6).status, "expired", "expiry was committed");
  });

  await check("admin ops rejected for non-admins", async () => {
    expectErr(
      await op(sA, "adminSetListingFeatured", { id: L2, featured: true }),
      "Moderators only",
    );
    expectErr(
      await op(sA, "adminReviewIdentity", { identityId: idn1, status: "verified" }),
      "Moderators only",
    );
  });

  await check("admin can feature a listing", async () => {
    expectOk(await op(sM, "adminSetListingFeatured", { id: L2, featured: true }));
    const snap = await buildSnapshot(A);
    assert.equal(byId(snap.listings, L2).isFeatured, true);
  });

  await check("linkIdentity validates and records an unverified identity", async () => {
    expectErr(
      await op(sA, "linkIdentity", { id: cid("idn"), provider: "instagram", handle: "  " }),
      "Enter a handle",
    );
    expectErr(
      await op(sA, "linkIdentity", {
        id: cid("idn"), provider: "instagram", handle: "@alice", url: "ftp://nope",
      }),
      "Link must start with http:// or https://",
    );
    expectOk(
      await op(sA, "linkIdentity", {
        id: idn1, provider: "instagram", handle: "@alice", url: "https://instagram.com/alice",
      }),
    );
    expectErr(
      await op(sA, "linkIdentity", { id: cid("idn"), provider: "instagram", handle: "@alice" }),
      "You already linked that handle",
    );
    const snap = await buildSnapshot(A);
    const idn = byId(snap.identities, idn1);
    assert.equal(idn?.status, "unverified");
    assert.equal(idn?.verifiedAt, undefined);
  });

  await check("adminReviewIdentity verifies and notifies the user", async () => {
    expectOk(await op(sM, "adminReviewIdentity", { identityId: idn1, status: "verified" }));
    const snap = await buildSnapshot(A);
    const idn = byId(snap.identities, idn1);
    assert.equal(idn.status, "verified");
    assert.ok(idn.verifiedAt, "verifiedAt set");
    assert.ok(
      snap.notifications.some(
        (n) =>
          n.title === "Identity verified ✓" &&
          n.body === "Your instagram handle now shows verified on your profile.",
      ),
      "verification notification",
    );
  });

  await check("snapshot privacy: viewer sees only their own private rows, no emails", async () => {
    const snap = await buildSnapshot(A);
    assert.ok(snap.users.length >= 4, "public profiles present");
    for (const u of snap.users) {
      assert.ok(!("email" in u), "no email on public profiles");
      assert.ok(u.username, "only onboarded users listed");
    }
    for (const t of snap.threads) {
      assert.ok(t.participantIds.includes(A), "threads scoped to viewer");
    }
    for (const d of snap.deals) {
      assert.ok(d.proposerId === A || d.ownerId === A, "deals scoped to viewer");
    }
    for (const n of snap.notifications) assert.equal(n.userId, A, "notifications scoped");
    for (const s of snap.saves) assert.equal(s.userId, A, "saves scoped");
    assert.ok(!snap.threads.some((t) => t.id === t5), "A can't see the B↔C thread");
    assert.ok(byId(snap.listings, CL1), "public listings of others visible");
    assert.equal(snap.ratings.length, 2, "public ratings visible");
    assert.equal(snap.me.email, "alice@smoke.local");
    assert.equal(snap.me.isAdmin, false);
  });

  await check("signed-out snapshot: public data only, me null", async () => {
    const snap = await buildSnapshot(null);
    assert.equal(snap.me, null);
    assert.ok(snap.users.length >= 4 && snap.listings.length >= 5);
    assert.deepEqual(
      [snap.deals, snap.threads, snap.messages, snap.notifications, snap.saves, snap.reports, snap.blocks].map((c) => c.length),
      [0, 0, 0, 0, 0, 0, 0],
      "private collections empty",
    );
    for (const u of snap.users) assert.ok(!("email" in u));
  });

  await check("buildAdminData: emails, identity queue, stats", async () => {
    const data = await buildAdminData();
    assert.equal(data.users.length, 4);
    assert.ok(data.users.every((u) => typeof u.email === "string" && u.email.includes("@")));
    assert.equal(data.identityQueue.length, 0, "verified identity left the queue");
    assert.equal(data.stats.users, 4);
    assert.equal(data.stats.pendingIdentities, 0);
    assert.equal(data.stats.dealsTotal, 5, "d1, d2, d3, d5, d6");
    assert.equal(data.stats.dealsCompleted, 2);
    assert.equal(data.stats.dealsOpen, 0);
    assert.equal(data.stats.dealsDisputed, 0);
    assert.equal(data.disputedDeals.length, 0);
    assert.equal(data.stats.ratings, 2);
    assert.ok(data.stats.messages > 0);
    assert.equal(data.stats.pendingReports, 0);
  });

  console.log(`\nENGINE SMOKE: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exitCode = 1;
} finally {
  fs.rmSync(dataDir, { recursive: true, force: true });
}
