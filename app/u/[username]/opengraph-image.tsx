import { getPublicProfile } from "@/lib/server/public";
import { BrandCard, loadOgPhoto, ogResponse } from "@/lib/server/og-image";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Poachland trader profile";
export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const profile = await getPublicProfile((await params).username).catch(() => null);
  if (!profile) return ogResponse(() => <BrandCard />, null, true);
  const photo = await loadOgPhoto(profile.avatar);
  const stats = [profile.ratingsCount > 0 ? `${profile.trustScore.toFixed(1)} / 5 rating` : "New trader", `${profile.tradesCompleted} completed trades`, profile.location].filter(Boolean).join(" · ");
  return ogResponse((src) => <BrandCard eyebrow={`MEET @${profile.username}`} title={profile.displayName} description={profile.bio || "Trade ultimate gear. Build your collection. Find your people."} footer={stats} photo={src} />, photo, true);
}
