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

## Temporary development dependency exception

Reviewed 2026-10-03; expires **2026-10-17 at 00:00 UTC**. The security workflow runs `node scripts/dependency-audit.mjs`, which retains the full dependency audit and blocks every high/critical finding except the exact case below. It also runs an independent production audit and production dependency graph check. Registry failures, muted findings, incomplete reports and changed report formats fail closed.

The sole exception is [GHSA-vfj7-8cjw-p6xm / CVE-2026-93687](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), `braces@3.0.3`, only through `eslint-config-next > @next/eslint-plugin-next > fast-glob > micromatch > braces`. As of review, the advisory lists no patched release and [the upstream fix PR remains open](https://github.com/micromatch/braces/pull/72). This is an acknowledged development-tooling stack exhaustion risk, not a repaired dependency.

Exposure review: `pnpm why braces --prod --json` returns `[]`; `eslint-config-next` is a development dependency. The only fast-glob call in Next's ESLint plugin 16.3.6 receives the repository-controlled `settings.next.rootDir` ([upstream source](https://github.com/vercel/next.js/blob/v16.3.6/packages/eslint-plugin-next/src/utils/get-root-dirs.ts)). This repository does not set that option, and the application does not import these tooling packages. Marketplace content and uploaded files are not passed into this code path. Reassess this conclusion if lint configuration or application imports change.

The exception rejects any additional dependency path or version, production presence, severity change, or newly reported patched range. It expires automatically. Upgrade to an upstream stable fix and remove this exception when available; do not extend the deadline without a fresh exposure review. No production finding, other advisory, or registry failure is waived.
