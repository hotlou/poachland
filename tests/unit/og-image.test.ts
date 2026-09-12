import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { BrandCard, loadOgPhoto, ogResponse } from "../../lib/server/og-image";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("resilient preview images", () => {
  it("loads bundled photos without networking and rejects untrusted references", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await loadOgPhoto("/images/jersey-1.jpg")).toMatch(/^data:image\/jpeg;base64,/);
    expect(await loadOgPhoto("https://untrusted.test/photo.jpg")).toBeNull();
    expect(await loadOgPhoto("/images/../private.jpg")).toBeNull();
    expect(await loadOgPhoto("/images/missing.jpg")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("bounds remote images and refuses redirects or failed fetches", async () => {
    vi.stubEnv("BLOB_STORE_ID", "store_test");
    const url = "https://store_test.public.blob.vercel-storage.com/uploads/jersey.jpg";
    const fetch = vi.fn().mockResolvedValue(new Response("too big", { headers: { "content-type": "image/jpeg", "content-length": String(6 * 1024 * 1024) } }));
    vi.stubGlobal("fetch", fetch);
    expect(await loadOgPhoto(url)).toBeNull();
    expect(fetch).toHaveBeenCalledWith(url, expect.objectContaining({ redirect: "error", signal: expect.any(AbortSignal) }));
    fetch.mockRejectedValueOnce(new Error("timeout"));
    expect(await loadOgPhoto(url)).toBeNull();
  });
  it("renders a full branded PNG when an allowed photo is corrupt", async () => {
    const response = await ogResponse((photo) => createElement(BrandCard, { photo }), "data:image/png;base64,YmFk", true);
    const png = Buffer.from(await response.arrayBuffer());
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
    expect(response.headers.get("cache-control")).toContain("must-revalidate");
  });
});
