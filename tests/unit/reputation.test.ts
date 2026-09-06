import { describe, expect, it } from "vitest";
import { ratingOverall, ratingSummaryFrom } from "../../lib/reputation";

describe("reputation calculations", () => {
  it("combines current ratings with the historical baseline", () => {
    const ratings = [
      { communication: 5, shippingSpeed: 4, itemAccuracy: 3, wouldTradeAgain: true },
      { communication: 4, shippingSpeed: 4, itemAccuracy: 4, wouldTradeAgain: false },
    ];
    expect(ratingOverall(ratings[0])).toBe(4);
    expect(ratingSummaryFrom(ratings, { baselineRatingCount: 2, baselineRatingSum: 10 })).toEqual({
      count: 4,
      overall: 4.5,
      communication: 4.8,
      shippingSpeed: 4.5,
      itemAccuracy: 4.3,
      wouldTradeAgainPct: 50,
    });
  });

  it("returns an unrated default without division errors", () => {
    expect(ratingSummaryFrom([], { baselineRatingCount: 0, baselineRatingSum: 0 })).toEqual({
      count: 0,
      overall: 0,
      communication: 0,
      shippingSpeed: 0,
      itemAccuracy: 0,
      wouldTradeAgainPct: 100,
    });
  });
});
