/**
 * Public, SEO-grade page for a single gear brand at /vendors/[slug].
 *
 * Server component: fetches the partner for metadata (title, description,
 * canonical, OG/Twitter) and 404s unknown slugs. The visible page is rendered
 * client-side from the public store snapshot.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicPartner } from "@/lib/server/public";
import { VendorDetail } from "./vendor-client";

export const revalidate = 300;

type PageProps = { params: Promise<{ slug: string }> };

function safeDecode(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug: raw } = await params;
  const p = await getPublicPartner(safeDecode(raw));
  if (!p) {
    return {
      title: "Not found — Poachland",
      robots: { index: false },
    };
  }

  const title = `${p.name} — Poachland`;
  const description =
    p.tagline ||
    p.description.trim().slice(0, 160) ||
    `${p.name} — gear for the ultimate community, on Poachland.`;
  const path = `/vendors/${p.slug}`;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      type: "website",
      siteName: "Poachland",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function VendorPage({ params }: PageProps) {
  const { slug: raw } = await params;
  const p = await getPublicPartner(safeDecode(raw));
  if (!p) notFound();

  return <VendorDetail slug={p.slug} />;
}
