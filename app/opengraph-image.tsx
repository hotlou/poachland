/**
 * Site-wide Open Graph card — same visual system as the profile cards:
 * cream field, Poachland wordmark + bordered stamp, the brand headline, and
 * a disc motif. Static-friendly (no data fetching).
 */

import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "Poachland — trade jerseys, collect discs, trust each other";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CREAM = "#f6f4ec";
const GREEN = "#2d6b3f";
const INK = "#262420";
const MUTED = "#6f6a5c";

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
        {/* Wordmark + stamp */}
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

        {/* Headline + disc motif */}
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

          {/* Flying disc */}
          <div
            style={{
              width: 240,
              height: 240,
              borderRadius: 240,
              background: GREEN,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 176,
                height: 176,
                borderRadius: 176,
                border: `6px solid ${CREAM}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 64,
                  border: `6px solid ${CREAM}`,
                  display: "flex",
                }}
              />
            </div>
          </div>
        </div>

        {/* Bottom strip */}
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
      </div>
    ),
    { ...size },
  );
}
