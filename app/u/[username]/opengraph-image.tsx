/**
 * Dynamic Open Graph card for /u/[username] — a branded 1200×630 "trader
 * card": cream field, Poachland wordmark, the trader's name, star row, and
 * avatar in a green ring. Falls back to a generic brand card when the
 * username doesn't exist, and to an initial-letter disc when the avatar
 * can't be loaded. ImageResponse styling is flexbox-only inline styles.
 */

import { ImageResponse } from "next/og";
import { getPublicProfile } from "@/lib/server/public";

export const runtime = "nodejs";
export const alt = "Poachland trader profile card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CREAM = "#f6f4ec";
const GREEN = "#2d6b3f";
const INK = "#262420";
const GOLD = "#d97706";
const MUTED = "#6f6a5c";
const STAR_EMPTY = "#d9d3c2";

/**
 * Resolve an avatar to something ImageResponse can render without a network
 * surprise mid-render: data URLs pass through; local paths get the site
 * origin prefixed; http(s) URLs are fetched and inlined as base64. Anything
 * that fails returns null → initial-letter disc.
 */
async function loadAvatar(avatar: string): Promise<string | null> {
  try {
    if (!avatar) return null;
    if (avatar.startsWith("data:image/")) return avatar;
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? "https://poachland.com";
    let url: string;
    if (avatar.startsWith("https://") || avatar.startsWith("http://")) {
      url = avatar;
    } else if (avatar.startsWith("/")) {
      url = new URL(avatar, origin).toString();
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

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24">
      <path
        d="M12 1.8l3.1 6.33 6.98.99-5.06 4.9 1.2 6.95L12 17.68l-6.22 3.29 1.2-6.95-5.06-4.9 6.98-.99L12 1.8z"
        fill={filled ? GOLD : STAR_EMPTY}
      />
    </svg>
  );
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

function InitialDisc({ letter }: { letter: string }) {
  return (
    <div
      style={{
        width: 260,
        height: 260,
        borderRadius: 260,
        background: GREEN,
        border: `10px solid ${GREEN}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 130,
        fontWeight: 800,
        color: CREAM,
      }}
    >
      {letter}
    </div>
  );
}

function GenericCard() {
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
        <div style={{ display: "flex" }}>Trust each other.</div>
      </div>
      <BottomStrip />
    </div>
  );
}

export default async function Image({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username: raw } = await params;
  let username = raw;
  try {
    username = decodeURIComponent(raw);
  } catch {
    // keep the raw segment
  }

  const profile = await getPublicProfile(username).catch(() => null);
  if (!profile) {
    return new ImageResponse(<GenericCard />, { ...size });
  }

  const avatarSrc = await loadAvatar(profile.avatar);
  const initial = (profile.displayName.trim()[0] ?? "P").toUpperCase();
  const filledStars = Math.round(Math.min(5, Math.max(0, profile.trustScore)));
  const nameSize =
    profile.displayName.length > 22
      ? 56
      : profile.displayName.length > 14
        ? 68
        : 84;

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
          {/* Name, handle, stars, location */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              maxWidth: 780,
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: nameSize,
                fontWeight: 800,
                color: INK,
                letterSpacing: -2.5,
                lineHeight: 1.05,
              }}
            >
              {profile.displayName}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 36,
                fontWeight: 600,
                color: GREEN,
                marginTop: 10,
              }}
            >
              @{profile.username}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 20,
                marginTop: 26,
              }}
            >
              <div style={{ display: "flex", gap: 4 }}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <StarIcon key={s} filled={s <= filledStars} />
                ))}
              </div>
              <div style={{ display: "flex", fontSize: 32, color: MUTED }}>
                {profile.trustScore.toFixed(1)} · {profile.tradesCompleted}{" "}
                trade{profile.tradesCompleted === 1 ? "" : "s"}
              </div>
            </div>
            {profile.location ? (
              <div
                style={{
                  display: "flex",
                  fontSize: 26,
                  color: MUTED,
                  marginTop: 14,
                }}
              >
                {profile.location}
              </div>
            ) : null}
          </div>

          {/* Avatar disc */}
          {avatarSrc ? (
            <div
              style={{
                width: 260,
                height: 260,
                borderRadius: 260,
                border: `10px solid ${GREEN}`,
                display: "flex",
                overflow: "hidden",
                flexShrink: 0,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarSrc}
                alt=""
                width={240}
                height={240}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
          ) : (
            <InitialDisc letter={initial} />
          )}
        </div>

        <BottomStrip />
      </div>
    ),
    { ...size },
  );
}
