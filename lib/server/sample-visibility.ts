import "server-only";

import { sql, type SQLWrapper } from "drizzle-orm";
import type { Db } from "./db";
/** Fictional records are always private, regardless of legacy publication state. */
export function sampleVisible(column: SQLWrapper) {
  return sql`${column} is null`;
}

export async function visibleSampleBatchIds(_db: Db): Promise<Set<string>> {
  return new Set();
}
