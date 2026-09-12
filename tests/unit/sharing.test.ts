import { afterEach, describe, expect, it, vi } from "vitest";
import { listingShareContent, listingTerms, publicUrl, shareDestinations, sharePost, shorten, type ShareListing } from "../../lib/sharing";
import { pageMetadata } from "../../lib/metadata";

const listing: ShareListing = { id: "l_test", title: "Nationals jersey #14", team: "Brute Squad", type: "jersey", size: "M", condition: "Near Mint", listingType: "sell", askingPrice: 45, shippingPreference: "buyer-pays", description: "Worn twice. No pulls.", status: "active" };
afterEach(() => vi.unstubAllEnvs());

describe("sharing public listings", () => {
  it("includes the details a recipient needs without claiming the sharer owns it", () => {
    const content = listingShareContent(listing);
    expect(content.text).toContain("Nationals jersey #14 — $45 on Poachland");
    expect(content.text).toContain("Brute Squad · Size M · Near Mint");
    expect(content.text).toContain("Buyer pays shipping");
    expect(content.text).not.toContain("my jersey");
    expect(content.path).toBe("/l/l_test");
  });
  it("distinguishes cash, trades, free items, and unavailable items", () => {
    expect(listingTerms({ ...listing, listingType: "trade+cash" })).toBe("Trade + $45");
    expect(listingTerms({ ...listing, listingType: "free" })).toBe("Free");
    const trade = listingShareContent({ ...listing, listingType: "trade", tradeFor: "Japan national team jersey" });
    expect(trade.text).toContain("Looking for: Japan national team jersey");
    for (const status of ["pending", "sold", "traded", "claimed", "removed"] as const) {
      const result = listingShareContent({ ...listing, status });
      expect(result.text).not.toContain("$45");
      expect(result.text).toContain("no longer open to offers");
    }
  });
  it("encodes punctuation, line breaks, unicode, and referral query strings exactly once", () => {
    const text = "USA & Japan #14 🥏\nSize M + $45";
    const url = "https://poachland.com/?ref=discwitch";
    const links = shareDestinations({ title: "Gear & discs", text, url });
    expect(new URL(links.find((x) => x.name === "WhatsApp")!.href).searchParams.get("text")).toBe(sharePost(text, url));
    expect(new URL(links.find((x) => x.name === "Telegram")!.href).searchParams.get("url")).toBe(url);
    const facebook = new URL(links.find((x) => x.name === "Facebook")!.href);
    expect(facebook.searchParams.get("u")).toBe(url);
    expect(facebook.searchParams.has("quote")).toBe(false);
    expect(new URL(links.find((x) => x.name === "Email")!.href).searchParams.get("body")).toBe(sharePost(text, url));
  });
  it("bounds the X caption and preserves its separate public link", () => {
    const link = shareDestinations({ title: listing.title, text: "A very long description 🥏 ".repeat(50), url: "https://poachland.com/l/l_test" }).find((x) => x.name === "X")!;
    const query = new URL(link.href).searchParams;
    expect(Array.from(query.get("text")!).length).toBeLessThanOrEqual(230);
    expect(query.get("url")).toBe("https://poachland.com/l/l_test");
    expect(shorten("🥏🥏🥏", 2)).toBe("🥏…");
    const unicodeLink = shareDestinations({ title: "Disc", text: "🥏界".repeat(200), url: "https://poachland.com/l/l_test" }).find((x) => x.name === "X")!;
    const caption = new URL(unicodeLink.href).searchParams.get("text")!;
    expect(Array.from(caption).reduce((sum, char) => sum + (char.codePointAt(0)! > 127 ? 2 : 1), 0)).toBeLessThanOrEqual(230);
  });
  it("builds absolute images for both OG and Twitter without inheriting the homepage card", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://poachland.com/");
    expect(publicUrl("/l/l_test")).toBe("https://poachland.com/l/l_test");
    const meta = pageMetadata({ title: listing.title, description: "Listing", path: "/l/l_test", image: "/l/l_test/opengraph-image" });
    expect(meta.openGraph?.images).toEqual(meta.twitter?.images);
    expect(meta.openGraph?.images).toEqual([expect.objectContaining({ url: "https://poachland.com/l/l_test/opengraph-image", width: 1200, height: 630 })]);
  });
});
