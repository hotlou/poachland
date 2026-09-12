# Sharing and social previews

Implementation specification — September 12, 2026.

## Outcome

A member or signed-out visitor can share a listing with useful prepared copy and a public link. Recipients see the item and its important details before opening it. Every HTML page inherits a branded image; primary public destinations have specific cards.

## Implemented behavior

- Shared `ShareButton` on public listings, signed-in listing detail, own profile, and invitations.
- Panel includes a preview, selectable public URL, editable caption, Copy link, Copy post, supported native sharing, Facebook, WhatsApp, Telegram, X, and email.
- Prepared listing copy includes title, terms, team, size, condition, relevant trade request, shipping, and a bounded description. Copy and outgoing destinations use the current edited caption. Editing does not modify the listing.
- Sharing uses `NEXT_PUBLIC_APP_URL`, falling back to `https://poachland.com`, and the public `/l/id` or `/u/username` path. Invitation links preserve `?ref=username`. Current browser parameters and authenticated paths are not copied.
- Clipboard failure reveals a selectable copy field. Native cancellation is quiet; other native errors leave alternative destinations usable. No “posted successfully” claim is inferred from opening a composer.
- Removed listings have no share button. Pending/sold/traded/claimed listings use their state instead of an active price or availability claim.
- Destination links open drafts. Facebook receives the URL; its caption workflow is Copy post and paste. Instagram uses copy/paste or an available native target. No external SDK, auto-publish action, account connection, or tracking redirect is introduced.

## Metadata and image coverage

| URL family | Preview |
| --- | --- |
| `/` and referral URLs | Branded marketplace card |
| `/l/[id]` | Item photo, title, team, size, condition, terms/current state |
| `/app/listings/[id]` | Public listing metadata and `/l/[id]` canonical; remains noindex |
| `/u/[username]`, `/app/u/[username]` | Public trader card; app alias remains noindex |
| `/vendors/[slug]` | Active brand name, tagline, and allowed logo where available |
| `/browse`, `/wanted`, `/haul`, `/shop`, `/traders` | Destination-specific branded headline cards |
| Legal and informational pages | Page-specific social title/description with the branded default image |
| Private app pages, authentication screens, errors, unknown entities | Generic public-safe branded fallback; private data is never used for a card |

OG and Twitter metadata explicitly identify absolute PNG URLs, 1200 × 630 dimensions, alt text, and large-image cards. Next may append a generated asset hash to file-based OG URLs. Both networks still receive the corresponding card. API/data responses are not HTML sharing destinations.

Images use only public-safe database queries. Removed listings and moderated/deleted sellers are excluded by `getPublicListing`; profile and partner cards use corresponding public queries. Dynamic entity images are rendered per origin request with revalidation headers. Third-party caches can continue to show previously fetched metadata; the application cannot retract an image from another service's cache.

Photo fetching accepts only bundled assets or the configured public Blob store. Local assets load directly from disk. Remote loads have a 3.5-second timeout, a 5 MiB limit, and reject redirects. Bad or missing photos use built-in artwork; a corrupt image that fails rendering retries without the photo. PNG, JPEG, and WebP are accepted for remote rendering, with render fallback for unsupported data.

## Acceptance checks

1. Share a listing signed out and signed in. All generated links identify its public page.
2. Change the caption, then inspect WhatsApp/Telegram/X/email links and Copy post. The edit is reflected, special characters survive, and the URL is retained. Copy link contains only the URL.
3. Exercise trade, sale, trade plus cash, free, pending, and completed states. Trade plus cash must never look like a cash-only sale; inactive listings must not invite new offers.
4. On supported devices, invoke native sharing directly from a click. Cancel quietly; on failure retain the destination and copy options. On unsupported devices, omit the native action.
5. Deny clipboard access or test without the API. Show selectable text rather than copying an authenticated URL from the address bar.
6. Verify readable controls, focus trapping and Escape-to-close, selectable copy, and a scrollable panel at narrow widths. The trigger and destination actions have at least 44-pixel target heights.
7. Fetch HTML with a social-crawler user agent without cookies or JavaScript. Confirm metadata appears in the head and generated PNGs are reachable without signing in.
8. Fetch missing/removed/moderated entities and failed photos. The result must not leak hidden details or break the branded fallback.

## Verification and rollout

- Unit coverage: listing terms/states, prepared copy, encoding, bounded X captions, and complete metadata for both card formats.
- `pnpm typecheck`, `pnpm lint`, and `pnpm test:unit`.
- Read-only crawler smoke: `node scripts/sharing-smoke.mjs`. Set `SHARING_SMOKE_URL` for the target server; optional `SHARING_SMOKE_LISTING_ID`, `SHARING_SMOKE_USERNAME`, and `SHARING_SMOKE_VENDOR_SLUG` extend checks to known public entities. The script checks HTML metadata and PNG signatures/dimensions across public, private, and unavailable routes.
- Browser QA uses local demo fixtures only. These fixtures must not be presented as live marketplace activity.
- After deployment, rerun the crawler smoke on the canonical HTTPS origin. Manually check a fresh public listing in Facebook's Sharing Debugger and previews in iMessage, WhatsApp, Telegram, Slack/Discord, and X. Verify actual composer behavior on iOS and Android; local URL and native-API tests cannot prove third-party rendering or app handoff.
- This change does not add share-conversion analytics. Existing server-confirmed listing, offer, completion, and referral events remain the source for product outcomes. A future share-click metric must be labeled as intent, not a completed post or sale.

The marketing handoff is [marketing-feature-spec.md](marketing-feature-spec.md).

### Validation recorded for this change

- TypeScript and ESLint passed. All 60 unit checks passed, including five sharing checks and three image-resilience checks.
- Development crawler smoke passed for 31 URLs, including a known listing, its app alias and edit page, and a known profile and its app alias; nine distinct image endpoints rendered valid 1200 × 630 PNGs.
- Webpack production build passed. Crawler smoke against the resulting local production server passed for 26 URLs and seven distinct images.
- Build traces include bundled photos in all three dynamic entity image functions.
- Visually reviewed listing, sold-listing, and site cards, plus the share panel at desktop and 375-pixel mobile widths. Edited captions updated destination links and the copy action reported success.
- Browser checks confirmed signed-in listing shares use `/l/id`, profile shares use `/u/username`, and every invite destination retains the referral parameter. Escape closes the share panel and returns focus to its trigger.
- The default Turbopack build could not complete in this environment because a worker was denied a local port; webpack provided production-build validation. Third-party live previews, physical-device native sharing/cancellation, and denied-clipboard behavior remain manual release checks. Nothing has been deployed or posted to a social network in this task.
