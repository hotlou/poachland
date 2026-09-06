import { describe, expect, it } from "vitest";
import { sanitizeSlug, sanitizeUsername } from "../../lib/identifiers";

describe("public identifiers", () => {
  it("normalizes usernames identically for optimistic and authoritative paths", () => {
    expect(sanitizeUsername(" Alice+Collector!! ")).toBe("alicecollector");
    expect(sanitizeUsername("TEAM.Name_23-")).toBe("team.name_23-");
    expect(sanitizeUsername(null)).toBe("");
  });

  it("creates bounded URL slugs without empty edge separators", () => {
    expect(sanitizeSlug("  VC Ultimate / Canada  ")).toBe("vc-ultimate-canada");
    expect(sanitizeSlug("---A---")).toBe("a");
    expect(sanitizeSlug("x".repeat(80))).toHaveLength(48);
  });
});
