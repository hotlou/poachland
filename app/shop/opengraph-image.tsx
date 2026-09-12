import { BrandCard, ogResponse } from "@/lib/server/og-image";
export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Good brands. More ultimate. \u2014 Poachland";
export default function Image() { return ogResponse(() => <BrandCard eyebrow={"THE SHOP"} title={"Good brands. More ultimate."} description={"Discover the jersey makers, disc brands, and gear companies backing the community."} />); }
