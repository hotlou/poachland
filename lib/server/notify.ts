/**
 * Notification inserts (server-only).
 *
 * Mirrors the client engine's `notify()` — same fields, server-generated ids.
 * Accepts either the root Db or a transaction handle (PgTransaction extends
 * PgDatabase, so both satisfy `Db`).
 */

import "server-only";

import type { NotificationType } from "../types";
import { uid } from "./auth";
import type { Db } from "./db";
import { notifications } from "./schema";

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
  await tx.insert(notifications).values(
    items.map((n) => ({
      id: uid("n"),
      userId: n.userId,
      type: n.type,
      title: n.title,
      body: n.body,
      read: false,
      createdAt: n.createdAt ?? new Date(),
      linkTo: n.linkTo ?? null,
    })),
  );
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
