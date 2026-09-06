# Production release record — 2026-09-06

This record is intentionally incomplete until every required release gate has
authoritative evidence. It contains no credentials or customer data.

## Deployed artifact

- Git revision: `a53a7464a04d5a48eec16b8124b183a7ca652b86`
- Vercel deployment: `dpl_ARsga2LvStYctFyJ8eUbZi9sgwa7`
- Immutable URL: `https://v0-poachland-by6fcv8a5-hotlous-projects.vercel.app`
- Production aliases: `https://poachland.com`, `https://www.poachland.com`
- Vercel state observed at 2026-09-06 22:38 UTC: Ready

## Verified evidence

- `GET https://poachland.com/api/health` returned HTTP 200 at 2026-09-06
  20:56 UTC with database, email delivery, and upload cleanup all `ok` and a
  measured dependency latency of 29 ms.
- The public production probe passed routes, dependency health, no-store health
  caching, and the required CSP, HSTS, frame, content-type, referrer, and
  permissions headers.
- An authenticated operator exercised production sign-in and a Vercel Blob
  image upload successfully after this deployment.
- `pnpm verify:production -- https://poachland.com https://www.poachland.com`
  passed at 2026-09-06 22:38 UTC. Public and policy routes, dependency health,
  no-store health caching, required security headers, and the permanent
  canonical redirect all passed against the current production aliases.
- Security workflow passed for the deployed revision:
  `https://github.com/hotlou/poachland/actions/runs/34064121767`.
- The external `Production health` workflow passed by manual dispatch against
  the deployed revision at 2026-09-06 22:39 UTC:
  `https://github.com/hotlou/poachland/actions/runs/34064632613`.
- Vercel production runtime logs show the authenticated background worker
  completing at 22:30, 22:35, and 22:40 UTC. Each run independently processed
  the email queue and abandoned-upload cleanup with zero dead letters and zero
  cleanup backlog, confirming the five-minute cron is active without user
  traffic.
- The complete local `pnpm check` gate passed on the pending follow-up worktree:
  lint, types, 52 unit/integration tests, migration safety, 60 smoke checks,
  representative load targets, and the production build.

## Open release gates

- Quality CI for the deployed revision reached all 18 desktop journeys: 13
  passed, one passed on retry, and four complete marketplace lifecycle tests
  exceeded Playwright's 30-second default while two workers shared the single
  embedded test database. The pending worktree serializes that test database
  and gives multi-user lifecycle journeys 90 seconds; it requires a commit and
  green desktop/mobile GitHub run.
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
