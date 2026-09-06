# Poachland operations runbook

This runbook is the minimum production procedure for Poachland. Record every exercise and incident in the team incident system with timestamps, operator, environment, and evidence links.

## Deploy and rollback

1. Confirm the target commit passed the `Quality` and `Security` workflows.
   The Quality gate includes `pnpm test:migrations`, which rejects destructive
   table/column/type changes and enforces one-release schema compatibility.
2. Take a provider snapshot before any destructive migration.
3. Run `DATABASE_URL=... pnpm deploy:prepare` as a dedicated pre-deploy job. Application instances must not be the primary migration mechanism.
4. Deploy the immutable application artifact and verify `GET /api/health` returns HTTP 200.
5. Exercise sign-in, public browse, listing creation, messaging, and a non-production deal lifecycle.

For rollback, stop traffic to the bad artifact, redeploy the last known-good immutable artifact, and verify health and critical journeys. Database migrations must be backward-compatible for at least one application release. If data restoration is required, follow the restore procedure; never improvise a down migration against production.

## Backup and restore

- Enable provider-managed point-in-time recovery and daily logical backups, encrypted with access limited to production operators.
- Retain daily backups for 30 days and monthly backups for 12 months. Alert on missing or failed backups.
- Quarterly, restore the latest backup into an isolated account/project. Never restore over production during an exercise.
- Run migrations, compare row counts for users/listings/deals/messages, sample referential integrity, and run `pnpm test:smoke` against the restored database.
- Measure recovery point and recovery time. Target RPO: 24 hours; target RTO: 4 hours. Delete the isolated copy after evidence is retained.

## Incident response

1. Declare severity and an incident lead. Preserve logs and immutable audit events.
2. Contain: revoke exposed credentials, disable affected features, or roll back. Do not destroy evidence.
3. Communicate scope and user impact on a predictable cadence. Escalate suspected personal-data exposure immediately.
4. Recover using a known-good artifact or tested restore, then verify health and critical journeys.
5. Publish a blameless review within five business days with timeline, root cause, user impact, and owned corrective actions.

Severity targets: Sev 1 (security breach or marketplace unavailable) acknowledge in 15 minutes; Sev 2 (major workflow broken) in 60 minutes; Sev 3 (degraded/non-critical) next business day.

## Email worker

Vercel invokes `/api/internal/email-worker` every five minutes with `Authorization: Bearer $CRON_SECRET`. Use a random secret of at least 32 characters. Workers lease rows for five minutes, retry with exponential delay, and dead-letter after five failed attempts. Alert when dead-lettered rows are nonzero or the oldest ready row is older than 15 minutes. Requeue only after diagnosing the delivery failure.

The same worker removes object uploads that were signed but never attached to a
listing, profile, proof record, or partner after 24 hours. Alert on cleanup
failures. Bucket credentials must be scoped to the single application bucket;
rotate them immediately after suspected exposure.

## Moderation operations

- Triage safety reports and active disputes at least daily. Sev 1 threats, fraud, or doxxing receive immediate containment.
- Record evidence and a factual moderator note before enforcement. Use time-boxed suspension when proportionate; reserve bans for severe or repeated harm.
- Impersonation is for support reproduction only. Never change payment handles, negotiate, ship, rate, or message as a user. Exit immediately after reproduction.
- Every successful admin mutation and impersonation transition must have a corresponding `admin_audit_events` row. Audit rows are append-only and retained for the life of the production database.
- Appeals should be reviewed by a moderator other than the original decision-maker when possible.

## Routine checks

- Continuously probe `/api/health` from outside the hosting provider and alert after two consecutive HTTP failures or `status: degraded` responses. The probe exposes only component states for database connectivity, email delivery, and abandoned-upload cleanup—never queue contents or credentials.
- The `Production health` GitHub workflow provides a five-minute external
  baseline probe of public routes, dependency health, response security
  headers, and canonical-host redirects. Enable GitHub Actions failure
  notifications for the release owner and treat one failed scheduled run as a
  warning; page after a second consecutive failure. GitHub scheduling is not an
  SLO-grade paging service, so retain provider alerts for latency, errors,
  database saturation, queues, and backups.
- Alert on elevated 5xx rate, p95 latency, database connection exhaustion, email dead letters, and backup failure.
- Weekly: review dependency and secret-scanning results and unresolved moderation queue age.
- Monthly: test rollback in staging. Quarterly: perform the restore exercise and an access review.

## Observability and alerts

`instrumentation.ts` registers the application with OpenTelemetry as `poachland-marketplace`. Marketplace mutations emit spans named `marketplace.<operation>` with operation outcome and non-PII actor identifiers; framework, database-adjacent, and outbound fetch spans are captured by the deployment runtime. Configure a Vercel trace drain or OpenTelemetry-compatible integration in production and verify a test trace before promotion.

Create alerts for two consecutive external health-check failures, 5xx rate above 1% for five minutes, p95 request latency above 1.5 seconds for five minutes, database pool use above 80%, any email dead letter, ready email age above 15 minutes, failed upload cleanup, and failed/missing backups. Route alerts to the on-call channel and exercise one synthetic alert during every staging release review.
