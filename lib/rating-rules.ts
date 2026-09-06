export type ValidatedRating = {
  communication: number;
  shippingSpeed: number;
  itemAccuracy: number;
  wouldTradeAgain: boolean;
  comment?: string;
};

export type RatingValidation =
  | { ok: true; rating: ValidatedRating }
  | { ok: false; error: string };

const UNSAFE_RATING_TEXT = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/;

export function validateRatingInput(input: {
  communication: unknown;
  shippingSpeed: unknown;
  itemAccuracy: unknown;
  wouldTradeAgain: unknown;
  comment?: unknown;
}): RatingValidation {
  const dimensions = [input.communication, input.shippingSpeed, input.itemAccuracy];
  if (!dimensions.every((score) => Number.isInteger(score) && Number(score) >= 1 && Number(score) <= 5))
    return { ok: false, error: "Every rating must be a whole number from 1 to 5" };
  if (typeof input.wouldTradeAgain !== "boolean")
    return { ok: false, error: "Choose whether you would trade again" };
  const comment = String(input.comment ?? "").normalize("NFKC").replace(/\r\n?/g, "\n").trim();
  if (comment.length > 500) return { ok: false, error: "Rating comment is capped at 500 characters" };
  if (UNSAFE_RATING_TEXT.test(comment))
    return { ok: false, error: "Rating comment contains unsupported control characters" };
  return {
    ok: true,
    rating: {
      communication: Number(input.communication),
      shippingSpeed: Number(input.shippingSpeed),
      itemAccuracy: Number(input.itemAccuracy),
      wouldTradeAgain: input.wouldTradeAgain,
      comment: comment || undefined,
    },
  };
}
