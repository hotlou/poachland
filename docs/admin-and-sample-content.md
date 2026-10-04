# Admin and private sample workspaces

Updated October 3, 2026. The admin workspace is `/admin`, restricted to an active moderator using their own account. Public visitors and ordinary members cannot read its data or call its operations.

## Recommended operating model

Use **Hide** for routine moderation. It removes content from public discovery and fresh link previews while retaining the record and transaction context. Use **Restore** to reverse it. Use account suspension for a timed restriction and a ban for an indefinite access restriction; a ban can be restored and does not erase the account.

Use **Delete permanently** only for content that no longer needs to be retained. Deletion requires the exact record ID plus a reason. Listings that appear in any deal or offer cannot be physically deleted on their own; hide them instead. A moderator can erase a real account’s profile and sign-in information after its open, accepted, and disputed deals have been resolved. Minimal completed-deal records remain for counterparties, and audit history remains.

Keep fictional examples in a private collection for admin testing. **Prepare private examples** creates the records without exposing them to visitors or ordinary members. Admin content tools and an authorized Act as session can inspect and edit them. Public discovery, profile and listing URLs, the Haul, sitemaps, and fresh OG previews exclude all examples, regardless of batch state. Examples cannot receive real messages, offers, purchases, claims, saves, comments, or reactions. Publish only owner-supplied gear through the separate **Publish as real inventory** workflow below.

## Workspace sections

| Section | Controls and evidence |
| --- | --- |
| Overview | Real account, listing, deal, rating, message, moderation, and email-queue totals; event-based acquisition/activation; seven- and 30-day activity; separately identified sample totals |
| Samples | Private fixture preview, prepare/extend, archive, and typed-confirmation batch deletion |
| Content | Paginated search across listings, Wanted posts, ratings, Haul posts, and comments; real/sample and visibility filters; hide, restore, and permanent deletion |
| Members | Searchable paginated roster, Act as and existing ban/suspension/restore tools; member activity detail, last signed-in visit, listings, deals, message counts, ratings, reports, recent successful actions, and account erasure |
| Verification | Staff review requests; grant, revoke, block, or clear community checks; review vouch chains and revoke individual vouches; confirm or revoke Instagram account-ownership evidence |
| Instagram | Draft daily/weekly highlights from eligible real activity, review the queue, and control publishing schedules; requires configured Instagram credentials before delivery |
| Review queues | Existing identity, report, and dispute workflows |
| Partners | Existing sponsor/vendor controls |
| Audit log | Paginated actor, action, timestamp, target, and rationale; search by exact target ID; survives deletion |

Admin operations and their audit writes share a database transaction. Moderation reasons are required. The content library is independent of the public bootstrap, so older, hidden, or completed records remain accessible to moderators.

The staff-review, vouching, Instagram DM evidence, and scheduled-sharing policy is specified in [Community trust and Instagram](community-trust-and-instagram.md). Community checks belong to real people using their own accounts; they cannot be granted to private fixtures or managed inventory profiles through Act as.

## Usage definitions

- Marketplace funnel and active-action metrics use successful first-party `product_events`, not button clicks or inferred transactions.
- Signed-in visits use a new `last_active_at` timestamp, updated at most once every five minutes. Support impersonation and sample accounts are excluded. This collection begins with this release; no historical visits are fabricated.
- Signed-out page views and third-party share completion are not measured by this feature. Existing Vercel analytics remains separate.
- Example accounts and records are excluded from real marketplace totals, reputation calculations for real members, referral credit, and founding-member counts. No seed events, notification emails, views, saves, or reaction counts are fabricated.
- Member detail explicitly marks sample history. Demo profile scores are derived from the eight example ratings, have zero historical baselines, and never count toward a real member’s reputation.

## Private fixture collection

Version: `samples_202609_v1`.

- Six fictional profiles with initials-based avatars.
- Twenty-one item records: eight available examples, eleven items from five completed swaps, one pending giveaway, and one removed example used to check the unavailable state.
- Six example deals: five completed swaps and the pending claim, with their connected offers and threads.
- Eight example ratings and five Haul posts. The latest completed swap has no ratings yet.
- Original, labeled vector illustrations for the gear. These are not photographs of inventory someone can purchase.

The content proposal is [marketplace-content-proposal.md](marketplace-content-proposal.md); the authoritative fixture is `lib/sample-content.ts`. Preparation creates the batch atomically with `state = hidden`. Repeating preparation extends its private workspace period without creating duplicates or overwriting edits, hidden items, or individually deleted records. After an entire batch is deleted, deliberate preparation can recreate the fixture only if none of its account IDs has been retained for real inventory.

The default workspace period is 30 days; moderators can choose 1–90 days. The existing authenticated five-minute worker archives expired workspaces independently of page traffic. Archiving retains records and owner editing access. Privacy does not depend on that worker: public reads reject every non-null sample batch ID, even if a legacy record says `published`. The legacy `publish` API verb remains compatible but now performs private preparation only; it cannot reopen public visibility.

## Preparing and archiving examples

1. Open **Admin → Samples → Prepare private examples**, choose the archive period, type `PREPARE samples_202609_v1`, and record a reason. Inspect the private fixture through Content or Members → Act as.
2. Choose **Archive private examples** to archive the workspace. **Prepare private examples** resumes it; edits and moderation decisions remain intact. Both states remain private. Real marketplace content is unaffected.
3. To remove the collection from the database, choose **Delete batch permanently** and type `DELETE samples_202609_v1`. Connected sample profiles, listings, offers, threads, deals, ratings, and Haul posts are deleted together. The batch tombstone and audit history remain.

Batch removal uses explicit database batch ownership, never broad ID-prefix deletion. It refuses unexpected batch sizes and outside relationships rather than deleting real records along with the fixtures.

### CLI fallback when the admin UI is unavailable

The CLI uses the same server implementation and audited actions. It defaults to a manifest-only dry run:

```bash
pnpm samples
```

To prepare private examples locally:

```bash
pnpm samples --action prepare --apply --actor LOCAL_ADMIN_USERNAME \
  --confirm 'PREPARE samples_202609_v1' \
  --note 'Prepare private examples for marketplace and owner editing QA.'
```

Set `PGLITE_PATH` to an isolated local database and leave `DATABASE_URL` unset for local use. The actor must already exist as an active moderator.

With environment variables from the authoritative `hotlous-projects/v0-poachland` production project loaded securely into the process, and the release operator confirmed as an active moderator:

```bash
pnpm samples --action hide --apply --production --actor hotlou \
  --confirm 'HIDE samples_202609_v1' \
  --note 'Archive the private example workspace while investigating a release issue.'
```

To remove the batch before reverting to an application version that does not understand sample batches:

```bash
pnpm samples --action delete --apply --production --actor hotlou \
  --confirm 'DELETE samples_202609_v1' \
  --note 'Remove the example batch before rolling the application back.'
```

Then restore the prior Vercel artifact and run `pnpm verify:production -- https://poachland.com https://www.poachland.com`. The migration is additive; retain it during a code rollback. Older application code does not understand `sample_batch_id` or batch visibility, so hiding the batch alone is not sufficient before reverting to that older code. Delete the example batch first.

The pre-release production artifact verified on September 12 is `dpl_6SjEcGESRaDkfJYyPjJMJ5yuxvfx`, [v0-poachland-qpi60cd1b](https://v0-poachland-qpi60cd1b-hotlous-projects.vercel.app), built from `7b87215e27984c74dda2633ac971b297d95b2795`. Use the authoritative `hotlous-projects/v0-poachland` project for rollback; the similarly named legacy community-app project does not own the production domains.

External services may keep previously fetched previews. Fresh requests for every sample URL receive a public-safe fallback in all workspace states, including immediately after preparation. Static illustration files are bundled design assets and remain in the deployment; deleting the batch removes the marketplace records, not its source-code template or Vercel backups.

## Verification

`node scripts/sample-admin-smoke.mjs` exercises authorization, confirmation, idempotency, relationship guards, real-metric exclusion, public-query exclusion even with legacy publication state, private owner access, snapshot/deep-link privacy, archival, rating recomputation, moderation, purge rollback, audit persistence, and preservation of real sentinel data in an isolated PGlite database.

`tests/e2e/admin-samples.spec.ts` covers private preparation, archival, moderation, removal, member inspection, and owner editing. It checks that public sample pages return 404 and that sample listing/profile OG images match the generic missing-record preview. Editing a private example must not publish its details. The isolated integration suite also verifies that real inventory conversion becomes public and survives sample deletion. The standard quality, migration, smoke/load, and desktop/mobile test gates apply before release.

## Act as and owner-supplied inventory

In **Admin → Members**, use **Act as** beside any non-admin account, including the example profiles. The app opens that member’s profile. Edit their profile, create listings, or open an active listing and choose **Edit**. Photo uploads belong to the account you are acting as. The banner identifies both accounts, warns that changes are live, and offers **Exit** to return to Admin. Start, stop, and successful marketplace mutations are recorded against the real moderator in Audit log. An expired, demoted, or inactive moderator cannot retain this access. Credentials and self-service deletion are unavailable during Act as; use Admin’s account controls after exiting.

Example accounts initially permit only profile and listing edits. New items remain in their example batch, capped at 200 listing records across the six profiles. Owners can privately edit these items whether the workspace is prepared, archived, or expired. Saving changes never publishes them.

To sell or trade actual gear under a separate inventory profile:

1. Act as the example account, replace an active item’s details and every photo, and save. Alternatively, create an item while acting as that account.
2. On its listing page, use **Publish as real inventory**. Supply an inventory handle, profile name, and your actual shipping location. Confirm ownership and the accuracy of the saved details and photos.
3. Publication requires uploaded photos belonging to that account and an active, unhidden item with no deal or offer history. The item becomes available for real messages and offers. The profile is marked **Admin-managed inventory**, with a biography identifying its moderator. Manage its inbox and deals through Act as.

Publication detaches that item and profile from the example batch. It clears the fictional biography, playing history, avatar, badges, rating totals, and trade totals. Original example deals, ratings, Haul posts, and other example items keep their private batch membership; they never contribute to the inventory profile’s real reputation. Managed profiles do not count as organic members or organic product-event actors. Real items and actual completed transactions still count as inventory and trade activity.

Archive or delete remaining examples with the batch controls. Published real inventory survives those operations and can be hidden, removed, or moderated individually in **Content**. After a converted batch is permanently deleted, the original fixture cannot be recreated over retained inventory profiles.

### Historical Act as deployment and rollback

These details document the September 12 Act as release, not the current production target. Migration `0022_redundant_paladin.sql` adds one nullable user column; it rewrites no existing content. The previous production artifact is `dpl_UgAWeCemTNjKsQhUymV4Epv1UDnm` ([deployment](https://v0-poachland-ggxsqtqqe-hotlous-projects.vercel.app)), commit `1c29c26bc2926b1f606a8ee329a9376c796fd64b`. Rollback leaves the additive column in place. If any profiles have been converted, hide their inventory before rolling back: the previous UI does not display the managed-inventory attribution. No examples are converted automatically by this deployment.
