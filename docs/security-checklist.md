# Staging security acceptance checklist

The release owner dates and signs each item. A release does not proceed with an unexplained failure.

- [ ] Canonical `NEXT_PUBLIC_APP_URL` is HTTPS and matches the deployed origin.
- [ ] `AUTH_SECRET` and `CRON_SECRET` are unique random values of at least 32 characters; production has no development defaults.
- [ ] CSP, HSTS, frame denial, content-type, referrer, and permissions headers are present on HTML and API responses.
- [ ] Magic links are single-use, expire, and are rate-limited by email and source IP.
- [ ] Session cookies are HTTP-only, secure in production, same-site constrained, and rotate/expire as documented.
- [ ] Cross-origin state-changing requests are rejected; forwarded host/IP headers are trusted only from the hosting platform.
- [ ] Non-admin users cannot call any admin mutation. Admin impersonation cannot target another admin and produces start/stop audit events.
- [ ] Every moderation mutation produces an append-only database audit event with actor, action, target, and time.
- [ ] User-uploaded content is validated for type and size and served from the designated object-storage/CDN origin.
- [ ] Dependency review and secret scanning pass for the release commit.
- [ ] Email worker rejects missing/invalid bearer tokens, leases rows once, retries failures, and exposes dead letters operationally.
- [ ] External health monitoring, structured error logs, alert routing, database backups, and point-in-time recovery are enabled.
- [ ] The latest isolated restore and staging rollback exercises met RPO/RTO and have linked evidence.
- [ ] Account export/deletion, blocking, reporting, disputes, and moderator enforcement were exercised in staging.

## Dependency release gate

Reviewed 2026-10-14. `node scripts/dependency-audit.mjs` runs full and production registry audits. **Every high or critical finding blocks release, without exceptions.** Registry failures, muted findings, incomplete reports and changed report formats fail closed. Run `node --test scripts/dependency-audit*.test.mjs` to verify the policy and installed lint compatibility before auditing.

The launch dependency update uses Next.js and eslint-config-next 16.3.8, sharp 0.35.5, source-map-js 1.2.2, and Vitest/coverage-v8 4.1.11. Sources: [Next security release](https://github.com/vercel/next.js/releases/tag/v16.3.8), [sharp advisory](https://github.com/advisories/GHSA-wq5f-xc86-pv6w), [source-map-js release](https://github.com/7rulnik/source-map-js/releases/tag/v1.2.2), and [Vitest advisory](https://github.com/advisories/GHSA-82fw-gwwq-j7x9). Vitest 4 [removes tinypool](https://v4.vitest.dev/guide/migration#pool-rework), eliminating both reported critical findings without overriding a major version beneath Vitest 3.

The October 14 local audit reports **zero production advisories**, and **zero high/critical findings in the full graph**. One moderate development-only finding remains: [esbuild GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99), via `drizzle-kit > @esbuild-kit/esm-loader > @esbuild-kit/core-utils > esbuild@0.18.20`. This concerns esbuild's development server; the application does not expose that tooling server. It is reported normally by the audit, not muted or exempted. Recheck registry results on the actual release commit.

### Removed braces exception

The temporary exception due to expire October 17 at 00:00 UTC was removed on October 14, **without extending the deadline**. [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) still lists no patched release, and the registry's latest `braces` is 3.0.3. Instead, the vulnerable lint dependency chain was removed entirely.

`package.json` narrowly substitutes published `tinyglobby@0.2.17` for **only** `@next/eslint-plugin-next@16.3.8 > fast-glob`. The pinned pnpm patch adds `expandDirectories: false` to that consumer's `globSync` call, as required by [tinyglobby's migration guide](https://superchupu.dev/tinyglobby/migration#switching-from-fast-glob). This avoids recursively treating nested directories as Next roots. Both packages support the `onlyDirectories` option used by the plugin. Tinyglobby may return equivalent relative paths with trailing slashes; Next joins these with `app`/`pages` before reading them.

The compatibility tests exercise default roots, literal directories, wildcard/brace patterns, arrays, Windows separators, missing roots, and actual internal-link rule detection. They also verify the installed package identity and that both `pnpm why braces --json` and `pnpm why tinypool --json` return `[]`. All existing Next lint rules remain enabled according to `eslint.config.mjs`. Reassess the override and patch when upgrading the pinned Next lint plugin; remove both once its upstream dependency chain is safe. The audit regression test explicitly rejects the previously waived braces path.

## Historical secret-scan false positive

Reviewed 2026-10-14. Commit `34292b466dc1ffea4db658a04433ef564acc78b2`, `lib/engine.ts` line 50, contains `const STORAGE_KEY = "poachland.db.v1"`. This is the public browser localStorage namespace, not a credential or authentication secret. `.gitleaksignore` contains only this exact historical fingerprint:

```text
34292b466dc1ffea4db658a04433ef564acc78b2:lib/engine.ts:generic-api-key:50
```

There is no rule, file, path, regular-expression, or commit-wide allowlist. Secret scanning remains enabled for all other matches, including other occurrences in this file. Gitleaks 8.30.1 scanned all 79 existing commits locally: before the exception it reported exactly this finding; afterward it reported no leaks. An isolated synthetic credential at the same `lib/engine.ts:50` location still triggered `generic-api-key` and exit code 1 with this ignore file loaded. The Security workflow must still pass on the actual release commit, together with Quality; a local scan does not establish those release checks.
