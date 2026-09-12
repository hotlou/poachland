import { getPublicPartner } from "@/lib/server/public";
import { BrandCard, loadOgPhoto, ogResponse } from "@/lib/server/og-image";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "An ultimate gear brand on Poachland";
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const partner = await getPublicPartner((await params).slug).catch(() => null);
  if (!partner) return ogResponse(() => <BrandCard />, null, true);
  const photo = await loadOgPhoto(partner.logo);
  return ogResponse((src) => <BrandCard eyebrow="THE SHOP / GEAR BRANDS" title={partner.name} description={partner.tagline || partner.description} footer="Gear for the ultimate community. Shop direct." photo={src} />, photo, true);
}
