const canonicalOrigin = (process.env.NEXT_PUBLIC_APP_URL ?? "https://poachland.com").replace(/\/$/, "");
const canonicalHostname = new URL(canonicalOrigin).hostname;
const alternateHostname = canonicalHostname.startsWith("www.")
  ? canonicalHostname.slice(4)
  : `www.${canonicalHostname}`;

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    unoptimized: true,
  },
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "Content-Security-Policy", value: "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; img-src 'self' data: blob: https:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' https:; upgrade-insecure-requests" },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
      ],
    }];
  },
  async redirects() {
    return [{
      source: "/:path*",
      has: [{ type: "host", value: alternateHostname }],
      destination: `${canonicalOrigin}/:path*`,
      permanent: true,
    }];
  },
  // PGlite (local-dev embedded Postgres) loads its WASM via import.meta.url,
  // which breaks when bundled — load it and pg natively from node_modules.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
};

export default nextConfig;
