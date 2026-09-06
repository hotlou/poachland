import "server-only";

import { randomBytes } from "node:crypto";
import { adminAuditEvents } from "./schema";
import type { SessionUser } from "./auth";
import type { Db } from "./db";

export type AuditTarget = { type?: string; id?: string };

/** Append-only by convention: this module deliberately exports no update/delete API. */
export async function recordAdminAudit(
  db: Db,
  actor: SessionUser,
  action: string,
  target: AuditTarget = {},
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await db.insert(adminAuditEvents).values({
    id: `aud_${Date.now().toString(36)}${randomBytes(5).toString("hex")}`,
    actorUserId: actor.id,
    actorUsername: actor.username,
    action,
    targetType: target.type,
    targetId: target.id,
    metadata,
  });
}
