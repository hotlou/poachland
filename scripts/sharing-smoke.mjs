/** Read-only crawler checks. Run against a running app; optional public fixture IDs expand coverage. */
import assert from "node:assert/strict";

const origin = process.env.SHARING_SMOKE_URL ?? "http://localhost:3000";
const listingId = process.env.SHARING_SMOKE_LISTING_ID;
const username = process.env.SHARING_SMOKE_USERNAME;
const vendor = process.env.SHARING_SMOKE_VENDOR_SLUG;
const routes = ["/", "/?ref=sharing-smoke", "/browse", "/wanted", "/shop", "/haul", "/traders", "/privacy", "/terms", "/accessibility", "/buyer-protection", "/community-guidelines", "/login", "/onboarding", "/goodbye", "/app", "/app/browse", "/app/inbox", "/app/trades", "/app/settings", "/app/create", "/admin", "/l/og-missing-fixture", "/u/og-missing-fixture", "/vendors/og-missing-fixture", "/does-not-exist"];
if (listingId) routes.push(`/l/${encodeURIComponent(listingId)}`, `/app/listings/${encodeURIComponent(listingId)}`, `/app/listings/${encodeURIComponent(listingId)}/edit`);
if (username) routes.push(`/u/${encodeURIComponent(username)}`, `/app/u/${encodeURIComponent(username)}`);
if (vendor) routes.push(`/vendors/${encodeURIComponent(vendor)}`);

const decode = (text) => text.replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&#x27;", "'");
const checkedImages = new Set();
for (const route of routes) {
  const response = await fetch(new URL(route, origin), { headers: { "User-Agent": "Twitterbot/1.0" }, signal: AbortSignal.timeout(60000) });
  assert([200, 404].includes(response.status), `${route}: HTTP ${response.status}`);
  const html = await response.text();
  const head = html.split("</head>")[0];
  const meta = new Map([...head.matchAll(/<meta\s+(?:property|name)="([^"]+)"\s+content="([^"]*)"/g)].map((match) => [match[1], decode(match[2])]));
  for (const field of ["og:title", "og:description", "og:image", "og:image:alt", "twitter:card", "twitter:image"]) assert(meta.get(field), `${route}: missing ${field} in crawler head`);
  assert.equal(meta.get("twitter:card"), "summary_large_image", route);
  // Next may append its own asset hash to file-based OG metadata.
  assert.equal(new URL(meta.get("og:image")).pathname, new URL(meta.get("twitter:image")).pathname, `${route}: OG/Twitter disagree`);
  const image = new URL(meta.get("og:image"));
  assert(["https:", "http:"].includes(image.protocol), `${route}: image must be absolute`);
  if (listingId && [ `/l/${encodeURIComponent(listingId)}`, `/app/listings/${encodeURIComponent(listingId)}` ].includes(route)) {
    assert.equal(image.pathname, `/l/${encodeURIComponent(listingId)}/opengraph-image`);
    assert.equal(new URL(meta.get("og:url")).pathname, `/l/${encodeURIComponent(listingId)}`);
  }
  if (route.startsWith("/app")) assert(meta.get("robots")?.includes("noindex"), `${route}: private page must stay noindex`);
  // Resolve on the target server even if its canonical origin points at production.
  const localImage = new URL(image.pathname + image.search, origin);
  if (!checkedImages.has(localImage.href)) {
    const imageResponse = await fetch(localImage, { signal: AbortSignal.timeout(30000) });
    assert.equal(imageResponse.status, 200, `${route}: image response`);
    assert(imageResponse.headers.get("content-type")?.includes("image/png"));
    const png = Buffer.from(await imageResponse.arrayBuffer());
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    assert.equal(png.readUInt32BE(16), 1200);
    assert.equal(png.readUInt32BE(20), 630);
    assert(png.length < 5 * 1024 * 1024, `${route}: image exceeds 5MB`);
    checkedImages.add(localImage.href);
  }
  console.log(`OK ${route}`);
}
console.log(`Verified ${routes.length} URLs and ${checkedImages.size} unique 1200×630 PNG previews.`);
