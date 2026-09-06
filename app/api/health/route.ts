import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import { logError } from "@/lib/server/logger";
import { emailOutbox, objectUploads } from "@/lib/server/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  try {
    const db = await getDb();
    const [, [background]] = await Promise.all([
      db.execute(sql`select 1`),
      db.select({
        deadEmails: sql<number>`count(*) filter (where ${emailOutbox.deadLetteredAt} is not null)::int`,
        staleEmails: sql<number>`count(*) filter (where ${emailOutbox.sentAt} is null and ${emailOutbox.deadLetteredAt} is null and ${emailOutbox.createdAt} < now() - interval '15 minutes')::int`,
        staleUploads: sql<number>`(select count(*)::int from ${objectUploads} where ${objectUploads.claimedAt} is null and ${objectUploads.deletedAt} is null and ${objectUploads.createdAt} < now() - interval '25 hours')`,
      }).from(emailOutbox),
    ]);
    const delivery = Number(background?.deadEmails ?? 0) > 0 || Number(background?.staleEmails ?? 0) > 0 ? "degraded" : "ok";
    const uploadCleanup = Number(background?.staleUploads ?? 0) > 0 ? "degraded" : "ok";
    const status = delivery === "ok" && uploadCleanup === "ok" ? "ok" : "degraded";
    return NextResponse.json(
      { status, checks: { database: "ok", emailDelivery: delivery, uploadCleanup }, latencyMs: Date.now() - startedAt, timestamp: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    logError("health.failed", error);
    return NextResponse.json(
      { status: "unavailable", checks: { database: "unavailable" }, timestamp: new Date().toISOString() },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
