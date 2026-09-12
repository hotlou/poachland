import { BrandCard, ogResponse } from "@/lib/server/og-image";
export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "The one that got away? Ask for it. \u2014 Poachland";
export default function Image() { return ogResponse(() => <BrandCard eyebrow={"THE WANTED BOARD"} title={"The one that got away? Ask for it."} description={"Post the jersey or disc you are hunting. Connect with players who have it."} />); }
