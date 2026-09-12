import type { Metadata } from "next";
import { publicUrl } from "./sharing";

export function pageMetadata({ title, description, path, image = "/opengraph-image", imageAlt = title, type = "website", noIndex = false }: {
  title: string;
  description: string;
  path?: string;
  image?: string;
  imageAlt?: string;
  type?: "website" | "profile";
  noIndex?: boolean;
}): Metadata {
  const images = [{ url: publicUrl(image), width: 1200, height: 630, alt: imageAlt, type: "image/png" }];
  return {
    title,
    description,
    ...(path ? { alternates: { canonical: publicUrl(path) } } : {}),
    ...(noIndex ? { robots: { index: false, follow: false } } : {}),
    openGraph: { title, description, ...(path ? { url: publicUrl(path) } : {}), type, siteName: "Poachland", locale: "en_US", images },
    twitter: { card: "summary_large_image", title, description, images },
  };
}
