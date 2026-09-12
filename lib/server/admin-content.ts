import "server-only";

import { and, eq, sql, type SQL } from "drizzle-orm";
import type { AdminContentPage, AdminContentRow, AdminMemberDetail, ContentAction, ContentKind, ContentQuery } from "../admin-types";
import type { SessionUser } from "./auth";
import { getDb, type Db } from "./db";
import { recordAdminAudit } from "./audit";
import { deleteAccount } from "./account";
import { recomputeReputation } from "./engine-effects";
import { sampleVisible } from "./sample-visibility";
import { deals, haulComments, haulPosts, isoPosts, listings, listingViews, offers, ratings, saves, users } from "./schema";

const sources: Record<ContentKind, SQL> = {
  listing: sql`select id, title, description as body, seller_id as user_id, status as state, hidden_at is not null as hidden, sample_batch_id, created_at, photos->>0 as photo from listings`,
  wanted: sql`select p.id, coalesce(p.team, 'Wanted post') as title, p.description as body, p.user_id, p.status as state, p.hidden_at is not null as hidden, u.sample_batch_id, p.created_at, null::text as photo from iso_posts p join users u on u.id = p.user_id`,
  rating: sql`select id, 'Rating' as title, coalesce(comment, '') as body, from_user_id as user_id, 'published' as state, hidden_at is not null as hidden, sample_batch_id, created_at, null::text as photo from ratings`,
  haul: sql`select id, 'Completed exchange' as title, coalesce(note, '') as body, shared_by as user_id, 'published' as state, hidden, sample_batch_id, created_at, owner_side->'items'->0->>'photo' as photo from haul_posts`,
  comment: sql`select c.id, 'Haul comment' as title, c.body, c.user_id, 'published' as state, c.hidden, u.sample_batch_id, c.created_at, null::text as photo from haul_comments c join users u on u.id = c.user_id`,
};

export async function queryAdminContent(input: ContentQuery): Promise<AdminContentPage> {
  const db = await getDb();
  const kind = Object.hasOwn(sources, input.kind) ? input.kind : "listing";
  const page = Number.isInteger(input.page) ? Math.max(1, Math.min(input.page!, 100_000)) : 1;
  const pageSize = 20;
  const visibility = sql`(not c.hidden and c.state not in ('removed', 'closed') and u.status = 'active' and u.deleted_at is null and ${sampleVisible(sql`c.sample_batch_id`)})`;
  const filters: SQL[] = [sql`true`];
  if (input.query?.trim()) {
    const term = `%${input.query.trim().slice(0, 100).replace(/[\\%_]/g, "\\$&")}%`;
    filters.push(sql`(c.title ilike ${term} or c.body ilike ${term} or c.id ilike ${term} or u.username ilike ${term})`);
  }
  if (input.scope === "real") filters.push(sql`c.sample_batch_id is null`);
  if (input.scope === "sample") filters.push(sql`c.sample_batch_id is not null`);
  if (input.visibility === "visible") filters.push(visibility);
  if (input.visibility === "hidden") filters.push(sql`not ${visibility}`);
  const base = sql`from (${sources[kind]}) c left join users u on u.id = c.user_id where ${sql.join(filters, sql` and `)}`;
  const result = await db.execute(sql`select c.*, u.username, ${visibility} as visible ${base} order by c.created_at desc, c.id desc limit ${pageSize} offset ${(page - 1) * pageSize}`) as { rows: Record<string, unknown>[] };
  const count = await db.execute(sql`select count(*)::int as n ${base}`) as { rows: { n: number }[] };
  const items: AdminContentRow[] = (result.rows as Record<string, unknown>[]).map((r) => ({ id: String(r.id), kind,
    title: String(r.title), body: String(r.body), userId: String(r.user_id), username: r.username ? String(r.username) : null,
    state: String(r.state), hidden: Boolean(r.hidden), visible: Boolean(r.visible), sampleBatchId: r.sample_batch_id ? String(r.sample_batch_id) : null,
    createdAt: new Date(String(r.created_at)).toISOString(), photo: r.photo ? String(r.photo) : null,
  }));
  return { items, total: Number((count.rows[0] as { n: number }).n), page, pageSize };
}

export async function moderateContent(db: Db, actor: SessionUser, input: { kind: ContentKind; id: string; action: ContentAction; confirm?: string; note: string }) {
  if (!actor.isAdmin) return { ok: false as const, error: "Moderators only" };
  if (!Object.hasOwn(sources, input.kind) || !["hide", "restore", "delete"].includes(input.action) || typeof input.id !== "string" || input.id.length > 100) return { ok: false as const, error: "Invalid moderation target." };
  if (typeof input.note !== "string" || input.note.trim().length < 10 || input.note.length > 2000) return { ok: false as const, error: "Add a reason of 10–2,000 characters." };
  if (input.action === "delete" && input.confirm !== `DELETE ${input.id}`) return { ok: false as const, error: "Type DELETE followed by the exact record ID." };
  return db.transaction(async (tx) => {
    const { id, kind, action } = input;
    const table = { listing: listings, wanted: isoPosts, rating: ratings, haul: haulPosts, comment: haulComments }[kind];
    const found = await tx.execute(sql`select id from ${table} where id = ${id} for update`) as { rows: { id: string }[] };
    if (!found.rows.length) return { ok: false as const, error: "Content not found. It may already have been deleted." };
    if (action === "delete" && kind === "listing") {
      const involved = await tx.select({ id: deals.id }).from(deals).where(eq(deals.listingId, id)).limit(1);
      const offered = await tx.select({ id: offers.id }).from(offers).where(sql`${offers.proposerListingIds} @> ${JSON.stringify([id])}::jsonb or ${offers.ownerListingIds} @> ${JSON.stringify([id])}::jsonb`).limit(1);
      if (involved.length || offered.length) return { ok: false as const, error: "This listing is part of a deal. Hide it to preserve the transaction record, or delete its entire sample batch." };
      await tx.delete(saves).where(and(eq(saves.targetType, "listing"), eq(saves.targetId, id)));
      await tx.delete(listingViews).where(eq(listingViews.listingId, id));
    }
    if (action === "delete" && kind === "wanted") await tx.delete(saves).where(and(eq(saves.targetType, "iso"), eq(saves.targetId, id)));
    const [rating] = kind === "rating" ? await tx.select({ toUserId: ratings.toUserId }).from(ratings).where(eq(ratings.id, id)) : [];
    if (action === "delete") await tx.execute(sql`delete from ${table} where id = ${id}`);
    else if (kind === "haul" || kind === "comment") await tx.execute(sql`update ${table} set hidden = ${action === "hide"} where id = ${id}`);
    else {
      if (kind === "listing" && action === "restore") {
        const [listing] = await tx.select({ status: listings.status }).from(listings).where(eq(listings.id, id));
        if (listing.status === "removed") return { ok: false as const, error: "Removed listings are closed. Hiding is reversible; removal cannot reopen closed negotiations." };
      }
      await tx.execute(sql`update ${table} set hidden_at = ${action === "hide" ? new Date() : null} where id = ${id}`);
      if (kind === "listing") await tx.update(listings).set({ moderationReason: input.note.trim(), updatedAt: new Date() }).where(eq(listings.id, id));
    }
    if (rating) await recomputeReputation(tx, rating.toUserId);
    await recordAdminAudit(tx, actor, `content.${action}`, { type: kind, id }, { note: input.note.trim() });
    return { ok: true as const };
  });
}

export async function closeMemberAccount(db: Db, actor: SessionUser, input: { userId: string; confirm: string; note: string }) {
  if (!actor.isAdmin) return { ok: false as const, error: "Moderators only" };
  if (typeof input.note !== "string" || input.note.trim().length < 20 || input.note.length > 2000) return { ok: false as const, error: "Add a reason of 20–2,000 characters." };
  return db.transaction(async (tx) => {
    const [target] = await tx.select().from(users).where(eq(users.id, input.userId)).for("update");
    if (!target || target.deletedAt) return { ok: false as const, error: "Account not found." };
    if (target.isAdmin || target.id === actor.id) return { ok: false as const, error: "Moderator accounts cannot be deleted here." };
    if (target.sampleBatchId) return { ok: false as const, error: "Use the sample-batch controls to delete example accounts and their connected history together." };
    const result = await deleteAccount(target.id, input.confirm, tx);
    if (result.ok) await recordAdminAudit(tx, actor, "member.erase", { type: "user", id: target.id }, { username: target.username, note: input.note.trim() });
    return result;
  });
}

export async function getAdminMemberDetail(id: string): Promise<AdminMemberDetail | null> {
  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.id, id));
  if (!user) return null;
  const counts = await db.execute(sql`select
    (select count(*)::int from listings where seller_id = ${id}) as listings,
    (select count(*)::int from listings where seller_id = ${id} and status = 'active' and hidden_at is null) as active,
    (select count(*)::int from deals where (proposer_id = ${id} or owner_id = ${id}) and status = 'completed') as completed,
    (select count(*)::int from deals where (proposer_id = ${id} or owner_id = ${id}) and status in ('open','accepted','disputed')) as flight,
    (select count(*)::int from messages where sender_id = ${id} and kind = 'text') as messages,
    (select count(*)::int from ratings where to_user_id = ${id} and hidden_at is null) as ratings,
    (select count(*)::int from reports where target_type = 'user' and target_id = ${id}) as reports`) as { rows: Record<string, number>[] };
  const c = counts.rows[0] as Record<string, number>;
  const events = await db.execute(sql`select name, count(*)::int as count from product_events where user_id = ${id} group by name order by name`) as { rows: { name: string; count: number }[] };
  const recent = await db.execute(sql`select name, created_at, subject_id from product_events where user_id = ${id} order by created_at desc limit 20`) as { rows: { name: string; created_at: Date | string; subject_id: string | null }[] };
  return { id, username: user.username, sampleBatchId: user.sampleBatchId, joinedAt: user.memberSince.toISOString(), lastActiveAt: user.lastActiveAt?.toISOString() ?? null,
    listings: Number(c.listings), activeListings: Number(c.active), completedDeals: Number(c.completed), inFlightDeals: Number(c.flight), messagesSent: Number(c.messages), ratingsReceived: Number(c.ratings), reportsReceived: Number(c.reports),
    events: events.rows as { name: string; count: number }[], recentEvents: (recent.rows as { name: string; created_at: Date | string; subject_id: string | null }[]).map((r) => ({ name: r.name, createdAt: new Date(r.created_at).toISOString(), subjectId: r.subject_id })),
  };
}
