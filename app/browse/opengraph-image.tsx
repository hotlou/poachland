import { BrandCard, ogResponse } from "@/lib/server/og-image";
export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Your next favorite is in here. \u2014 Poachland";
export default function Image() { return ogResponse(() => <BrandCard eyebrow={"THE CRATE"} title={"Your next favorite is in here."} description={"Jerseys and discs to trade, buy, or claim. Find the gear with your name on it."} />); }
