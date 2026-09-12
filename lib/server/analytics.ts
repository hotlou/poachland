import "server-only";

import { uid } from "./auth";
import { and, eq, isNotNull } from "drizzle-orm";
import type { Db } from "./db";
import { productEvents, users } from "./schema";
import { referencesSampleContent } from "./sample-guard";

export type ProductEventName =
  | "onboarding_completed"
  | "listing_created"
  | "offer_created"
  | "offer_accepted"
  | "shipment_recorded"
  | "deal_completed"
  | "deal_disputed";

export async function recordProductEvent(
  tx: Db,
  event: {
    name: ProductEventName;
    userId?: string;
    subjectType?: "user" | "listing" | "deal";
    subjectId?: string;
    properties?: Record<string, string | number | boolean | null>;
  },
): Promise<void> {
  if (event.userId) {
    const [sample] = await tx.select({ id: users.id }).from(users).where(and(eq(users.id, event.userId), isNotNull(users.sampleBatchId))).limit(1);
    if (sample) return;
  }
  if (event.subjectId && await referencesSampleContent(tx, { id: event.subjectId })) return;
  await tx.insert(productEvents).values({
    id: uid("evt"),
    name: event.name,
    userId: event.userId,
    subjectType: event.subjectType,
    subjectId: event.subjectId,
    properties: event.properties ?? {},
  });
}
