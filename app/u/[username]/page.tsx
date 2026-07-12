/**
 * Public, SEO-grade trader profile at /u/[username].
 *
 * Server component: fetches the profile for metadata (title, description,
 * canonical, OG/Twitter — the OG image comes from the sibling
 * opengraph-image.tsx automatically) and 404s unknown usernames. The visible
 * page is rendered client-side from the public store snapshot.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicProfile, type PublicProfile as Profile } from "@/lib/server/public";
import { PublicProfile } from "./public-profile";

export const revalidate = 300;

type PageProps = { params: Promise<{ username: string }> };

function safeDecode(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function profileDescription(profile: Profile): string {
  const stats = [
    `${profile.trustScore.toFixed(1)}★`,
    `${profile.tradesCompleted} trade${profile.tradesCompleted === 1 ? "" : "s"}`,
    ...(profile.location ? [profile.location] : []),
  ].join(" · ");
  const tail =
    profile.bio.trim().slice(0, 160) ||
    "trading ultimate frisbee jerseys & discs on Poachland.";
  return `${stats} — ${tail}`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username: raw } = await params;
  const profile = await getPublicProfile(safeDecode(raw));
  if (!profile) {
    return {
      title: "Trader not found — Poachland",
      robots: { index: false },
    };
  }

  const title = `${profile.displayName} (@${profile.username}) — Poachland`;
  const description = profileDescription(profile);
  const path = `/u/${profile.username}`;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      type: "profile",
      siteName: "Poachland",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { username: raw } = await params;
  const profile = await getPublicProfile(safeDecode(raw));
  if (!profile) notFound();

  return <PublicProfile username={profile.username} />;
}
