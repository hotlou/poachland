import "server-only";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { ReactElement } from "react";
import { ImageResponse } from "next/og";
import { isAllowedImageReference } from "../image-reference";
import { shorten } from "../sharing";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_COLORS = { cream: "#f6f4ec", green: "#245b36", ink: "#262420", muted: "#6f6a5c" };
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** Bounded, allowlisted loading. Bundled photos never fetch the production site. */
export async function loadOgPhoto(photo?: string): Promise<string | null> {
  if (!isAllowedImageReference(photo, process.env.BLOB_STORE_ID)) return null;
  try {
    let buffer: Buffer;
    let mime: string;
    if (photo.startsWith("/")) {
      const file = path.join(process.cwd(), "public", photo);
      if ((await stat(file)).size > MAX_PHOTO_BYTES) return null;
      buffer = await readFile(file);
      mime = photo.endsWith(".png") ? "image/png" : "image/jpeg";
    } else {
      const response = await fetch(photo, { signal: AbortSignal.timeout(3500), redirect: "error" });
      mime = response.headers.get("content-type")?.split(";")[0] ?? "";
      if (!response.ok || !["image/jpeg", "image/png", "image/webp"].includes(mime)) { await response.body?.cancel(); return null; }
      if (Number(response.headers.get("content-length")) > MAX_PHOTO_BYTES) { await response.body?.cancel(); return null; }
      if (!response.body) return null;
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > MAX_PHOTO_BYTES) { await reader.cancel(); return null; }
        chunks.push(value);
      }
      buffer = Buffer.concat(chunks);
    }
    return buffer.length ? `data:${mime};base64,${buffer.toString("base64")}` : null;
  } catch {
    return null;
  }
}

/** Finish rendering before headers so corrupt photos can fall back cleanly. */
export async function ogResponse(render: (photo: string | null) => ReactElement, photo: string | null = null, dynamic = false) {
  let buffer: ArrayBuffer;
  try {
    buffer = await new ImageResponse(render(photo), OG_SIZE).arrayBuffer();
  } catch (error) {
    if (!photo) throw error;
    buffer = await new ImageResponse(render(null), OG_SIZE).arrayBuffer();
  }
  return new Response(buffer, { headers: {
    "Content-Type": "image/png",
    "Cache-Control": dynamic ? "public, max-age=0, must-revalidate" : "public, max-age=3600",
  } });
}

export function GearMark({ jersey = false }: { jersey?: boolean }) {
  return jersey ? <svg width="280" height="300" viewBox="0 0 280 300"><path d="M80 35 25 70 5 135 57 155 75 118 75 270 205 270 205 118 223 155 275 135 255 70 200 35 174 35C173 76 107 76 106 35Z" fill="#f6f4ec" /><path d="M105 130h70M105 157h70" stroke="#245b36" strokeWidth="12" /></svg>
    : <svg width="300" height="300" viewBox="0 0 300 300"><circle cx="150" cy="150" r="140" fill="#f6f4ec" /><circle cx="150" cy="150" r="110" fill="none" stroke="#245b36" strokeWidth="4" /><circle cx="150" cy="150" r="100" fill="none" stroke="#245b36" strokeWidth="2" /><path d="M95 176 130 112 156 151 180 113 208 176Z" fill="#245b36" /></svg>;
}

export function BrandCard({ eyebrow = "THE ULTIMATE FRISBEE MARKETPLACE", title = "Good gear. Great stories. Next chapter.", description = "Trade jerseys. Collect discs. Find your people.", footer = "Free to join. Free to list.", photo }: {
  eyebrow?: string; title?: string; description?: string; footer?: string; photo?: string | null;
}) {
  const c = OG_COLORS;
  return <div style={{ width: "100%", height: "100%", display: "flex", background: c.cream, color: c.ink }}>
    <div style={{ display: "flex", flexDirection: "column", width: 790, padding: "45px 54px", justifyContent: "space-between" }}>
      <div style={{ display: "flex", fontSize: 42, fontWeight: 700, letterSpacing: -2, color: c.green }}>Poachland<span style={{ color: c.ink }}>↗</span></div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 17, letterSpacing: 2, color: c.green, marginBottom: 20 }}>{shorten(eyebrow, 55)}</div>
        <div style={{ fontSize: title.length > 65 ? 56 : 72, fontWeight: 700, letterSpacing: -3, lineHeight: 1.05, whiteSpace: "pre-wrap" }}>{shorten(title, 105).replaceAll(". ", ".\n")}</div>
        <div style={{ fontSize: 25, lineHeight: 1.35, marginTop: 24, color: c.muted }}>{shorten(description, 130)}</div>
      </div>
      <div style={{ display: "flex", fontSize: 21, borderTop: "2px solid #d7dccf", paddingTop: 20, color: c.green }}>{shorten(footer, 65)}</div>
    </div>
    <div style={{ display: "flex", width: 410, background: c.green, alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 42 }}>
      {photo ? <img src={photo} alt="" width={290} height={290} style={{ objectFit: "cover", borderRadius: 145, border: "8px solid #f6f4ec" }} /> : <GearMark />}
      <div style={{ fontSize: 24, color: c.cream }}>poachland.com</div>
    </div>
  </div>;
}
