import "server-only";

import { sql, type SQLWrapper } from "drizzle-orm";
import type { Db } from "./db";
import { sampleBatches } from "./schema";

/** A hidden/expired batch disappears on the next read, even if cron is delayed. */
export function sampleVisible(column: SQLWrapper) {
  return sql`(${column} is null or exists (select 1 from sample_batches sb where sb.id = ${column} and sb.state = 'published' and sb.expires_at > now()))`;
}

export async function visibleSampleBatchIds(db: Db): Promise<Set<string>> {
  const rows = await db.select({ id: sampleBatches.id }).from(sampleBatches)
    .where(sql`${sampleBatches.state} = 'published' and ${sampleBatches.expiresAt} > now()`);
  return new Set(rows.map((row) => row.id));
}
