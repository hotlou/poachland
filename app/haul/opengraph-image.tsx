import { BrandCard, ogResponse } from "@/lib/server/og-image";
export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Great trades deserve an encore. \u2014 Poachland";
export default function Image() { return ogResponse(() => <BrandCard eyebrow={"THE HAUL"} title={"Great trades deserve an encore."} description={"Jerseys and discs, passed player to player. See what the community brought home."} />); }
