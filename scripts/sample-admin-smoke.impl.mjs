import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Never inherit a remote database into this test.
delete process.env.DATABASE_URL;
delete process.env.RESEND_API_KEY;
const dir = await mkdtemp(path.join(os.tmpdir(), "poachland-sample-admin-"));
process.env.PGLITE_PATH = dir;
const { eq } = await import("drizzle-orm");
const { getDb } = await import("../lib/server/db.ts");
const s = await import("../lib/server/schema.ts");
const { executeOp } = await import("../lib/server/engine.ts");
const { manageSampleBatch, expireSampleBatches } = await import("../lib/server/sample-batches.ts");
const { SAMPLE_BATCH_ID, buildSampleContent } = await import("../lib/sample-content.ts");
const { buildSnapshot, buildAdminData } = await import("../lib/server/snapshot.ts");
const { queryMarketplacePage, queryMarketplaceListing } = await import("../lib/server/marketplace-query.ts");
const { getPublicListing, getPublicProfile, queryHaulPage, listPublicListingIds, listPublicUsernames } = await import("../lib/server/public.ts");
const { queryAdminContent, getAdminMemberDetail } = await import("../lib/server/admin-content.ts");
const { recordProductEvent } = await import("../lib/server/analytics.ts");
const { recomputeReputation } = await import("../lib/server/engine-effects.ts");
const { getSessionContext } = await import("../lib/server/auth.ts");
const { listingShareContent } = await import("../lib/sharing.ts");
const db = await getDb();
let passed = 0;
const check = async (name, fn) => { await fn(); passed++; console.log(`PASS ${name}`); };
const ok = (res) => assert.equal(res.ok, true, res.error);
const rejected = (res) => assert.equal(res.ok, false);
const note = "Reviewing the sample marketplace release and its rollback behavior.";
const input = (action) => ({ action, batchId: SAMPLE_BATCH_ID, confirm: `${action.toUpperCase()} ${SAMPLE_BATCH_ID}`, note });
const [admin] = await db.insert(s.users).values({ id: "u_adminsamples", username: "adminsamples", displayName: "Test admin", email: "admin@example.invalid", isAdmin: true, onboardedAt: new Date() }).returning();
const [member] = await db.insert(s.users).values({ id: "u_realmember01", username: "realmember", displayName: "Real sentinel", email: "sentinel@example.invalid", onboardedAt: new Date() }).returning();
const [realListing] = await db.insert(s.listings).values({ id: "l_realsentinel", sellerId: member.id, type: "jersey", title: "Real sentinel listing", team: "Sentinel", level: "club", size: "M", condition: "Good", listingType: "trade", shippingPreference: "seller-pays", photos: ["/images/jersey-1.jpg"] }).returning();
const realBefore = JSON.stringify({ member, realListing });
const fixture = buildSampleContent(new Date());
const lid = "l_samplev1a1";

try {
  await check("authorization and typed confirmation leave data unchanged", async () => {
    rejected(await executeOp(member, "adminSampleBatch", input("publish")));
    rejected(await manageSampleBatch(db, member, input("publish")));
    rejected(await executeOp(admin, "adminSampleBatch", { ...input("publish"), confirm: "publish" }));
    assert.equal((await db.select().from(s.sampleBatches)).length, 0);
  });
  await check("publish is bounded, internally consistent, and idempotent", async () => {
    ok(await executeOp(admin, "adminSampleBatch", input("publish")));
    ok(await executeOp(admin, "adminSampleBatch", input("publish")));
    assert.equal((await db.select().from(s.users)).length, 8);
    assert.equal((await db.select().from(s.listings)).length, 22);
    assert.equal((await db.select().from(s.deals)).length, 6);
    assert.equal((await db.select().from(s.ratings)).length, 8);
    assert.equal((await db.select().from(s.haulPosts)).length, 5);
    for (const u of fixture.users) {
      const [row] = await db.select().from(s.users).where(eq(s.users.id, u.id));
      assert.equal(row.ratingsCount, u.ratingsCount); assert.equal(row.tradesCompleted, u.tradesCompleted); assert.equal(row.trustScore, u.trustScore);
    }
  });
  await check("public discovery and shares disclose examples; sitemap excludes them", async () => {
    assert.equal((await queryMarketplacePage({ limit: 48 })).items.filter((l) => l.sampleBatchId).length, 8);
    assert.equal((await queryHaulPage()).items.length, 5);
    assert.ok((await getPublicProfile("sample_sparelight")).sampleBatchId);
    assert.match(listingShareContent(await getPublicListing(lid)).text, /Example listing/);
    assert.equal(await getPublicListing("l_samplev1x1"), null);
    assert.equal((await listPublicListingIds()).some((l) => l.id === lid), false);
    assert.equal((await listPublicUsernames()).some((u) => u.username.startsWith("sample_")), false);
  });
  await check("real actions cannot create sample relationships or reputation", async () => {
    for (const [op, payload] of [
      ["getOrCreateThread", { threadId: "t_realcontact01", otherUserId: "u_samplev1nora" }],
      ["toggleSave", { targetType: "listing", targetId: lid }],
      ["claimListing", { dealId: "d_realclaim001", threadId: "t_realclaim001", listingId: "l_samplev1a6" }],
      ["makeBuyOffer", { dealId: "d_realbuy0001", threadId: "t_realbuy0001", listingId: "l_samplev1a2", amount: 18 }],
      ["reactHaul", { haulId: "h_samplev1s1", emoji: "🔥" }],
      ["commentHaul", { id: "hc_realcomment", haulId: "h_samplev1s1", body: "Real user comment" }],
    ]) rejected(await executeOp(member, op, payload));
    ok(await executeOp(member, "markListingViewed", { id: lid }));
    assert.equal((await db.select().from(s.listingViews)).length, 0);
    await recordProductEvent(db, { name: "listing_created", userId: "u_samplev1nora", subjectType: "listing", subjectId: lid });
    await recordProductEvent(db, { name: "offer_created", userId: member.id, subjectType: "listing", subjectId: lid });
    assert.equal((await db.select().from(s.productEvents)).length, 0);
    assert.equal((await db.select().from(s.emailOutbox)).length, 0);
    const data = await buildAdminData();
    assert.equal(data.stats.users, 2); assert.equal(data.stats.activeListings, 1); assert.equal(data.stats.ratings, 0); assert.equal(data.stats.dealsCompleted, 0);
    assert.equal(data.stats.samples.users, 6);
  });
  await check("sample sessions are revoked and accounts cannot be verified", async () => {
    await db.insert(s.sessions).values({ id: "sample-session-forbidden", userId: "u_samplev1nora", expiresAt: new Date(Date.now() + 60_000) });
    assert.equal(await getSessionContext("sample-session-forbidden"), null);
    rejected(await executeOp(admin, "adminSetUserVerified", { userId: "u_samplev1nora", verified: true }));
  });
  await check("hide and restore preserve state and prevent public deep-link leakage", async () => {
    ok(await executeOp(admin, "adminModerateContent", { kind: "listing", id: lid, action: "hide", note }));
    assert.equal(await getPublicListing(lid), null);
    assert.equal(await queryMarketplaceListing(lid, member.id), null);
    assert.equal((await buildSnapshot(null)).listings.some((l) => l.id === lid), false);
    ok(await executeOp(admin, "adminSampleBatch", input("hide")));
    assert.equal(await getPublicProfile("sample_sparelight"), null);
    assert.equal((await queryHaulPage()).items.length, 0);
    assert.equal((await queryMarketplacePage({})).items.filter((l) => l.sampleBatchId).length, 0);
    ok(await executeOp(admin, "adminSampleBatch", input("publish")));
    assert.equal(await getPublicListing(lid), null, "republish must not undo item moderation");
    ok(await executeOp(admin, "adminModerateContent", { kind: "listing", id: lid, action: "restore", note }));
    assert.ok(await getPublicListing(lid));
  });
  await check("expiry hides all public reads before cron runs", async () => {
    await db.update(s.sampleBatches).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(s.sampleBatches.id, SAMPLE_BATCH_ID));
    assert.equal(await getPublicListing(lid), null); assert.equal(await getPublicProfile("sample_sparelight"), null);
    assert.equal((await buildSnapshot(null)).users.some((u) => u.sampleBatchId), false);
    assert.equal((await queryHaulPage()).items.length, 0);
    assert.equal(await expireSampleBatches(db), 1); assert.equal(await expireSampleBatches(db), 0);
    ok(await executeOp(admin, "adminSampleBatch", input("publish")));
  });
  await check("admin search, visibility filters, and member details cover records", async () => {
    const data = await queryAdminContent({ kind: "listing", scope: "sample" });
    assert.equal(data.total, 21); assert.equal(data.items.length, 20);
    assert.equal((await queryAdminContent({ kind: "listing", scope: "sample", page: 2 })).items.length, 1);
    assert.equal((await queryAdminContent({ kind: "rating", query: "measurements" })).total, 2);
    assert.equal((await getAdminMemberDetail("u_samplev1nora")).completedDeals, 2);
    rejected(await executeOp(member, "adminModerateContent", { kind: "listing", id: realListing.id, action: "delete", confirm: `DELETE ${realListing.id}`, note }));
  });
  await check("rating moderation recomputes example scores and isolates real reputation", async () => {
    ok(await executeOp(admin, "adminModerateContent", { kind: "rating", id: "r_samplev17", action: "hide", note }));
    assert.equal((await getPublicProfile("sample_sparelight")).trustScore, 5);
    ok(await executeOp(admin, "adminModerateContent", { kind: "rating", id: "r_samplev17", action: "restore", note }));
    assert.equal((await getPublicProfile("sample_sparelight")).trustScore, 4.8);
    await db.insert(s.ratings).values({ id: "r_crosssample", sampleBatchId: SAMPLE_BATCH_ID, dealId: "d_samplev1s5", fromUserId: "u_samplev1eli", toUserId: member.id, communication: 5, shippingSpeed: 5, itemAccuracy: 5, wouldTradeAgain: true });
    await recomputeReputation(db, member.id);
    assert.equal((await db.select().from(s.users).where(eq(s.users.id, member.id)))[0].ratingsCount, 0);
    await db.delete(s.ratings).where(eq(s.ratings.id, "r_crosssample"));
  });
  await check("permanent deletion requires exact confirmation and protects linked listings", async () => {
    rejected(await executeOp(admin, "adminModerateContent", { kind: "listing", id: lid, action: "delete", confirm: "DELETE", note }));
    rejected(await executeOp(admin, "adminModerateContent", { kind: "listing", id: "l_samplev1s1n", action: "delete", confirm: "DELETE l_samplev1s1n", note }));
    ok(await executeOp(admin, "adminModerateContent", { kind: "listing", id: "l_samplev1a8", action: "delete", confirm: "DELETE l_samplev1a8", note }));
    assert.equal(await getPublicListing("l_samplev1a8"), null);
    ok(await executeOp(admin, "adminSampleBatch", input("publish")));
    assert.equal(await getPublicListing("l_samplev1a8"), null, "republish does not recreate individually deleted items");
  });
  await check("batch purge refuses outside relationships and rolls back", async () => {
    await db.insert(s.threads).values({ id: "t_outsidebatch", participantIds: [member.id, "u_samplev1nora"] });
    rejected(await executeOp(admin, "adminSampleBatch", input("delete")));
    assert.ok(await getPublicProfile("sample_sparelight"));
    assert.equal((await db.select().from(s.deals)).length, 6);
    await db.delete(s.threads).where(eq(s.threads.id, "t_outsidebatch"));
  });
  await check("batch purge removes only samples and preserves the audit trail", async () => {
    const audits = (await db.select().from(s.adminAuditEvents)).length;
    ok(await executeOp(admin, "adminSampleBatch", input("delete")));
    assert.equal((await db.select().from(s.users)).length, 2); assert.equal((await db.select().from(s.listings)).length, 1);
    for (const table of [s.deals, s.offers, s.threads, s.ratings, s.haulPosts]) assert.equal((await db.select().from(table)).length, 0);
    assert.ok((await db.select().from(s.adminAuditEvents)).length > audits);
    const [m] = await db.select().from(s.users).where(eq(s.users.id, member.id));
    const [l] = await db.select().from(s.listings).where(eq(s.listings.id, realListing.id));
    assert.equal(JSON.stringify({ member: m, realListing: l }), realBefore);
    ok(await executeOp(admin, "adminSampleBatch", input("delete")));
  });
  await check("hide applies to real content and restore returns its original availability", async () => {
    ok(await executeOp(admin, "makeBuyOffer", { dealId: "d_beforehide1", threadId: "t_beforehide1", listingId: realListing.id, amount: 20 }));
    ok(await executeOp(admin, "adminModerateContent", { kind: "listing", id: realListing.id, action: "hide", note }));
    rejected(await executeOp(admin, "makeBuyOffer", { dealId: "d_hiddenbuy01", threadId: "t_hiddenbuy01", listingId: realListing.id, amount: 20 }));
    rejected(await executeOp(member, "acceptOffer", { dealId: "d_beforehide1" }));
    assert.equal(await getPublicListing(realListing.id), null);
    assert.equal((await buildSnapshot(null)).listings.some((l) => l.id === realListing.id), false);
    assert.ok((await buildSnapshot(admin.id)).listings.find((l) => l.id === realListing.id)?.hiddenAt, "private deal context remains readable");
    ok(await executeOp(admin, "adminModerateContent", { kind: "listing", id: realListing.id, action: "restore", note }));
    assert.equal((await getPublicListing(realListing.id)).status, "active");
    ok(await executeOp(member, "acceptOffer", { dealId: "d_beforehide1" }));
  });
  await check("account erasure refuses moderator deletion", async () => {
    rejected(await executeOp(admin, "adminCloseAccount", { userId: admin.id, confirm: admin.username, note }));
  });
  await check("Act as authorizes active moderators, isolates edits, and audits the real actor", async () => {
    const { startImpersonation, stopImpersonation } = await import("../lib/server/auth.ts");
    ok(await executeOp(admin, "adminSampleBatch", input("publish")));
    await db.insert(s.sessions).values([
      { id: "admin-act-session", userId: admin.id, expiresAt: new Date(Date.now() + 60_000) },
      { id: "member-act-session", userId: member.id, expiresAt: new Date(Date.now() + 60_000) },
      { id: "expired-act-session", userId: admin.id, expiresAt: new Date(Date.now() - 1000) },
    ]);
    rejected(await startImpersonation("member-act-session", "u_samplev1nora"));
    rejected(await startImpersonation("expired-act-session", "u_samplev1nora"));
    rejected(await startImpersonation("admin-act-session", admin.id));
    ok(await startImpersonation("admin-act-session", "u_samplev1nora"));
    const ctx = await getSessionContext("admin-act-session");
    assert.equal(ctx.realUser.id, admin.id); assert.equal(ctx.effectiveUser.id, "u_samplev1nora");
    rejected(await executeOp(ctx.effectiveUser, "updateListing", { id: lid, patch: { title: "Unauthorized" } }));
    rejected(await executeOp(ctx.effectiveUser, "adminSampleBatch", input("delete"), ctx.realUser));
    rejected(await executeOp(ctx.effectiveUser, "commentHaul", { id: "hc_samplewrite", haulId: "h_samplev1s1", body: "Invented reaction" }, ctx.realUser));
    rejected(await executeOp(ctx.effectiveUser, "updateListing", { id: realListing.id, patch: { title: "Wrong owner" } }, ctx.realUser));
    ok(await executeOp(ctx.effectiveUser, "updateListing", { id: lid, patch: { title: "My saved gear details" } }, ctx.realUser));
    ok(await executeOp(ctx.effectiveUser, "updateProfile", { patch: { bio: "Preparing my actual gear inventory." } }, ctx.realUser));
    const source = fixture.listings.find((l) => l.id === lid);
    ok(await executeOp(ctx.effectiveUser, "createListing", { id: "l_adminnewgear", input: { ...source, title: "Additional gear draft", photos: ["/images/jersey-1.jpg"] } }, ctx.realUser));
    assert.equal((await db.select().from(s.listings).where(eq(s.listings.id, "l_adminnewgear")))[0].sampleBatchId, SAMPLE_BATCH_ID);
    const audits = await db.select().from(s.adminAuditEvents).where(eq(s.adminAuditEvents.action, "actAs.updateListing"));
    assert.equal(audits.at(-1).actorUserId, admin.id); assert.equal(audits.at(-1).metadata.actingAsUserId, ctx.effectiveUser.id);
    ok(await executeOp(admin, "adminSampleBatch", input("hide")));
    assert.ok(await queryMarketplaceListing(lid, ctx.effectiveUser.id));
    assert.ok((await buildSnapshot(ctx.effectiveUser.id)).listings.some((l) => l.id === lid));
    assert.equal(await queryMarketplaceListing(lid, member.id), null);
    await db.update(s.users).set({ isAdmin: false }).where(eq(s.users.id, admin.id));
    assert.equal((await getSessionContext("admin-act-session")).effectiveUser.id, admin.id);
    await db.update(s.users).set({ isAdmin: true }).where(eq(s.users.id, admin.id));
    await stopImpersonation("admin-act-session");
    assert.equal((await getSessionContext("admin-act-session")).effectiveUser.id, admin.id);
    ok(await executeOp(admin, "adminSampleBatch", input("publish")));
  });
  await check("real inventory requires owned photos and never inherits fictional reputation", async () => {
    const { publishManagedInventory } = await import("../lib/server/managed-inventory.ts");
    const { PoachStore } = await import("../lib/engine.ts");
    const targetId = "u_samplev1nora";
    const publish = { listingId: lid, username: "ownedgear", displayName: "Actual gear closet", location: "Minneapolis, MN", ownsGear: true };
    rejected(await publishManagedInventory(db, member, targetId, publish));
    rejected(await publishManagedInventory(db, admin, targetId, { ...publish, ownsGear: false }));
    rejected(await publishManagedInventory(db, admin, targetId, publish));
    rejected(await publishManagedInventory(db, admin, targetId, { ...publish, listingId: "l_samplev1s1n" }));
    const photo = "https://test.public.blob.vercel-storage.com/uploads/actual-gear.jpg";
    await db.update(s.listings).set({ photos: [photo], title: "My own club jersey", description: "Actual item details supplied by its owner." }).where(eq(s.listings.id, lid));
    await db.insert(s.objectUploads).values({ id: "upload-owned-gear", ownerUserId: member.id, objectKey: "uploads/actual-gear.jpg", publicUrl: photo, contentType: "image/jpeg", byteSize: 1024 });
    await assert.rejects(() => publishManagedInventory(db, admin, targetId, publish), /belongs to another account/);
    assert.equal((await db.select().from(s.users).where(eq(s.users.id, targetId)))[0].sampleBatchId, SAMPLE_BATCH_ID);
    await db.update(s.objectUploads).set({ ownerUserId: targetId }).where(eq(s.objectUploads.id, "upload-owned-gear"));
    ok(await publishManagedInventory(db, admin, targetId, publish));
    const [owner] = await db.select().from(s.users).where(eq(s.users.id, targetId));
    assert.equal(owner.sampleBatchId, null); assert.equal(owner.managedByUserId, admin.id);
    assert.equal(owner.ratingsCount, 0); assert.equal(owner.tradesCompleted, 0); assert.equal(owner.trustScore, 0);
    assert.deepEqual(owner.history, []); assert.deepEqual(owner.badges, []);
    assert.match(owner.bio, /managed by @adminsamples/);
    assert.equal((await getPublicListing(lid)).sampleBatchId, undefined);
    assert.equal((await getPublicListing(lid)).seller.managedByUserId, admin.id);
    assert.equal((await getPublicProfile("ownedgear")).tradesCompleted, 0);
    await recomputeReputation(db, owner.id);
    const snapshot = await buildSnapshot(null);
    const client = new PoachStore(false, snapshot);
    assert.equal(client.ratingSummary(targetId).count, 0); assert.equal(client.ratingsFor(targetId).length, 0);
    assert.equal((await buildAdminData()).stats.users, 2);
    assert.equal((await getAdminMemberDetail(targetId)).completedDeals, 0);
    assert.equal((await getAdminMemberDetail(targetId)).ratingsReceived, 0);
    rejected(await executeOp(owner, "updateProfile", { patch: { bio: "Direct session forbidden" } }));
    await db.insert(s.sessions).values({ id: "managed-root-forbidden", userId: owner.id, expiresAt: new Date(Date.now() + 60_000) });
    assert.equal(await getSessionContext("managed-root-forbidden"), null);
    await recordProductEvent(db, { name: "listing_created", userId: owner.id, subjectType: "listing", subjectId: lid });
    assert.equal((await db.select().from(s.productEvents).where(eq(s.productEvents.userId, owner.id))).length, 0);
    ok(await executeOp(member, "getOrCreateThread", { threadId: "t_ownedcontact", otherUserId: owner.id }));
    ok(await executeOp(admin, "adminSampleBatch", input("delete")));
    assert.ok(await getPublicListing(lid)); assert.ok(await getPublicProfile("ownedgear"));
    assert.equal((await db.select().from(s.ratings)).length, 0);
    assert.equal((await db.select().from(s.listings).where(eq(s.listings.sellerId, targetId))).length, 1);
    rejected(await executeOp(admin, "adminSampleBatch", input("publish")));
    assert.ok(await getPublicListing(lid), "re-seeding must not overwrite real inventory");
  });
  console.log(`SAMPLE ADMIN SMOKE: all ${passed} checks passed.`);
} finally {
  await rm(dir, { recursive: true, force: true });
}
process.exit(0);
