import { describe, expect, it } from "vitest";

import { validateModerationReport } from "../../lib/moderation-rules";

describe("moderation report input", () => {
  it("accepts published reasons and normalized details", () => {
    expect(validateModerationReport("Scam or fraud attempt", "  Requested a gift-card payment.  ")).toEqual({
      ok: true,
      reason: "Scam or fraud attempt",
      details: "Requested a gift-card payment.",
    });
  });

  it("rejects invented reasons and underspecified Other reports", () => {
    expect(validateModerationReport("I dislike this")).toMatchObject({ ok: false });
    expect(validateModerationReport("Other", "Too vague")).toMatchObject({ ok: false });
  });

  it("rejects oversized and bidi-spoofed evidence", () => {
    expect(validateModerationReport("Spam", "x".repeat(2_001))).toMatchObject({ ok: false });
    expect(validateModerationReport("Spam", `Visible ${"\u202E"} spoofed`)).toMatchObject({ ok: false });
  });
});
