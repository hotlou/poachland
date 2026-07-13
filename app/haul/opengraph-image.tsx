/**
 * Static Open Graph card for /haul — a branded 1200×630 "community wall"
 * card: cream field, Poachland wordmark, a bold headline stack, and a row of
 * the celebratory reaction emojis. ImageResponse styling is flexbox-only
 * inline styles.
 */

import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "The Haul — Poachland";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CREAM = "#f6f4ec";
const GREEN = "#2d6b3f";
const INK = "#262420";
const GOLD = "#d97706";
const MUTED = "#6f6a5c";

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
        poachland.com/haul
      </div>
      <div style={{ display: "flex" }}>
        — real trades, celebrated by the community
      </div>
    </div>
  );
}

export default function Image() {
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
            flexDirection: "column",
            flexGrow: 1,
            justifyContent: "center",
            paddingTop: 24,
            paddingBottom: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 96,
              fontWeight: 800,
              color: INK,
              letterSpacing: -3.5,
              lineHeight: 1.04,
            }}
          >
            <div style={{ display: "flex", color: GOLD }}>The Haul.</div>
            <div style={{ display: "flex" }}>Real trades,</div>
            <div style={{ display: "flex", color: GREEN }}>celebrated.</div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              marginTop: 34,
              fontSize: 68,
            }}
          >
            <div style={{ display: "flex" }}>🔥</div>
            <div style={{ display: "flex" }}>👏</div>
            <div style={{ display: "flex" }}>🤝</div>
            <div style={{ display: "flex" }}>😮</div>
            <div style={{ display: "flex" }}>🏴‍☠️</div>
          </div>
        </div>

        <BottomStrip />
      </div>
    ),
    { ...size },
  );
}
