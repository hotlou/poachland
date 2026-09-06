# Runtime validation record

Build success is not sufficient evidence that the production server can boot. Run this audit against the exact release artifact before promotion and attach the deployment/monitoring URLs to the release record.

## Local production-artifact check — 2026-09-06

- `pnpm build`: passed.
- `next start` without the production service contract: failed closed during instrumentation startup and named every missing variable in one plain `Error`.
- `next start` with a syntactically complete, non-secret test contract: booted successfully.
- `GET /`: `200`, 28,563 bytes.
- `GET /buyer-protection`: `200`, 24,013 bytes.
- `GET /community-guidelines`: `200`, 22,902 bytes.
- `GET /api/health` with the deliberately unavailable test database: `503`, and emitted the structured `health.failed` event.
- Automated browser control was denied access to localhost by host policy. No visual or assistive-technology pass is claimed from this check; complete the matrix in `accessibility-acceptance.md` on staging.

## Release evidence required

- Deployed revision and immutable build identifier.
- Successful migration job and `/api/health` response with real database, storage, and email-worker dependencies.
- Monitoring dashboard and alert test links.
- Latest successful `Production health` scheduled run and one dated manual
  dispatch failure/success exercise showing alert delivery reaches the release
  owner.
- Backup identifier, point-in-time recovery status, and dated restore-drill evidence.
- Dated rollback exercise showing the prior artifact and compatible schema can serve traffic.
- CI run covering lint, types, unit, integration, smoke/load, build, desktop/mobile E2E, and accessibility.
- Completed manual browser, keyboard, screen-reader, zoom, contrast, and reduced-motion matrix.

Never put real credentials, tokens, payment handles, addresses, or customer data in the release record.

Run the repeatable, read-only production probe after every promotion:

```bash
pnpm verify:production -- https://poachland.com https://www.poachland.com
```

It fails unless public and policy routes render, the health endpoint reports all
dependencies healthy without being cached, required security headers are
present, and the alternate hostname permanently redirects to the configured
canonical origin. Save its timestamped CI or terminal output with the release
record; it does not replace authenticated or destructive-path exercises.

## Vercel Blob service contract

Production and Preview use a connected public Vercel Blob store. The platform
supplies `BLOB_STORE_ID`, `BLOB_WEBHOOK_PUBLIC_KEY`, and the rotating runtime
OIDC credential. Do not add the legacy S3 `STORAGE_*` variables or a static Blob
read/write token. After connecting or replacing a store, redeploy and exercise
an authenticated image upload plus the abandoned-upload cleanup worker.
