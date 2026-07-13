import "server-only";

import { sql } from "drizzle-orm";
import { type Db } from "./db";
import { rateLimits } from "./schema";

/**
 * Fixed-window rate limit. Atomically increments the counter for `bucket`
 * (e.g. `u:<userId>:listing` or `ip:<ip>:magiclink`) in a single upsert and
 * returns true while still within `limit` for the current `windowSec` window.
 *
 * Safe inside a transaction — pass the tx as `db` and a rolled-back op won't
 * consume quota.
 */
export async function underRateLimit(
  db: Db,
  bucket: string,
  limit: number,
  windowSec: number,
): Promise<boolean> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowSec * 1000);
  const [row] = await db
    .insert(rateLimits)
    .values({ bucket, count: 1, resetAt })
    .onConflictDoUpdate({
      target: rateLimits.bucket,
      set: {
        // Reset the window if it has elapsed, otherwise increment in place.
        count: sql`case when ${rateLimits.resetAt} < ${now} then 1 else ${rateLimits.count} + 1 end`,
        resetAt: sql`case when ${rateLimits.resetAt} < ${now} then ${resetAt} else ${rateLimits.resetAt} end`,
      },
    })
    .returning({ count: rateLimits.count });
  return (row?.count ?? 1) <= limit;
}
