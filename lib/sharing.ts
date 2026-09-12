import { LISTING_STATUS_LABELS, LISTING_TYPE_LABELS } from "./constants";
import { money } from "./format";
import type { Listing } from "./types";

export type ShareContent = { title: string; text: string; path: string; imagePath?: string };
export type ShareListing = Pick<Listing, "id" | "title" | "team" | "type" | "size" | "condition" | "listingType" | "askingPrice" | "tradeFor" | "shippingPreference" | "description" | "status">;

export function publicUrl(path: string): string {
  // Use the configured public origin and an explicit path, not the browser's current URL.
  const origin = process.env.NEXT_PUBLIC_APP_URL || "https://poachland.com";
  return new URL(path, origin).toString();
}

export function shorten(text: string, length: number): string {
  const characters = Array.from(text.trim().replace(/\s+/g, " "));
  return characters.length > length ? `${characters.slice(0, length - 1).join("").trimEnd()}…` : characters.join("");
}

export function listingTerms(listing: ShareListing): string {
  if (listing.status !== "active") return LISTING_STATUS_LABELS[listing.status];
  if (listing.listingType === "free") return "Free";
  if (listing.listingType === "sell" && listing.askingPrice != null) return money(listing.askingPrice);
  if (listing.listingType === "trade+cash" && listing.askingPrice != null) return `Trade + ${money(listing.askingPrice)}`;
  return LISTING_TYPE_LABELS[listing.listingType];
}

export function listingShareContent(listing: ShareListing): ShareContent {
  const details = [listing.team, listing.size && `Size ${listing.size}`, listing.condition].filter(Boolean).join(" · ");
  const shipping = { "seller-pays": "Free shipping", "buyer-pays": "Buyer pays shipping", "local-only": "Local pickup only" }[listing.shippingPreference];
  const active = listing.status === "active";
  const trade = active && (listing.listingType === "trade" || listing.listingType === "trade+cash") && listing.tradeFor;
  return {
    title: listing.title,
    path: `/l/${encodeURIComponent(listing.id)}`,
    imagePath: `/l/${encodeURIComponent(listing.id)}/opengraph-image`,
    text: [
      `${listing.title} — ${listingTerms(listing)} on Poachland`,
      details,
      trade && `Looking for: ${shorten(listing.tradeFor!, 160)}`,
      active && shipping,
      listing.description && shorten(listing.description, 200),
      active ? "Check it out on Poachland." : "This listing is no longer open to offers. Browse more gear on Poachland.",
    ].filter(Boolean).join("\n"),
  };
}

export function sharePost(text: string, url: string): string {
  return `${text.trim()}\n\n${url}`.trim();
}

function xCaption(text: string): string {
  // Conservatively count non-ASCII as two units, including emoji and CJK.
  // This leaves space for the shortened URL even for all-Unicode captions.
  const clean = text.trim().replace(/\s+/g, " ");
  let caption = "";
  let weight = 0;
  for (const character of clean) {
    weight += character.codePointAt(0)! > 127 ? 2 : 1;
    if (weight > 228) return `${caption.trimEnd()}…`;
    caption += character;
  }
  return caption;
}

export function shareDestinations(content: { title: string; text: string; url: string }) {
  const { title, text, url } = content;
  const query = (values: Record<string, string>) => new URLSearchParams(values).toString();
  const post = sharePost(text, url);
  return [
    { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?${query({ u: url })}`, hint: "Link preview; paste your caption" },
    { name: "WhatsApp", href: `https://wa.me/?${query({ text: post })}`, hint: "Post and link ready to send" },
    { name: "Telegram", href: `https://t.me/share/url?${query({ url, text })}`, hint: "Post and link ready to send" },
    // Leave room for X's shortened link and keep long listing descriptions usable.
    { name: "X", href: `https://twitter.com/intent/tweet?${query({ text: xCaption(text), url })}`, hint: "Short caption and link" },
    { name: "Email", href: `mailto:?subject=${encodeURIComponent(shorten(title, 150))}&body=${encodeURIComponent(post)}`, hint: "Subject and message ready" },
  ];
}
