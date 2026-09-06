#!/usr/bin/env node

import assert from "node:assert/strict";

const cliArgs = process.argv.slice(2);
if (cliArgs[0] === "--") cliArgs.shift();
const rawOrigin = cliArgs[0] ?? process.env.NEXT_PUBLIC_APP_URL;
assert.ok(rawOrigin, "usage: pnpm verify:production -- https://poachland.com [https://www.poachland.com]");

const origin = new URL(rawOrigin);
assert.equal(origin.protocol, "https:", "production origin must use HTTPS");
assert.equal(origin.pathname, "/", "production origin must not include a path");

const requiredHeaders = {
  "content-security-policy": ["default-src 'self'", "frame-ancestors 'none'", "object-src 'none'"],
  "permissions-policy": ["camera=()", "microphone=()", "geolocation=()"],
  "referrer-policy": ["strict-origin-when-cross-origin"],
  "strict-transport-security": ["max-age="],
  "x-content-type-options": ["nosniff"],
  "x-frame-options": ["DENY"],
};

async function request(path, init = {}) {
  const response = await fetch(new URL(path, origin), {
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
    ...init,
  });
  assert.equal(response.status, 200, `${path} returned HTTP ${response.status}`);
  for (const [name, fragments] of Object.entries(requiredHeaders)) {
    const value = response.headers.get(name);
    assert.ok(value, `${path} is missing ${name}`);
    for (const fragment of fragments) assert.ok(value.includes(fragment), `${path} ${name} is missing ${fragment}`);
  }
  return response;
}

for (const path of ["/", "/browse", "/buyer-protection", "/community-guidelines"]) {
  const response = await request(path);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/, `${path} is not HTML`);
  await response.body?.cancel();
}

const healthResponse = await request("/api/health", { headers: { accept: "application/json" } });
assert.match(healthResponse.headers.get("cache-control") ?? "", /no-store/, "health response must not be cached");
const health = await healthResponse.json();
assert.equal(health.status, "ok", "health status is not ok");
for (const dependency of ["database", "emailDelivery", "uploadCleanup"]) {
  assert.equal(health.checks?.[dependency], "ok", `${dependency} health check failed`);
}
assert.ok(Number.isFinite(health.latencyMs), "health response has no latency measurement");

const alternate = cliArgs[1];
if (alternate) {
  const alternateUrl = new URL(alternate);
  const response = await fetch(alternateUrl, { redirect: "manual", signal: AbortSignal.timeout(15_000) });
  assert.equal(response.status, 308, `alternate origin returned HTTP ${response.status}, expected 308`);
  assert.equal(response.headers.get("location"), origin.href, "alternate origin does not redirect to canonical origin");
  await response.body?.cancel();
}

console.log(
  `PRODUCTION SMOKE: ${origin.origin} is healthy; security headers, public routes, dependencies${alternate ? ", and canonical redirect" : ""} passed.`,
);
