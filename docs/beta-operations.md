# Controlled beta operations

## Entry and cohort control

Admit users in small, named cohorts. Confirm the Quality and Security workflows, staging checklist, latest backup, and rollback exercise evidence before widening access. Publish the coordination-only payment model and deal-safety policy in the invite message.

## Daily operating review

- Health probe, 5xx rate, p95 latency, database saturation, email queue age/dead letters, and upload cleanup failures.
- New and unresolved reports, disputes, suspensions, and appeal age against the published moderation targets.
- Acquisition, onboarding completion, first-listing activation, offer acceptance, shipment, bilateral completion, dispute, and 7/30-day retention.
- Qualitative feedback and accessibility barriers from the active cohort.

The beta lead records counts, anomalies, owners, and decisions. Pause invitations when a critical journey is broken, fraud controls are inadequate, alerts are unreliable, backup/rollback evidence is stale, or a Sev 1 incident is active.

## Promotion and rollback

Promote only when two independent users complete every enabled deal type on mobile and desktop, including cancellation and dispute exercises, without staff changing application data. Verify the manual accessibility matrix in `docs/accessibility-acceptance.md`. Roll back using `docs/operations.md`; notify affected testers with scope and next update time.
