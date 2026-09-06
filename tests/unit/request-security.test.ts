import { describe, expect, it } from "vitest";
import { isTrustedMutationOrigin } from "../../lib/server/request-security";

describe("cookie-authenticated mutation origin", () => {
  const expected = "https://poachland.example";

  it("accepts only the exact canonical origin", () => {
    expect(isTrustedMutationOrigin(expected, "same-origin", expected)).toBe(true);
    expect(isTrustedMutationOrigin("https://evil.example", "cross-site", expected)).toBe(false);
    expect(isTrustedMutationOrigin("https://poachland.example.evil.test", "same-site", expected)).toBe(false);
  });

  it("fails closed when Origin is absent or malformed", () => {
    expect(isTrustedMutationOrigin(null, "same-origin", expected)).toBe(false);
    expect(isTrustedMutationOrigin("not a url", null, expected)).toBe(false);
  });
});
