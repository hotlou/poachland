/**
 * Notification inserts (server-only).
 *
 * Mirrors the client engine's `notify()` — same fields, server-generated ids.
 * Accepts either the root Db or a transaction handle (PgTransaction extends
 * PgDatabase, so both satisfy `Db`).
 */

import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import type { NotificationType } from "../types";
import { uid } from "./auth";
import type { Db } from "./db";
import { emailOutbox, notifications } from "./schema";
import { EMAIL_CATEGORY, emailDedupeKey } from "./email";

export interface NotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  linkTo?: string;
  createdAt?: Date;
}

/** Insert a batch of notifications in one statement. No-op on empty input. */
export async function insertNotifications(
  tx: Db,
  items: NotificationInput[],
): Promise<void> {
  if (items.length === 0) return;
  const now = new Date();
  await tx.insert(notifications).values(
    items.map((n) => ({
      id: uid("n"),
      userId: n.userId,
      type: n.type,
      title: n.title,
      body: n.body,
      read: false,
      createdAt: n.createdAt ?? now,
      linkTo: n.linkTo ?? null,
    })),
  );

  // Enqueue matching email intents in the same transaction. Delivery happens
  // after commit (flushEmailOutbox). Coalesce message emails per-thread.
  for (const n of items) {
    const category = EMAIL_CATEGORY[n.type];
    if (!category) continue;
    const dedupeKey = emailDedupeKey(n.type, n.linkTo);
    if (dedupeKey) {
      await tx
        .delete(emailOutbox)
        .where(
          and(
            eq(emailOutbox.userId, n.userId),
            eq(emailOutbox.dedupeKey, dedupeKey),
            isNull(emailOutbox.sentAt),
          ),
        );
    }
    await tx.insert(emailOutbox).values({
      id: uid("eo"),
      userId: n.userId,
      category,
      type: n.type,
      title: n.title,
      body: n.body,
      linkTo: n.linkTo ?? null,
      dedupeKey,
      createdAt: n.createdAt ?? now,
    });
  }
}

/** Insert one notification — the server twin of PoachStore.notify(). */
export async function notify(
  tx: Db,
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  linkTo?: string,
): Promise<void> {
  await insertNotifications(tx, [{ userId, type, title, body, linkTo }]);
}
