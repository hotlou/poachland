import { describe, expect, it } from "vitest";
import { isAllowedImageReference } from "../../lib/image-reference";

describe("persisted image references", () => {
  const cdn = "https://cdn.poachland.example/assets";

  it("allows bundled assets and the configured CDN namespace", () => {
    expect(isAllowedImageReference("/images/disc.jpg", cdn)).toBe(true);
    expect(isAllowedImageReference("/placeholder-user.jpg", cdn)).toBe(true);
    expect(isAllowedImageReference("https://cdn.poachland.example/assets/users/u/a.jpg", cdn)).toBe(true);
  });

  it("rejects SSRF-capable, inline, traversal, and lookalike references", () => {
    expect(isAllowedImageReference("https://169.254.169.254/latest/meta-data", cdn)).toBe(false);
    expect(isAllowedImageReference("https://cdn.poachland.example.evil.test/assets/a.jpg", cdn)).toBe(false);
    expect(isAllowedImageReference("https://cdn.poachland.example/other/a.jpg", cdn)).toBe(false);
    expect(isAllowedImageReference("data:image/png;base64,AAAA", cdn)).toBe(false);
    expect(isAllowedImageReference("/images/../api/health", cdn)).toBe(false);
  });
});
