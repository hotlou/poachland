/**
 * robots.txt — everything public is crawlable; the signed-in app shell,
 * admin, and API routes are not.
 */

import type { MetadataRoute } from "next";

const origin = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://poachland.com"
).replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/app/", "/admin", "/api/"],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
  };
}
