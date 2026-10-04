import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

delete process.env.DATABASE_URL;
delete process.env.RESEND_API_KEY;
for (const key of Object.keys(process.env)) if (key.startsWith("INSTAGRAM_")) delete process.env[key];
process.env.BLOB_STORE_ID = "store_socialtest";
const directory = await mkdtemp(path.join(os.tmpdir(), "poach-social-"));
process.env.PGLITE_PATH = directory;
const { eq } = await import("drizzle-orm");
const { getDb } = await import("../lib/server/db.ts");
const s = await import("../lib/server/schema.ts");
const social = await import("../lib/server/social-publishing.ts");
const { socialPosts, socialSettings } = await import("../lib/server/social-schema.ts");
const db = await getDb();
const now = new Date();
const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 12));
let passed = 0;
const check = async (name, test) => { await test(); passed++; console.log(`PASS ${name}`); };
const photo = (id) => `https://store_socialtest.public.blob.vercel-storage.com/uploads/${id}.jpg`;
async function item(id, owner = "u_socialone", extra = {}) {
  await db.insert(s.listings).values({ id, sellerId: owner, type: "jersey", title: id, team: "Seattle", level: "club", condition: "Good", listingType: "trade", shippingPreference: "seller-pays", photos: [photo(id)], createdAt: yesterday, ...extra });
  await db.insert(s.objectUploads).values({ id: `o_${id}`, ownerUserId: owner, objectKey: `uploads/${id}.jpg`, publicUrl: photo(id), contentType: "image/jpeg", byteSize: 2000, claimedAt: yesterday });
}
let fetchCalls = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error("Unexpected external request in test"); };
try {
  await db.insert(s.users).values([
    { id: "u_socialone", email: "one@example.invalid", username: "socialone", displayName: "One", socialSharingAllowed: true },
    { id: "u_socialtwo", email: "two@example.invalid", username: "socialtwo", displayName: "Two", socialSharingAllowed: true },
    { id: "u_private", email: "private@example.invalid", username: "private", displayName: "Private" },
  ]);
  await item("l_socialone"); await item("l_socialtwo", "u_socialtwo"); await item("l_private", "u_private");
  await check("consent, ownership, moderation, and photo allowlist are required", async () => {
    assert.ok(await social.loadSocialSource(db, "listing", "l_socialone"));
    assert.equal(await social.loadSocialSource(db, "listing", "l_private"), null);
    await db.update(s.listings).set({ hiddenAt: now }).where(eq(s.listings.id, "l_socialone"));
    assert.equal(await social.loadSocialSource(db, "listing", "l_socialone"), null);
    await db.update(s.listings).set({ hiddenAt: null, photos: [photo("l_socialtwo")] }).where(eq(s.listings.id, "l_socialone"));
    assert.equal(await social.loadSocialSource(db, "listing", "l_socialone"), null);
    await db.update(s.listings).set({ photos: ["https://127.0.0.1/secret"] }).where(eq(s.listings.id, "l_socialone"));
    assert.equal(await social.loadSocialSource(db, "listing", "l_socialone"), null);
    await db.update(s.listings).set({ photos: [photo("l_socialone")] }).where(eq(s.listings.id, "l_socialone"));
    await db.update(s.users).set({ status: "banned" }).where(eq(s.users.id, "u_socialone"));
    assert.equal(await social.loadSocialSource(db, "listing", "l_socialone"), null);
    await db.update(s.users).set({ status: "active" }).where(eq(s.users.id, "u_socialone"));
  });
  await check("sample owners and sample listings are excluded even with genuine uploaded photos", async () => {
    await db.insert(s.sampleBatches).values({ id: "samples_social", name: "Isolated samples", state: "published", publishedAt: yesterday, expiresAt: new Date(Date.now() + 86400000), createdBy: "u_socialone" });
    await db.update(s.users).set({ sampleBatchId: "samples_social" }).where(eq(s.users.id, "u_socialone"));
    assert.equal(await social.loadSocialSource(db, "listing", "l_socialone"), null);
    await db.update(s.users).set({ sampleBatchId: null }).where(eq(s.users.id, "u_socialone"));
    await db.update(s.listings).set({ sampleBatchId: "samples_social" }).where(eq(s.listings.id, "l_socialone"));
    assert.equal(await social.loadSocialSource(db, "listing", "l_socialone"), null);
    await db.update(s.listings).set({ sampleBatchId: null }).where(eq(s.listings.id, "l_socialone"));
  });
  await check("completed deals require a real public Haul and permission from both sides", async () => {
    await db.insert(s.deals).values({ id: "d_social", kind: "trade", listingId: "l_socialone", proposerId: "u_socialtwo", ownerId: "u_socialone", status: "completed", threadId: "t_social", completedAt: yesterday });
    await db.insert(s.haulPosts).values({ id: "h_social", dealId: "d_social", kind: "trade", proposerId: "u_socialtwo", ownerId: "u_socialone", sharedBy: "u_socialone", proposerSide: { items: [{ listingId: "l_socialtwo", title: "Two" }], cash: 0 }, ownerSide: { items: [{ listingId: "l_socialone", title: "One" }], cash: 0 }, createdAt: yesterday });
    assert.ok(await social.loadSocialSource(db, "haul", "h_social"));
    await db.update(s.users).set({ socialSharingAllowed: false }).where(eq(s.users.id, "u_socialtwo"));
    assert.equal(await social.loadSocialSource(db, "haul", "h_social"), null);
    await db.update(s.users).set({ socialSharingAllowed: true }).where(eq(s.users.id, "u_socialtwo"));
    await db.update(s.listings).set({ hiddenAt: now }).where(eq(s.listings.id, "l_socialtwo"));
    assert.equal(await social.loadSocialSource(db, "haul", "h_social"), null);
    await db.update(s.listings).set({ hiddenAt: null }).where(eq(s.listings.id, "l_socialtwo"));
    await db.update(s.haulPosts).set({ hidden: true }).where(eq(s.haulPosts.id, "h_social"));
    assert.equal(await social.loadSocialSource(db, "haul", "h_social"), null);
    await db.update(s.haulPosts).set({ hidden: false }).where(eq(s.haulPosts.id, "h_social"));
    await db.update(s.haulPosts).set({ sampleBatchId: "samples_social" }).where(eq(s.haulPosts.id, "h_social"));
    assert.equal(await social.loadSocialSource(db, "haul", "h_social"), null);
    await db.update(s.haulPosts).set({ sampleBatchId: null }).where(eq(s.haulPosts.id, "h_social"));
  });
  let draft;
  await check("period generation is deterministic/idempotent and drafts need no API credentials", async () => {
    assert.equal((await social.generateSocialDraft(db, "daily", yesterday)).id, null);
    const first = await social.generateSocialDraft(db, "daily", now);
    const second = await social.generateSocialDraft(db, "daily", now);
    assert.equal(first.id, second.id); assert.equal(second.reused, true);
    [draft] = await db.select().from(socialPosts).where(eq(socialPosts.id, first.id));
    assert.equal(draft.status, "draft"); assert.equal(draft.sources[0].kind, "haul"); assert.equal(draft.sources.some((source) => source.id === "l_private"), false);
    assert.ok(await social.socialImagePost(db, draft.id, draft.imageToken));
    assert.equal(await social.socialImagePost(db, draft.id, "a".repeat(36)), null);
  });
  await check("changed sources invalidate image/publication and safe refresh revokes old image links", async () => {
    const token = draft.imageToken;
    await db.update(s.listings).set({ title: "Updated real title" }).where(eq(s.listings.id, "l_socialone"));
    assert.equal(await social.validateSocialPost(db, draft), null);
    assert.equal(await social.socialImagePost(db, draft.id, token), null);
    await db.update(socialPosts).set({ status: "cancelled" }).where(eq(socialPosts.id, draft.id));
    [draft] = await db.select().from(socialPosts).where(eq(socialPosts.id, draft.id));
    assert.equal(await social.refreshSocialDraft(db, draft), true);
    [draft] = await db.select().from(socialPosts).where(eq(socialPosts.id, draft.id));
    assert.equal(draft.status, "draft"); assert.notEqual(token, draft.imageToken); assert.equal(draft.containerId, null);
    assert.equal(await social.socialImagePost(db, draft.id, token), null);
    assert.ok(await social.validateSocialPost(db, draft));
  });
  await check("renders a real 1080×1350 JPEG and rejects revoked image access", async () => {
    const sharp = (await import("sharp")).default;
    const bytes = await readFile("public/images/jersey-1.jpg");
    globalThis.fetch = async (input) => {
      assert.match(String(input), /^https:\/\/store_socialtest\.public\.blob\.vercel-storage\.com\/uploads\//);
      return new Response(bytes, { headers: { "Content-Type": "image/jpeg" } });
    };
    const { GET } = await import("../app/api/social/[id]/image/route.tsx");
    const response = await GET(new Request(social.socialImageUrl(draft)), { params: Promise.resolve({ id: draft.id }) });
    assert.equal(response.status, 200); assert.equal(response.headers.get("content-type"), "image/jpeg");
    const image = Buffer.from(await response.arrayBuffer());
    const metadata = await sharp(image).metadata();
    assert.equal(metadata.width, 1080); assert.equal(metadata.height, 1350); assert.equal(metadata.format, "jpeg");
    if (process.env.SOCIAL_TEST_IMAGE_PATH) await writeFile(process.env.SOCIAL_TEST_IMAGE_PATH, image);
    const one = { ...draft, sources: [draft.sources[0]], sourceFingerprint: social.sourceFingerprint([draft.sources[0]]) };
    await db.update(socialPosts).set({ sources: one.sources, sourceFingerprint: one.sourceFingerprint }).where(eq(socialPosts.id, draft.id));
    const singleResponse = await GET(new Request(social.socialImageUrl(draft)), { params: Promise.resolve({ id: draft.id }) });
    const singleImage = Buffer.from(await singleResponse.arrayBuffer());
    assert.equal((await sharp(singleImage).metadata()).height, 1350);
    if (process.env.SOCIAL_TEST_IMAGE_PATH) await writeFile(process.env.SOCIAL_TEST_IMAGE_PATH.replace(/\.jpg$/, "-single.jpg"), singleImage);
    await db.update(socialPosts).set({ sources: draft.sources, sourceFingerprint: draft.sourceFingerprint }).where(eq(socialPosts.id, draft.id));
    await db.update(s.users).set({ socialSharingAllowed: false }).where(eq(s.users.id, "u_socialone"));
    const revoked = await GET(new Request(social.socialImageUrl(draft)), { params: Promise.resolve({ id: draft.id }) });
    assert.equal(revoked.status, 404);
    await db.update(s.users).set({ socialSharingAllowed: true }).where(eq(s.users.id, "u_socialone"));
    globalThis.fetch = async () => { throw new Error("Unexpected external request in test"); };
  });
  await check("pause and absent credentials never make an external request", async () => {
    assert.equal((await social.processSocialPublishing()).paused, true);
    await db.update(socialSettings).set({ paused: false }).where(eq(socialSettings.id, "instagram"));
    assert.equal((await social.processSocialPublishing()).configured, false);
  });
  await check("ambiguous publication persists a review barrier and cannot be retried", async () => {
    process.env.INSTAGRAM_ACCOUNT_ID = "999"; process.env.INSTAGRAM_ACCESS_TOKEN = "test-token"; process.env.INSTAGRAM_API_VERSION = "v26.0";
    await db.update(socialPosts).set({ status: "scheduled", scheduledAt: new Date(Date.now() - 1000), approvedAt: now, approvedBy: "u_socialone" }).where(eq(socialPosts.id, draft.id));
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input)); fetchCalls.push(url.pathname);
      assert.equal(url.hostname, "graph.instagram.com"); assert.equal(url.searchParams.has("access_token"), false); assert.equal(init.headers.Authorization, "Bearer test-token");
      if (url.pathname.endsWith("/media_publish")) throw new Error("connection lost after remote accepted request");
      return Response.json(url.pathname.endsWith("/media") ? { id: "1001" } : { status_code: "FINISHED" });
    };
    await social.processSocialPublishing(); await social.processSocialPublishing();
    [draft] = await db.select().from(socialPosts).where(eq(socialPosts.id, draft.id));
    assert.equal(draft.status, "review"); assert.ok(draft.publishAttemptedAt); assert.equal(draft.containerId, "1001");
    assert.equal(fetchCalls.filter((url) => url.endsWith("/media_publish")).length, 1);
    assert.equal(await social.refreshSocialDraft(db, draft), false);
    await db.update(socialPosts).set({ status: "cancelled" }).where(eq(socialPosts.id, draft.id));
    [draft] = await db.select().from(socialPosts).where(eq(socialPosts.id, draft.id));
    assert.equal(await social.refreshSocialDraft(db, draft), false);
  });
  await check("expired publish leases require review, expired preparation can safely resume", async () => {
    await db.update(socialPosts).set({ status: "publishing", leaseUntil: new Date(0) }).where(eq(socialPosts.id, draft.id));
    await social.recoverSocialLeases(db);
    [draft] = await db.select().from(socialPosts).where(eq(socialPosts.id, draft.id)); assert.equal(draft.status, "review");
    const another = await social.generateSocialDraft(db, "custom", now, 2);
    await db.update(socialPosts).set({ status: "preparing", leaseUntil: new Date(0), leaseToken: "expired", scheduledAt: new Date(0) }).where(eq(socialPosts.id, another.id));
    await social.recoverSocialLeases(db);
    const [resumed] = await db.select().from(socialPosts).where(eq(socialPosts.id, another.id));
    assert.equal(resumed.status, "scheduled"); assert.equal(resumed.publishAttemptedAt, null);
    globalThis.fetch = async (input) => {
      const url = new URL(String(input)); fetchCalls.push(url.pathname);
      if (url.pathname.endsWith("/media_publish")) throw new Error("Must not publish a container Meta says is already published");
      return Response.json(url.pathname.endsWith("/media") ? { id: "2002" } : { status_code: "PUBLISHED" });
    };
    await social.processSocialPublishing();
    const [alreadyPublished] = await db.select().from(socialPosts).where(eq(socialPosts.id, another.id));
    assert.equal(alreadyPublished.status, "review"); assert.ok(alreadyPublished.publishAttemptedAt);
  });
  console.log(`SOCIAL PUBLISHING SMOKE: all ${passed} checks passed`);
} finally { globalThis.fetch = originalFetch; await rm(directory, { recursive: true, force: true }); }
