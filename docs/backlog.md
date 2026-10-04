# Product backlog

## Launch inventory and private testing fixtures

September 2026 introduced moderated example content. The October update makes all fictional fixtures private, even if a legacy batch was marked published. See [Admin and private sample workspaces](admin-and-sample-content.md) for preparation, owner editing, archival, and cleanup. `pnpm samples` previews the bounded fixture; `prepare` creates it for admin testing. The older demo script remains staging-only.

Populate the public marketplace with real gear from the owner and a founding
group. Use private examples to inspect layouts, states, and moderation until
actual transactions supply trade history and participant-written ratings.

Acceptance constraints:

- Seeded accounts, listings, messages, offers, and completed examples must be
  clearly identifiable internally as synthetic and must never inflate product,
  trust, reputation, referral, or conversion analytics.
- Fictional history must remain private. Public discovery, listing/profile URLs,
  Haul, sitemaps, and fresh OG previews must exclude it in every batch state.
- Real inventory requires accurate details and photographs of the actual owned
  gear. Converting an example must discard fictional profile reputation and
  clearly identify its admin-managed inventory profile.
- Example and managed inventory accounts cannot earn blue checks or vouch.
  Real-member verification follows the separate staff and community policy in
  [Community trust and Instagram](community-trust-and-instagram.md).
- Private workspaces retain creation time, expiry, and archival reason. An
  authenticated background worker archives them independently of page traffic;
  privacy must hold even before that worker runs.
- Preparation is idempotent and preserves edits and moderation. Fictional dates
  support private state testing and never imply actual marketplace activity.
- Production seeding requires a preview/dry-run, an explicit production flag,
  a bounded fixture version, and a reversible removal command. Staging remains
  the default target.
- Tests must prove examples remain private after preparation, legacy publication,
  and owner editing; sample events are excluded from analytics; and cleanup never
  modifies real member content or previously published real inventory.

The existing `scripts/db-seed-demo.mjs` is staging-only and intentionally
refuses non-empty databases. Use the audited private-batch tooling for admin
fixtures; do not use that staging script as a production importer.
