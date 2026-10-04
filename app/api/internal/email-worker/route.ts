import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { flushEmailOutbox } from "@/lib/server/email";
import { log, logError } from "@/lib/server/logger";
import { cleanupAbandonedUploads } from "@/lib/server/storage";
import { expireSampleBatches } from "@/lib/server/sample-batches";
import { processSocialPublishing } from "@/lib/server/social-publishing";
import { recomputeTrust } from "@/lib/server/trust";
import { getDb } from "@/lib/server/db";

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
    const sampleBatchesExpired = await expireSampleBatches(await getDb());
    // Isolate optional community work from email delivery and upload cleanup.
    let communityWorkOk = true;
    try { await recomputeTrust(await getDb()); }
    catch (error) { communityWorkOk = false; logError("trust.worker.failed", error); }
    try { await processSocialPublishing(); }
    catch (error) { communityWorkOk = false; logError("social.worker.failed", error); }
    log("info", "background.worker.completed", { ...result, abandonedUploadsDeleted, sampleBatchesExpired, communityWorkOk });
    return NextResponse.json({ ok: true, ...result, abandonedUploadsDeleted, sampleBatchesExpired, communityWorkOk }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logError("email.worker.failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
