import "server-only";

import { uid } from "./auth";
import type { Db } from "./db";
import { productEvents } from "./schema";

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
  await tx.insert(productEvents).values({
    id: uid("evt"),
    name: event.name,
    userId: event.userId,
    subjectType: event.subjectType,
    subjectId: event.subjectId,
    properties: event.properties ?? {},
  });
}
