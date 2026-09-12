/**
 * Public, SEO-grade view of The Haul — the community wall of completed trades
 * at /haul.
 *
 * Metadata describes the wall without counting labeled examples as real trades.
 * The visible page reads the current public feed client-side.
 */

import { pageMetadata } from "@/lib/metadata";
import type { Metadata } from "next";
import { PublicHaul } from "./haul-client";

export const revalidate = 300;

const TITLE = "The Haul — ultimate frisbee trades, celebrated | Poachland";

export async function generateMetadata(): Promise<Metadata> {
  const description = "A home for the jerseys and discs that change hands on Poachland. Browse community trades and clearly labeled examples. Join free.";

  return pageMetadata({ title: TITLE, description: description, path: "/haul", image: "/haul/opengraph-image" });
}

export default async function HaulPage() {
  return <PublicHaul />;
}
