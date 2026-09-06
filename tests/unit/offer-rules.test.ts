import { describe, expect, it } from "vitest";
import { describeOfferTerms, normalizeOfferTerms } from "../../lib/offer-rules";

describe("offer rules", () => {
  it("normalizes untrusted terms before either engine persists them", () => {
    expect(normalizeOfferTerms({
      proposerListingIds: [12, "l_two"],
      ownerListingIds: null,
      cashFromProposer: 12.6,
      cashFromOwner: -20,
      note: "x".repeat(700),
    })).toEqual({
      proposerListingIds: ["12", "l_two"],
      ownerListingIds: [],
      cashFromProposer: 13,
      cashFromOwner: 0,
      note: "x".repeat(500),
    });
  });

  it("describes trade, sale, and claim terms consistently", () => {
    const offer = {
      proposerListingIds: ["p"], ownerListingIds: ["o"],
      cashFromProposer: 25, cashFromOwner: 0,
    };
    const title = (id: string) => ({ p: "Disc", o: "Jersey" })[id as "p" | "o"];
    expect(describeOfferTerms("trade", offer, title)).toBe('"Disc" + $25 ⇄ "Jersey"');
    expect(describeOfferTerms("buy", offer, title)).toBe('offers $25 for "Jersey"');
    expect(describeOfferTerms("claim", offer, title)).toBe('wants to claim "Jersey"');
  });
});
