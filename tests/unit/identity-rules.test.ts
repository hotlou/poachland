import { describe, expect, it } from "vitest";

import { validateIdentityClaim, validateIdentityReviewNote } from "../../lib/identity-rules";

describe("identity claims", () => {
  it("normalizes matching claims on official provider domains", () => {
    expect(validateIdentityClaim("instagram", " @Collector ", "https://www.instagram.com/collector/#bio"))
      .toEqual({ ok: true, handle: "Collector", url: "https://www.instagram.com/collector/" });
  });

  it("rejects lookalike domains, mismatched profiles, and insecure links", () => {
    expect(validateIdentityClaim("instagram", "alice", "https://instagram.com.evil.test/alice"))
      .toMatchObject({ ok: false });
    expect(validateIdentityClaim("facebook", "alice", "https://facebook.com/bob"))
      .toMatchObject({ ok: false });
    expect(validateIdentityClaim("usau", "123", "http://play.usaultimate.org/members/123"))
      .toMatchObject({ ok: false });
  });

  it("rejects local links and spoofed handles", () => {
    expect(validateIdentityClaim("other", "alice", "https://127.0.0.1/profile"))
      .toMatchObject({ ok: false });
    expect(validateIdentityClaim("other", `alice${"\u202E"}evil`)).toMatchObject({ ok: false });
  });

  it("requires bounded, spoof-resistant reviewer rationale", () => {
    expect(validateIdentityReviewNote("Too short")).toMatchObject({ ok: false });
    expect(validateIdentityReviewNote("Profile and ownership evidence matched.")).toEqual({
      ok: true,
      note: "Profile and ownership evidence matched.",
    });
    expect(validateIdentityReviewNote(`Reviewed ${"\u202E"} spoofed`)).toMatchObject({ ok: false });
  });
});
