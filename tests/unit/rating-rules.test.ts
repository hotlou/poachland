import { describe, expect, it } from "vitest";

import { validateRatingInput } from "../../lib/rating-rules";

const valid = {
  communication: 5,
  shippingSpeed: 4,
  itemAccuracy: 5,
  wouldTradeAgain: true,
};

describe("rating integrity", () => {
  it("accepts exact 1–5 dimensions and normalizes comments", () => {
    expect(validateRatingInput({ ...valid, comment: "  Great trade.\r\nFast shipping.  " })).toEqual({
      ok: true,
      rating: { ...valid, comment: "Great trade.\nFast shipping." },
    });
  });

  it("rejects rather than silently clamping invalid scores", () => {
    expect(validateRatingInput({ ...valid, communication: 6 })).toMatchObject({ ok: false });
    expect(validateRatingInput({ ...valid, shippingSpeed: 3.5 })).toMatchObject({ ok: false });
    expect(validateRatingInput({ ...valid, itemAccuracy: Number.NaN })).toMatchObject({ ok: false });
  });

  it("rejects forged booleans and unsafe or oversized comments", () => {
    expect(validateRatingInput({ ...valid, wouldTradeAgain: "yes" })).toMatchObject({ ok: false });
    expect(validateRatingInput({ ...valid, comment: `Great ${"\u202E"} spoofed` })).toMatchObject({ ok: false });
    expect(validateRatingInput({ ...valid, comment: "x".repeat(501) })).toMatchObject({ ok: false });
  });
});
