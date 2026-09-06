import "server-only";

import { OFFER_EXPIRY_DAYS } from "../constants";
import { describeOfferTerms, normalizeOfferTerms, type NormalizedOfferTerms } from "../offer-rules";
import { CLIENT_ID_PATTERN, type OfferTerms } from "../shared/ops";
import type { DealKind } from "../types";
import { uid } from "./auth";
import { validImageReference } from "./storage";

const DAY_MS = 86_400_000;

export const isClientId = (id: unknown): id is string =>
  typeof id === "string" && CLIENT_ID_PATTERN.test(id);

/** Slice to four opaque object/stock URLs; uploaded binary data is never accepted. */
export function capPhotos(raw: unknown): string[] | null {
  const photos = (Array.isArray(raw) ? raw : []).slice(0, 4).map(String);
  return photos.some((photo) => !validImageReference(photo)) ? null : photos;
}

export function otherParty(
  deal: { proposerId: string; ownerId: string },
  userId: string,
): string {
  return deal.proposerId === userId ? deal.ownerId : deal.proposerId;
}

export type OfferTermsClean = NormalizedOfferTerms;

export const cleanTerms = (terms: OfferTerms): OfferTermsClean => normalizeOfferTerms(terms);

export function makeOfferValues(byUserId: string, terms: OfferTermsClean, now: Date) {
  return {
    id: uid("of"),
    byUserId,
    proposerListingIds: terms.proposerListingIds,
    ownerListingIds: terms.ownerListingIds,
    cashFromProposer: terms.cashFromProposer,
    cashFromOwner: terms.cashFromOwner,
    note: terms.note,
    createdAt: now,
    expiresAt: new Date(now.getTime() + OFFER_EXPIRY_DAYS * DAY_MS),
    status: "pending" as const,
  };
}

export function describeOffer(
  kind: DealKind,
  offer: {
    proposerListingIds: string[];
    ownerListingIds: string[];
    cashFromProposer: number;
    cashFromOwner: number;
  },
  titles: Map<string, string>,
): string {
  return describeOfferTerms(kind, offer, (id) => titles.get(id));
}
