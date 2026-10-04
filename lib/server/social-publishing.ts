import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, gte, inArray, isNotNull, isNull, lt, lte, or } from "drizzle-orm";
import type { Db } from "./db";
import { getDb } from "./db";
import { deals, haulPosts, listings, objectUploads, offers, users } from "./schema";
import { socialPosts, socialSettings } from "./social-schema";
import { isAllowedImageReference } from "../image-reference";
import { publicUrl } from "../sharing";
import { socialCaption, socialScore, socialWindow, type SocialAdminData, type SocialCadence, type SocialSource } from "../social-types";
import { createInstagramContainer, instagramConnection, instagramContainerStatus, publishInstagramContainer } from "./instagram";

type Post = typeof socialPosts.$inferSelect;
type Member = typeof users.$inferSelect;
const randomId = () => randomBytes(18).toString("hex");

function realMember(member: Member | undefined) {
  return !!member && !member.sampleBatchId && !member.deletedAt && member.status === "active" && member.socialSharingAllowed;
}
async function consentingMembers(db: Db, ids: string[]) {
  if (!ids.length) return false;
  const members = await db.select().from(users).where(inArray(users.id, ids));
  if (members.length !== ids.length || !members.every(realMember)) return false;
  const managerIds = [...new Set(members.map((m) => m.managedByUserId).filter((id): id is string => !!id))];
  if (!managerIds.length) return true;
  const managers = await db.select().from(users).where(inArray(users.id, managerIds));
  return managers.length === managerIds.length && managers.every((m) => !m.sampleBatchId && !m.deletedAt && m.status === "active" && m.isAdmin);
}

/** Promotion only uses current, claimed images owned by the actual listing seller. */
async function ownedPhoto(db: Db, sellerId: string, photos: string[]) {
  for (const photo of photos.slice(0, 10)) {
    if (!photo.startsWith("https://") || !isAllowedImageReference(photo, process.env.BLOB_STORE_ID)) continue;
    const [upload] = await db.select({ id: objectUploads.id }).from(objectUploads).where(and(
      eq(objectUploads.publicUrl, photo), eq(objectUploads.ownerUserId, sellerId), isNull(objectUploads.deletedAt), isNotNull(objectUploads.claimedAt),
    )).limit(1);
    if (upload) return photo;
  }
  return null;
}

export async function loadSocialSource(db: Db, kind: SocialSource["kind"], id: string): Promise<SocialSource | null> {
  if (kind === "listing") {
    const [item] = await db.select().from(listings).where(eq(listings.id, id)).limit(1);
    if (!item || item.status !== "active" || item.hiddenAt || item.sampleBatchId || !await consentingMembers(db, [item.sellerId])) return null;
    const photo = await ownedPhoto(db, item.sellerId, item.photos);
    if (!photo) return null;
    return { kind, id, title: item.title, photo, url: publicUrl(`/l/${item.id}`), ownerIds: [item.sellerId], listingIds: [item.id], occurredAt: item.createdAt.toISOString(), score: socialScore(kind, item.views, item.saves) };
  }
  const [haul] = await db.select().from(haulPosts).where(eq(haulPosts.id, id)).limit(1);
  if (!haul || haul.hidden || haul.sampleBatchId) return null;
  const [deal] = await db.select().from(deals).where(eq(deals.id, haul.dealId)).limit(1);
  if (!deal || deal.status !== "completed" || deal.sampleBatchId || !deal.completedAt || deal.ownerId !== haul.ownerId || deal.proposerId !== haul.proposerId) return null;
  const participants = [...new Set([deal.ownerId, deal.proposerId])];
  if (!await consentingMembers(db, participants)) return null;
  const accepted = await db.select().from(offers).where(and(eq(offers.dealId, deal.id), eq(offers.status, "accepted")));
  const sides = [...haul.proposerSide.items, ...haul.ownerSide.items];
  // A public story without resolvable source records is not evidence for a marketing claim.
  if (!sides.length || sides.some((item) => !item.listingId)) return null;
  const ids = [...new Set([deal.listingId, ...sides.map((item) => item.listingId!), ...accepted.flatMap((offer) => [...offer.proposerListingIds, ...offer.ownerListingIds])])];
  const items = await db.select().from(listings).where(inArray(listings.id, ids));
  if (items.length !== ids.length || items.some((item) => item.sampleBatchId || item.hiddenAt || item.status === "removed" || !participants.includes(item.sellerId))) return null;
  const photos = await Promise.all(items.map((item) => ownedPhoto(db, item.sellerId, item.photos)));
  // Reject a linked item with missing/withdrawn photos instead of borrowing a different owner's photo.
  if (photos.some((photo) => !photo)) return null;
  const ordered = ids.map((itemId) => items.find((item) => item.id === itemId)!);
  const lead = ordered[0];
  return { kind, id, title: ordered.slice(0, 2).map((item) => item.title).join(" + "), photo: photos[items.indexOf(lead)]!, url: publicUrl("/haul"), ownerIds: participants, listingIds: ids, occurredAt: haul.createdAt.toISOString(), score: socialScore(kind) };
}

export function sourceFingerprint(sources: SocialSource[]) {
  // JSONB can reorder keys. Canonical fields also exclude changing popularity signals.
  return createHash("sha256").update(JSON.stringify(sources.map((source) => [source.kind, source.id, source.title, source.photo, source.url, [...source.ownerIds].sort(), [...source.listingIds].sort(), source.occurredAt]))).digest("hex");
}

export async function eligibleSocialSources(db: Db, start: Date, end: Date) {
  const [newListings, publicHauls] = await Promise.all([
    db.select({ id: listings.id }).from(listings).where(and(gte(listings.createdAt, start), lt(listings.createdAt, end), eq(listings.status, "active"), isNull(listings.sampleBatchId), isNull(listings.hiddenAt))).orderBy(desc(listings.createdAt), desc(listings.id)).limit(200),
    db.select({ id: haulPosts.id }).from(haulPosts).where(and(gte(haulPosts.createdAt, start), lt(haulPosts.createdAt, end), eq(haulPosts.hidden, false), isNull(haulPosts.sampleBatchId))).orderBy(desc(haulPosts.createdAt), desc(haulPosts.id)).limit(100),
  ]);
  const candidates: SocialSource[] = [];
  const references = [...newListings.map((item) => ({ ...item, kind: "listing" as const })), ...publicHauls.map((item) => ({ ...item, kind: "haul" as const }))];
  // Keep the remote pool bounded while reading independent source records in parallel.
  for (let offset = 0; offset < references.length; offset += 5) {
    const batch = await Promise.all(references.slice(offset, offset + 5).map((item) => loadSocialSource(db, item.kind, item.id)));
    candidates.push(...batch.filter((source): source is SocialSource => source !== null));
  }
  return candidates.sort((a, b) => b.score - a.score || b.occurredAt.localeCompare(a.occurredAt) || a.id.localeCompare(b.id)).slice(0, 3);
}

export async function getSocialSettings(db: Db) {
  await db.insert(socialSettings).values({ id: "instagram" }).onConflictDoNothing();
  const [settings] = await db.select().from(socialSettings).where(eq(socialSettings.id, "instagram"));
  return settings;
}

export async function generateSocialDraft(db: Db, cadence: SocialCadence, now = new Date(), days = 7, automatic = false) {
  const window = socialWindow(cadence, now, days);
  const [existing] = await db.select().from(socialPosts).where(eq(socialPosts.windowKey, window.key));
  if (existing) return { id: existing.id, reused: true };
  const sources = await eligibleSocialSources(db, window.start, window.end);
  if (!sources.length) return { id: null, reason: "No eligible real activity with photo permission in this period. Nothing was invented or queued." };
  const id = `social_${randomId()}`;
  const [created] = await db.insert(socialPosts).values({ id, cadence, windowKey: window.key, windowStart: window.start, windowEnd: window.end, sources, sourceFingerprint: sourceFingerprint(sources), caption: socialCaption(sources), imageToken: randomId(), status: automatic ? "scheduled" : "draft", scheduledAt: automatic ? now : null, approvedBy: automatic ? "automation" : null, approvedAt: automatic ? now : null }).onConflictDoNothing().returning({ id: socialPosts.id });
  if (created) return { id: created.id, reused: false };
  const [winner] = await db.select({ id: socialPosts.id }).from(socialPosts).where(eq(socialPosts.windowKey, window.key));
  return { id: winner?.id ?? null, reused: true };
}

export async function validateSocialPost(db: Db, post: Post) {
  if (!post.sources.length || post.sources.length > 3) return null;
  const sources: SocialSource[] = [];
  for (const source of post.sources) {
    const current = await loadSocialSource(db, source.kind, source.id);
    if (!current) return null;
    sources.push(current);
  }
  return sourceFingerprint(sources) === post.sourceFingerprint ? sources : null;
}

export async function refreshSocialDraft(db: Db, post: Post) {
  if (post.publishAttemptedAt || !["draft", "failed", "scheduled", "cancelled"].includes(post.status)) return false;
  const sources = await eligibleSocialSources(db, post.windowStart, post.windowEnd);
  if (!sources.length) return false;
  const [updated] = await db.update(socialPosts).set({ sources, sourceFingerprint: sourceFingerprint(sources), caption: socialCaption(sources), status: "draft", imageToken: randomId(), containerId: null, scheduledAt: null, approvedAt: null, approvedBy: null, error: null, updatedAt: new Date() }).where(and(eq(socialPosts.id, post.id), isNull(socialPosts.publishAttemptedAt), inArray(socialPosts.status, ["draft", "failed", "scheduled", "cancelled"]))).returning({ id: socialPosts.id });
  return !!updated;
}

export async function socialImagePost(db: Db, id: string, token: string) {
  if (!/^social_[a-f0-9]{36}$/.test(id) || !/^[a-f0-9]{36}$/.test(token)) return null;
  const [post] = await db.select().from(socialPosts).where(and(eq(socialPosts.id, id), eq(socialPosts.imageToken, token)));
  if (!post || post.status === "cancelled") return null;
  const sources = await validateSocialPost(db, post);
  return sources ? { ...post, sources } : null;
}

function socialImagePath(post: Pick<Post, "id" | "imageToken">) { return `/api/social/${post.id}/image?token=${post.imageToken}`; }
export function socialImageUrl(post: Pick<Post, "id" | "imageToken">) { return publicUrl(socialImagePath(post)); }

export async function getSocialAdminData(db: Db): Promise<SocialAdminData> {
  const settings = await getSocialSettings(db);
  const posts = await db.select().from(socialPosts).orderBy(desc(socialPosts.createdAt)).limit(50);
  return { settings: { paused: settings.paused, daily: settings.daily, weekly: settings.weekly, automatic: settings.automatic, hourUtc: settings.hourUtc }, connection: instagramConnection(), posts: posts.map((p) => ({ id: p.id, cadence: p.cadence, status: p.status, caption: p.caption, sources: p.sources, windowStart: p.windowStart.toISOString(), windowEnd: p.windowEnd.toISOString(), scheduledAt: p.scheduledAt?.toISOString() ?? null, publishedAt: p.publishedAt?.toISOString() ?? null, error: p.error, mediaId: p.mediaId, containerId: p.containerId, imageUrl: socialImagePath(p) })) };
}

/** Recover only work that cannot have published. An unknown publish outcome always needs review. */
export async function recoverSocialLeases(db: Db, now = new Date()) {
  await db.update(socialPosts).set({ status: "review", error: "Publication outcome is unknown. Check Instagram before resolving; automatic retry is disabled.", leaseUntil: null, leaseToken: null, updatedAt: now }).where(and(eq(socialPosts.status, "publishing"), lte(socialPosts.leaseUntil, now)));
  await db.update(socialPosts).set({ status: "scheduled", leaseUntil: null, leaseToken: null, updatedAt: now }).where(and(eq(socialPosts.status, "preparing"), lte(socialPosts.leaseUntil, now), isNull(socialPosts.publishAttemptedAt)));
}

export async function processSocialPublishing() {
  const db = await getDb();
  const now = new Date();
  const settings = await getSocialSettings(db);
  await recoverSocialLeases(db, now);
  if (settings.paused) return { paused: true, processed: 0 };
  const connected = instagramConnection().configured;
  if (now.getUTCHours() >= settings.hourUtc) {
    if (settings.daily) await generateSocialDraft(db, "daily", now, 1, settings.automatic && connected);
    if (settings.weekly) await generateSocialDraft(db, "weekly", now, 7, settings.automatic && connected);
  }
  if (!connected) return { configured: false, processed: 0 };
  const due = await db.select().from(socialPosts).where(and(eq(socialPosts.status, "scheduled"), lte(socialPosts.scheduledAt, now), isNull(socialPosts.publishAttemptedAt), or(isNull(socialPosts.leaseUntil), lt(socialPosts.leaseUntil, now)))).orderBy(socialPosts.scheduledAt).limit(2);
  let processed = 0;
  for (const candidate of due) {
    const lease = randomId();
    const [post] = await db.update(socialPosts).set({ status: "preparing", leaseToken: lease, leaseUntil: new Date(Date.now() + 120000), updatedAt: new Date() }).where(and(eq(socialPosts.id, candidate.id), eq(socialPosts.status, "scheduled"), isNull(socialPosts.publishAttemptedAt))).returning();
    if (!post) continue;
    const owned = and(eq(socialPosts.id, post.id), eq(socialPosts.leaseToken, lease));
    let attempted = false;
    try {
      if (!await validateSocialPost(db, post)) throw new Error("Source details, availability, moderation or photo permission changed. Cancel this draft and generate a fresh period.");
      let containerId = post.containerId;
      if (!containerId) {
        containerId = await createInstagramContainer(socialImageUrl(post), post.caption);
        const [saved] = await db.update(socialPosts).set({ containerId }).where(and(owned, eq(socialPosts.status, "preparing"))).returning({ id: socialPosts.id });
        if (!saved) continue;
      }
      const state = await instagramContainerStatus(containerId);
      if (state === "IN_PROGRESS") { await db.update(socialPosts).set({ status: "scheduled", scheduledAt: new Date(Date.now() + 60000), leaseUntil: null, leaseToken: null }).where(owned); continue; }
      if (state === "PUBLISHED") {
        await db.update(socialPosts).set({ status: "review", publishAttemptedAt: new Date(), error: "Instagram reports this container already published. Record its media ID after checking the account; automatic retry is disabled.", leaseUntil: null, leaseToken: null, updatedAt: new Date() }).where(owned);
        continue;
      }
      if (state !== "FINISHED") throw new Error(`Instagram container is ${state ?? "unknown"}; publication was not attempted.`);
      // Recheck both permissions and pause immediately before the only irreversible call.
      if ((await getSocialSettings(db)).paused) { await db.update(socialPosts).set({ status: "scheduled", leaseUntil: null, leaseToken: null }).where(owned); continue; }
      if (!await validateSocialPost(db, post)) throw new Error("Source permission or visibility changed before publication.");
      const [marked] = await db.update(socialPosts).set({ status: "publishing", publishAttemptedAt: new Date(), updatedAt: new Date() }).where(and(owned, eq(socialPosts.status, "preparing"), isNull(socialPosts.publishAttemptedAt))).returning({ id: socialPosts.id });
      if (!marked) continue;
      attempted = true;
      const mediaId = await publishInstagramContainer(containerId);
      await db.update(socialPosts).set({ status: "published", mediaId, publishedAt: new Date(), error: null, leaseToken: null, leaseUntil: null, updatedAt: new Date() }).where(owned);
      processed++;
    } catch (error) {
      // A database write can commit even when its response is lost. Trust the durable barrier.
      const [persisted] = await db.select({ attemptedAt: socialPosts.publishAttemptedAt, status: socialPosts.status }).from(socialPosts).where(owned);
      const uncertain = attempted || !!persisted?.attemptedAt || persisted?.status === "publishing";
      await db.update(socialPosts).set({ status: uncertain ? "review" : "failed", error: uncertain ? "Instagram may have published this post. Check the connected account and resolve manually; retry is disabled to prevent duplicates." : (error instanceof Error ? error.message : "Publishing failed before the publish request.").slice(0, 400), leaseUntil: null, leaseToken: null, updatedAt: new Date() }).where(owned);
    }
  }
  return { processed };
}
