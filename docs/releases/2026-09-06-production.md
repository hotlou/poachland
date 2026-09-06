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
  lint, types, 53 unit/integration tests, migration safety, 61 smoke checks,
  representative load targets, and the production build.

## Open release gates

- Quality CI run `34065012148` for revision `4dca324` completed the full local
  quality gate, then was cancelled at the 20-minute job limit during desktop
  Playwright. Its server/browser logs captured a Next development-server Fast
  Refresh reload followed by `Router action dispatched before initialization`
  and a truncated JSON response on `/app/create`; downstream lifecycle tests
  consequently timed out and mobile never ran. The pending worktree runs CI
  journeys against the already-built production server while retaining an
  isolated PGlite database and local magic links. The exception is accepted
  only with `CI=true`, an explicit `PGLITE_PATH`, and a non-Vercel runtime. It
  has passed the complete local `pnpm check` gate and still requires a commit
  and green desktop/mobile GitHub run.
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
