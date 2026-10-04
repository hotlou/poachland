import { ImageResponse } from "next/og";
import sharp from "sharp";
import { getDb } from "@/lib/server/db";
import { socialImagePost } from "@/lib/server/social-publishing";
import { loadOgPhoto } from "@/lib/server/og-image";
import { shorten } from "@/lib/sharing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const post = await socialImagePost(await getDb(), id, token);
  if (!post) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  const photos = await Promise.all(post.sources.map((source) => loadOgPhoto(source.photo)));
  if (photos.some((photo) => !photo)) return new Response("A source image is unavailable", { status: 410, headers: { "Cache-Control": "no-store" } });
  const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const firstDay = dateFormat.format(post.windowStart);
  const lastDay = dateFormat.format(new Date(post.windowEnd.getTime() - 1));
  const dates = firstDay === lastDay ? firstDay : `${firstDay} — ${lastDay}`;
  const single = post.sources.length === 1;
  const image = new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#f6f4ec", color: "#262420", padding: "64px", fontFamily: "sans-serif" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#245b36" }}><div style={{ fontSize: 60, fontWeight: 700, letterSpacing: -3 }}>Poachland ↗</div><div style={{ fontSize: 23 }}>{dates}</div></div>
    <div style={{ display: "flex", flexDirection: "column", marginTop: 35, marginBottom: 38 }}><div style={{ fontSize: 20, letterSpacing: 3 }}>FROM THE COMMUNITY</div><div style={{ fontSize: 68, fontWeight: 700, letterSpacing: -3, marginTop: 12 }}>Good gear. New chapters.</div></div>
    <div style={{ display: "flex", flexDirection: "column", gap: 24, flexGrow: 1 }}>
      {post.sources.map((source, index) => <div key={source.id} style={{ display: "flex", flexDirection: single ? "column" : "row", justifyContent: "center", background: "#e8ecdf", borderRadius: 20, padding: 22, alignItems: "center", gap: 28, minHeight: 225, flexGrow: 1 }}>
        <img src={photos[index]!} alt="" width={single ? 520 : 220} height={single ? 520 : 220} style={{ objectFit: "cover", borderRadius: 12 }} />
        <div style={{ display: "flex", flexDirection: "column", flex: single ? "0 1 auto" : "1", alignItems: single ? "center" : "flex-start", textAlign: single ? "center" : "left" }}><div style={{ fontSize: 19, color: "#245b36", marginBottom: 14 }}>{source.kind === "haul" ? "SHARED COMPLETED EXCHANGE" : "AVAILABLE ON POACHLAND"}</div><div style={{ fontSize: single ? 45 : 35, fontWeight: 700, lineHeight: 1.15 }}>{shorten(source.title, 90)}</div></div>
      </div>)}
    </div>
    <div style={{ display: "flex", borderTop: "2px solid #bdc8b1", paddingTop: 30, marginTop: 35, justifyContent: "space-between", fontSize: 26, color: "#245b36" }}><div>Find your next jersey or disc.</div><div>poachland.com</div></div>
  </div>, { width: 1080, height: 1350 });
  const jpeg = await sharp(Buffer.from(await image.arrayBuffer())).jpeg({ quality: 88 }).toBuffer();
  return new Response(new Uint8Array(jpeg), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow", "Content-Disposition": `inline; filename="poachland-${post.cadence}-${post.windowEnd.toISOString().slice(0, 10)}.jpg"` } });
}
