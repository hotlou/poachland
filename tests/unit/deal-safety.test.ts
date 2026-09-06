import { describe, expect, it } from "vitest";

import {
  validateAcceptedDealCancellation,
  validateDisputeReason,
  validateModerationResolution,
} from "../../lib/deal-safety";

describe("accepted-deal cancellation safety", () => {
  it("requires a useful reason before fulfillment starts", () => {
    expect(validateAcceptedDealCancellation({}, "too short")).toMatchObject({ ok: false });
    expect(validateAcceptedDealCancellation({}, "  Seller cannot safely fulfill.  ")).toEqual({
      ok: true,
      reason: "Seller cannot safely fulfill.",
    });
  });

  it("routes shipped and handed-off deals to disputes", () => {
    expect(validateAcceptedDealCancellation({ user: { shippedAt: "2026-09-06T00:00:00Z" } }, "Package lost"))
      .toEqual({
        ok: false,
        error: "Shipping or handoff has started — open a dispute so the evidence stays available",
      });
  });

  it("normalizes useful dispute evidence and rejects spoofing controls", () => {
    expect(validateDisputeReason("  Package arrived damaged.\r\nThe seam is torn.  ")).toEqual({
      ok: true,
      reason: "Package arrived damaged.\nThe seam is torn.",
    });
    expect(validateDisputeReason("Item missing")).toMatchObject({ ok: false });
    expect(validateDisputeReason(`Package never arrived ${"\u202E"} spoofed`)).toMatchObject({ ok: false });
    expect(validateDisputeReason("x".repeat(2_001))).toMatchObject({ ok: false });
  });

  it("requires a durable moderator rationale", () => {
    expect(validateModerationResolution("Looks fine")).toEqual({
      ok: false,
      error: "Describe the resolution in at least 20 characters",
    });
    expect(validateModerationResolution("Carrier evidence confirms delivery.")).toMatchObject({ ok: true });
  });
});
