import { describe, expect, it } from "vitest";
import { isAllowedImageReference } from "../../lib/image-reference";

describe("persisted image references", () => {
  const store = "store_abc123";

  it("allows bundled assets and the configured CDN namespace", () => {
    expect(isAllowedImageReference("/images/disc.jpg", store)).toBe(true);
    expect(isAllowedImageReference("/placeholder-user.jpg", store)).toBe(true);
    expect(isAllowedImageReference("https://store_abc123.public.blob.vercel-storage.com/uploads/upl_a.jpg", store)).toBe(true);
  });

  it("rejects SSRF-capable, inline, traversal, and lookalike references", () => {
    expect(isAllowedImageReference("https://169.254.169.254/latest/meta-data", store)).toBe(false);
    expect(isAllowedImageReference("https://store_abc123.public.blob.vercel-storage.com.evil.test/uploads/a.jpg", store)).toBe(false);
    expect(isAllowedImageReference("https://store_other.public.blob.vercel-storage.com/uploads/a.jpg", store)).toBe(false);
    expect(isAllowedImageReference("data:image/png;base64,AAAA", store)).toBe(false);
    expect(isAllowedImageReference("/images/../api/health", store)).toBe(false);
  });
});
