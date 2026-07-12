/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // PGlite (local-dev embedded Postgres) loads its WASM via import.meta.url,
  // which breaks when bundled — load it and pg natively from node_modules.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  // Migrate-on-boot reads the SQL files in ./drizzle at runtime; make sure
  // they ship inside the serverless function bundle.
  outputFileTracingIncludes: {
    "/**": ["./drizzle/**"],
  },
};

export default nextConfig;
