/**
 * Dynamic Open Graph card for /l/[id] — a branded 1200×630 "listing card":
 * cream field, Poachland wordmark, the item title, a team/condition/type line,
 * a price/free/trade chip, and the first photo in a green-bordered square.
 * Falls back to a generic brand card when the listing doesn't exist, and to a
 * green disc with the item emoji when the photo can't be loaded.
 * ImageResponse styling is flexbox-only inline styles.
 */

import { ImageResponse } from "next/og";
import { getPublicListing, type PublicListing } from "@/lib/server/public";
import { LISTING_TYPE_LABELS } from "@/lib/constants";

export const runtime = "nodejs";
export const alt = "Poachland listing";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CREAM = "#f6f4ec";
const GREEN = "#2d6b3f";
const INK = "#262420";
const GOLD = "#d97706";
const MUTED = "#6f6a5c";

/**
 * Resolve a photo to something ImageResponse can render without a network
 * surprise mid-render: data URLs pass through; local paths get the site
 * origin prefixed; http(s) URLs are fetched and inlined as base64. Anything
 * that fails returns null → item-emoji disc.
 */
async function loadPhoto(photo: string): Promise<string | null> {
  try {
    if (!photo) return null;
    if (photo.startsWith("data:image/")) return photo;
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? "https://poachland.com";
    let url: string;
    if (photo.startsWith("https://") || photo.startsWith("http://")) {
      url = photo;
    } else if (photo.startsWith("/")) {
      url = new URL(photo, origin).toString();
    } else {
      return null;
    }
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) return null;
    const mime = res.headers.get("content-type") ?? "image/jpeg";
    if (!mime.startsWith("image/")) return null;
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

function Wordmark() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
      <div
        style={{
          fontSize: 46,
          fontWeight: 800,
          color: GREEN,
          letterSpacing: -1.5,
        }}
      >
        Poachland
      </div>
      <div
        style={{
          display: "flex",
          border: `2px solid ${GREEN}`,
          borderRadius: 8,
          padding: "6px 14px",
          fontSize: 17,
          fontWeight: 700,
          letterSpacing: 3,
          color: GREEN,
        }}
      >
        ULTIMATE FRISBEE MARKETPLACE
      </div>
    </div>
  );
}

function BottomStrip() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        borderTop: "2px solid rgba(45, 107, 63, 0.22)",
        paddingTop: 22,
        fontSize: 24,
        color: MUTED,
      }}
    >
      <div style={{ display: "flex", color: GREEN, fontWeight: 700 }}>
        poachland.com
      </div>
      <div style={{ display: "flex" }}>
        — trade jerseys · collect discs · trust each other
      </div>
    </div>
  );
}

function BrandFallback() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: CREAM,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "56px 64px",
      }}
    >
      <Wordmark />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          fontSize: 84,
          fontWeight: 800,
          color: INK,
          letterSpacing: -3,
          lineHeight: 1.08,
        }}
      >
        <div style={{ display: "flex" }}>Trade jerseys.</div>
        <div style={{ display: "flex", color: GREEN }}>Collect discs.</div>
      </div>
      <BottomStrip />
    </div>
  );
}

function priceLabel(l: PublicListing): string {
  if (
    (l.listingType === "sell" || l.listingType === "trade+cash") &&
    l.askingPrice != null
  ) {
    return `$${l.askingPrice}`;
  }
  if (l.listingType === "free") return "Free";
  return LISTING_TYPE_LABELS[l.listingType];
}

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const l = await getPublicListing(id).catch(() => null);
  if (!l) {
    return new ImageResponse(<BrandFallback />, { ...size });
  }

  const photoSrc = l.photos[0] ? await loadPhoto(l.photos[0]) : null;
  const emoji = l.type === "jersey" ? "👕" : "🥏";
  const titleSize =
    l.title.length > 44 ? 48 : l.title.length > 28 ? 60 : 72;
  const isFree = l.listingType === "free";
  const chipColor = isFree ? GOLD : GREEN;
  const chipBg = isFree ? "rgba(217, 118, 6, 0.12)" : "rgba(45, 107, 63, 0.12)";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: CREAM,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 64px",
        }}
      >
        <Wordmark />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 48,
            flexGrow: 1,
            paddingTop: 24,
            paddingBottom: 24,
          }}
        >
          {/* Title, meta, price chip */}
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 640 }}>
            <div
              style={{
                display: "flex",
                fontSize: titleSize,
                fontWeight: 800,
                color: INK,
                letterSpacing: -2,
                lineHeight: 1.05,
              }}
            >
              {l.title}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 30,
                color: MUTED,
                marginTop: 20,
              }}
            >
              {l.team} · {l.condition} · {l.type}
            </div>
            <div style={{ display: "flex", marginTop: 30 }}>
              <div
                style={{
                  display: "flex",
                  background: chipBg,
                  color: chipColor,
                  border: `3px solid ${chipColor}`,
                  borderRadius: 14,
                  padding: "12px 26px",
                  fontSize: 38,
                  fontWeight: 800,
                }}
              >
                {priceLabel(l)}
              </div>
            </div>
          </div>

          {/* Photo / item disc */}
          {photoSrc ? (
            <div
              style={{
                width: 300,
                height: 300,
                borderRadius: 28,
                border: `10px solid ${GREEN}`,
                display: "flex",
                overflow: "hidden",
                flexShrink: 0,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoSrc}
                alt=""
                width={280}
                height={280}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
          ) : (
            <div
              style={{
                width: 300,
                height: 300,
                borderRadius: 300,
                background: GREEN,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 150,
                flexShrink: 0,
              }}
            >
              {emoji}
            </div>
          )}
        </div>

        <BottomStrip />
      </div>
    ),
    { ...size },
  );
}
