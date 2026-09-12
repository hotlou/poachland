import { BrandCard, ogResponse } from "@/lib/server/og-image";
export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Find your people. Find your next trade. \u2014 Poachland";
export default function Image() { return ogResponse(() => <BrandCard eyebrow={"MEET THE COMMUNITY"} title={"Find your people. Find your next trade."} description={"Explore collector profiles, playing history, ratings, and ultimate gear."} />); }
