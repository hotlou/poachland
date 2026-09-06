import type { DealKind } from "./types";

export type OfferTermsLike = {
  proposerListingIds: unknown;
  ownerListingIds: unknown;
  cashFromProposer: unknown;
  cashFromOwner: unknown;
  note: unknown;
};

export type NormalizedOfferTerms = {
  proposerListingIds: string[];
  ownerListingIds: string[];
  cashFromProposer: number;
  cashFromOwner: number;
  note: string;
};

export function normalizeOfferTerms(terms: OfferTermsLike): NormalizedOfferTerms {
  return {
    proposerListingIds: Array.isArray(terms.proposerListingIds) ? terms.proposerListingIds.map(String) : [],
    ownerListingIds: Array.isArray(terms.ownerListingIds) ? terms.ownerListingIds.map(String) : [],
    cashFromProposer: Math.max(0, Math.round(Number(terms.cashFromProposer) || 0)),
    cashFromOwner: Math.max(0, Math.round(Number(terms.cashFromOwner) || 0)),
    note: (typeof terms.note === "string" ? terms.note : "").slice(0, 500),
  };
}

export function describeOfferTerms(
  kind: DealKind,
  offer: Omit<NormalizedOfferTerms, "note">,
  titleFor: (listingId: string) => string | undefined,
): string {
  const names = (ids: string[]) => ids.map((id) => `"${titleFor(id) ?? "an item"}"`).join(" + ");
  const proposerSide: string[] = [];
  if (offer.proposerListingIds.length) proposerSide.push(names(offer.proposerListingIds));
  if (offer.cashFromProposer > 0) proposerSide.push(`$${offer.cashFromProposer}`);
  const ownerSide: string[] = [];
  if (offer.ownerListingIds.length) ownerSide.push(names(offer.ownerListingIds));
  if (offer.cashFromOwner > 0) ownerSide.push(`$${offer.cashFromOwner}`);
  if (kind === "claim") return `wants to claim ${ownerSide.join(" + ") || "the item"}`;
  if (kind === "buy") return `offers $${offer.cashFromProposer} for ${ownerSide.join(" + ") || "the item"}`;
  return `${proposerSide.join(" + ") || "nothing"} ⇄ ${ownerSide.join(" + ") || "nothing"}`;
}
