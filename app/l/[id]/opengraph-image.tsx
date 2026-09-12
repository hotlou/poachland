import { getPublicListing } from "@/lib/server/public";
import { BrandCard, GearMark, loadOgPhoto, OG_COLORS, ogResponse } from "@/lib/server/og-image";
import { listingTerms, shorten } from "@/lib/sharing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const alt = "Poachland listing — item photo, condition, size, and current availability";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = await getPublicListing(id).catch(() => null);
  if (!listing) return ogResponse(() => <BrandCard />, null, true);
  const photo = await loadOgPhoto(listing.photos[0]);
  const c = OG_COLORS;
  const details = [listing.size && `SIZE ${listing.size}`, listing.condition].filter(Boolean).join(" · ");
  return ogResponse((src) => <div style={{ width: "100%", height: "100%", display: "flex", background: c.cream, color: c.ink }}>
    <div style={{ display: "flex", width: 650, padding: "44px 48px", flexDirection: "column", justifyContent: "space-between" }}>
      <div style={{ display: "flex", fontSize: 40, fontWeight: 700, letterSpacing: -2, color: c.green }}>Poachland<span style={{ color: c.ink }}>↗</span></div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ color: c.green, fontSize: 19, letterSpacing: 2, marginBottom: 18 }}>{shorten(listing.team || `ULTIMATE ${listing.type}`, 38).toUpperCase()}</div>
        <div style={{ fontSize: listing.title.length > 65 ? 46 : listing.title.length > 38 ? 54 : 66, fontWeight: 700, letterSpacing: -2, lineHeight: 1.08 }}>{shorten(listing.title, 105)}</div>
        <div style={{ display: "flex", fontSize: 23, color: c.muted, marginTop: 22 }}>{details}</div>
        <div style={{ display: "flex", marginTop: 28 }}><div style={{ display: "flex", padding: "12px 22px", background: listing.status === "active" ? c.green : c.ink, color: c.cream, borderRadius: 8, fontSize: 34, fontWeight: 700 }}>{listingTerms(listing)}</div></div>
      </div>
      <div style={{ display: "flex", color: c.green, fontSize: 20, borderTop: "2px solid #d7dccf", paddingTop: 18 }}>{listing.sampleBatchId ? "EXAMPLE LISTING · Not available to trade" : "Ultimate gear. Passed player to player."}</div>
    </div>
    <div style={{ display: "flex", width: 550, background: c.green, padding: "32px", flexDirection: "column", justifyContent: "space-between" }}>
      <div style={{ display: "flex", color: c.cream, fontSize: 17, letterSpacing: 2, justifyContent: "space-between" }}><span>{listing.sampleBatchId ? "SAMPLE ILLUSTRATION" : "FROM THE CRATE"}</span><span>{listing.type.toUpperCase()}</span></div>
      <div style={{ display: "flex", width: 486, height: 450, alignItems: "center", justifyContent: "center", borderRadius: 12, overflow: "hidden", background: src ? "#e8e6df" : c.green }}>
        {src ? <img src={src} alt="" width={486} height={450} style={{ objectFit: "contain" }} /> : <GearMark jersey={listing.type === "jersey"} />}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", color: c.cream, fontSize: 20 }}><span>poachland.com</span><span>Take a look ↗</span></div>
    </div>
  </div>, photo, true);
}
