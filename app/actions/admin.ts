"use server";

import { desc, eq, sql } from "drizzle-orm";
import type { ContentQuery } from "@/lib/admin-types";
import { queryAdminContent, getAdminMemberDetail } from "@/lib/server/admin-content";
import { readSessionContext } from "@/lib/server/session";
import { getDb } from "@/lib/server/db";
import { adminAuditEvents, sampleBatches } from "@/lib/server/schema";
import { samplePlan } from "@/lib/server/sample-batches";

async function authorized() {
  const ctx = await readSessionContext();
  return !!ctx?.realUser.isAdmin && ctx.realUser.status === "active" && ctx.effectiveUser.id === ctx.realUser.id;
}

export async function fetchAdminContent(input: ContentQuery) {
  if (!await authorized()) return { error: "Moderators only" };
  return queryAdminContent(input);
}

export async function fetchAdminMember(id: string) {
  if (!await authorized()) return { error: "Moderators only" };
  return { member: await getAdminMemberDetail(id) };
}

export async function fetchAdminSamples() {
  if (!await authorized()) return { error: "Moderators only" };
  const db = await getDb();
  const rows = await db.select().from(sampleBatches).orderBy(desc(sampleBatches.publishedAt));
  return { plan: samplePlan(), batches: rows.map((b) => ({ ...b, publishedAt: b.publishedAt.toISOString(), expiresAt: b.expiresAt.toISOString(), archivedAt: b.archivedAt?.toISOString() ?? null })) };
}

export async function fetchAdminAudit(page = 1, targetId?: string) {
  if (!await authorized()) return { error: "Moderators only" };
  const db = await getDb();
  const boundedPage = Number.isInteger(page) ? Math.max(1, Math.min(page, 100_000)) : 1;
  const filter = targetId?.trim() ? eq(adminAuditEvents.targetId, targetId.trim().slice(0, 100)) : undefined;
  const [rows, [total]] = await Promise.all([
    db.select().from(adminAuditEvents).where(filter).orderBy(desc(adminAuditEvents.createdAt), desc(adminAuditEvents.id)).limit(25).offset((boundedPage - 1) * 25),
    db.select({ n: sql<number>`count(*)::int` }).from(adminAuditEvents).where(filter),
  ]);
  return { items: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })), page: boundedPage, total: total.n };
}
