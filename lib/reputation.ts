import type { RatingSummary } from "./types";

export type RatingLike = {
  communication: number;
  shippingSpeed: number;
  itemAccuracy: number;
  wouldTradeAgain: boolean;
};

export type ReputationBaseline = {
  baselineRatingCount: number;
  baselineRatingSum: number;
};

export function ratingOverall(rating: Pick<RatingLike, "communication" | "shippingSpeed" | "itemAccuracy">): number {
  return (rating.communication + rating.shippingSpeed + rating.itemAccuracy) / 3;
}

export function ratingSummaryFrom(rows: RatingLike[], baseline: ReputationBaseline): RatingSummary {
  const currentCount = rows.length;
  const totalCount = currentCount + baseline.baselineRatingCount;
  const average = (pick: (rating: RatingLike) => number) => totalCount === 0
    ? 0
    : (rows.reduce((sum, rating) => sum + pick(rating), 0) + baseline.baselineRatingSum) / totalCount;
  const overall = totalCount === 0
    ? 0
    : (rows.reduce((sum, rating) => sum + ratingOverall(rating), 0) + baseline.baselineRatingSum) / totalCount;

  return {
    count: totalCount,
    overall: Math.round(overall * 10) / 10,
    communication: Math.round(average((rating) => rating.communication) * 10) / 10,
    shippingSpeed: Math.round(average((rating) => rating.shippingSpeed) * 10) / 10,
    itemAccuracy: Math.round(average((rating) => rating.itemAccuracy) * 10) / 10,
    wouldTradeAgainPct: currentCount === 0
      ? 100
      : Math.round((rows.filter((rating) => rating.wouldTradeAgain).length / currentCount) * 100),
  };
}
