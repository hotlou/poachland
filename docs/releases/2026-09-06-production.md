# Production release record — 2026-09-06

This record is intentionally incomplete until every required release gate has
authoritative evidence. It contains no credentials or customer data.

## Deployed artifact

- Git revision: `f43fb6db519f3cc24cdb2861e55810a303d147b0`
- Vercel deployment: `dpl_129GoYGEz2hFqR9i13kvhvuhomLP`
- Immutable URL: `https://v0-poachland-3536xnl12-hotlous-projects.vercel.app`
- Production aliases: `https://poachland.com`, `https://www.poachland.com`
- Vercel state observed at 2026-09-06 20:56 UTC: Ready

## Verified evidence

- `GET https://poachland.com/api/health` returned HTTP 200 at 2026-09-06
  20:56 UTC with database, email delivery, and upload cleanup all `ok` and a
  measured dependency latency of 29 ms.
- The public production probe passed routes, dependency health, no-store health
  caching, and the required CSP, HSTS, frame, content-type, referrer, and
  permissions headers.
- An authenticated operator exercised production sign-in and a Vercel Blob
  image upload successfully after this deployment.
- Security workflow passed for the deployed revision:
  `https://github.com/hotlou/poachland/actions/runs/34059000676`.
- The complete local `pnpm check` gate passed on the pending follow-up worktree:
  lint, types, 52 unit/integration tests, migration safety, 60 smoke checks,
  representative load targets, and the production build.

## Open release gates

- Quality CI failed for the deployed revision because Playwright started a
  production server without its production service contract. The verified
  worktree fix uses an isolated development database for browser journeys and
  still runs the production build separately; it requires a commit and green
  GitHub run.
- `www.poachland.com` currently serves HTTP 200 instead of permanently
  redirecting to the canonical origin. The pending worktree emits a 308 rule in
  the production routes manifest and the external probe will gate it after
  deployment.
- Attach successful production migration-job evidence; a healthy schema is not
  proof of which deployment step applied it.
- Configure and exercise production alerts for 5xx, latency, database pool
  saturation, email dead letters/age, upload cleanup, and failed backups.
- Record the provider backup identifier, PITR retention, and an isolated restore
  drill meeting RPO/RTO.
- Record a staging rollback to the previous immutable artifact, followed by
  health and critical-journey checks.
- Complete the manual mobile/desktop browser, keyboard, screen-reader, zoom,
  contrast, and reduced-motion matrix.
- Record two independent users completing trade, purchase, and claim flows plus
  cancellation and dispute exercises without direct data edits.
