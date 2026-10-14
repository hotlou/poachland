# Patched rollback baseline, 2026-10-14

This candidate starts at production commit `9fda109fd9aa3d339b97f2d32ee16b5084efc819`. It retains that release's authentication, optimistic mutations, fulfillment, rating forms, metrics, and monitoring behavior. It is a distinct rollback target for the launch release, not a rebuild of the launch feature code.

The backport contains the security dependency patch (Next 16.3.8, sharp 0.35.5, source-map-js 1.2.2, Vitest 4.1.11, and the narrowly scoped Next lint matcher replacement), the exact historical secret-scan false-positive fingerprint, and the associated blocking security gates. No high/critical dependency exception remains. See `security-checklist.md` for advisory and matcher details.

The only application changes let existing rating readers accept the launch release's nullable shipping and item-accuracy scores. Shared aggregation, server/client badge calculations, rating detail displays, and public/private profile stars exclude unassessed dimensions. Existing numeric ratings keep their previous arithmetic. This baseline retains the previous numeric rating input contract and forms.

Migration `0025_young_azazel.sql` only drops NOT NULL from the two rating columns. Migrations 0000–0024 are unchanged, and migration 0025, its snapshot, and journal must be byte-identical to the launch release. The baseline can run before or after null ratings have been written. Never restore the NOT NULL constraint or manufacture numeric scores during an application rollback.

## Release sequence

1. Run Quality and Security on the exact baseline commit, including its nullable reader regression tests, production build, desktop/mobile browser checks, and secret scan.
2. Build a separate baseline deployment with the authoritative production project's verified production environment. An isolated restore deployment retains its isolated database environment and must not be promoted as the production artifact.
3. Apply the shared additive migration through the existing controlled migration job. Verify the candidate deployment, then promote the baseline. Record its immutable deployment ID, commit SHA, and environment association in the release evidence.
4. Deploy and verify the full launch release. If it fails, route production back to the recorded baseline deployment while keeping schema 0025 and all newly written records.
5. Verify database health, public browse, authentication, and a scoped marketplace journey after either promotion. Keep the baseline available until the release observation period ends.

The old production deployment using Next 16.3.6 is not an acceptable fallback. This baseline still has the previous release's known product limitations; it is the emergency fallback while a launch regression is repaired. Production promotion and rollback evidence are recorded separately from this source preparation document.

## Focused compatibility check

`pnpm exec vitest run --project integration tests/integration/rollback-nullable-ratings.test.ts` migrates an in-memory database, inserts the new nullable rating shape, recomputes badges and reputation, reads the server snapshot, hydrates the previous client store, and renders the prior rating component. It also proves legacy numeric rows remain writable. It makes no production connections and sends no email.
