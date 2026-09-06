import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { flushEmailOutbox } from "@/lib/server/email";
import { log, logError } from "@/lib/server/logger";
import { cleanupAbandonedUploads } from "@/lib/server/storage";

export const dynamic = "force-dynamic";

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || secret.length < 32 || secret.length !== supplied.length) return false;
  return timingSafeEqual(Buffer.from(secret), Buffer.from(supplied));
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  try {
    const result = await flushEmailOutbox(50);
    const abandonedUploadsDeleted = await cleanupAbandonedUploads(100);
    log("info", "background.worker.completed", { ...result, abandonedUploadsDeleted });
    return NextResponse.json({ ok: true, ...result, abandonedUploadsDeleted }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logError("email.worker.failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
