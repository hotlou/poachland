# Product backlog

## Launch merchandising: clearly labeled starter activity

Implemented in September 2026: see [Admin and reversible sample publishing](admin-and-sample-content.md) for the approved fixture, moderation workspace, expiry, and rollback controls. `pnpm samples` previews the production-capable batch; the older demo script below remains staging-only.

Seed enough believable ultimate-frisbee marketplace activity that new visitors
can understand Fresh Drops, search, saved matches, profiles, offers, and the Haul
before organic supply reaches critical mass.

Acceptance constraints:

- Seeded accounts, listings, messages, offers, and completed examples must be
  clearly identifiable internally as synthetic and must never inflate product,
  trust, reputation, referral, or conversion analytics.
- Do not invent endorsements, verified identities, ratings, successful trades,
  or claims about real people. Prefer house/demo profiles and owned or licensed
  item photography.
- Public synthetic content must be disclosed as sample or launch inventory; it
  must not impersonate real community members or imply a transaction occurred.
- Listings need an explicit lifecycle (`published_at`, `expires_at`, and
  archival reason), automatic expiration, and a cleanup/archive job independent
  of page traffic.
- Seeded activity should age naturally across recent timestamps, retain enough
  history to demonstrate the product, and be idempotent so reruns do not create
  duplicates.
- Production seeding requires a preview/dry-run, an explicit production flag,
  a bounded fixture version, and a reversible removal command. Staging remains
  the default target.
- Add tests proving expired sample listings leave Fresh Drops/search, synthetic
  events are excluded from analytics, and real user content is never modified.

The existing `scripts/db-seed-demo.mjs` is staging-only and intentionally
refuses non-empty databases. Extend or replace it only after the production
data model and disclosure design above are approved.
