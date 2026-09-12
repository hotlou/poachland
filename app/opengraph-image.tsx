import { BrandCard, ogResponse } from "@/lib/server/og-image";

export const runtime = "nodejs";
export const alt = "Poachland — trade jerseys, collect discs, find your people";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return ogResponse(() => <BrandCard />);
}
