# Community verification and Instagram highlights

Implementation specification, October 3, 2026. See [operations](operations.md) for deployment and [private fixtures](admin-and-sample-content.md) for seeding real inventory. This release supplies the application workflows; Instagram posting remains disabled until an account is connected and a moderator enables it.

## Member experience

Signup and listing creation stay open to unverified members. A blue check beside a member's name means either staff reviewed the person behind the account or two eligible members vouched for them. It is separate from trade ratings, linked social accounts, and any guarantee about an item or transaction.

Settings → Community verification lets a member request staff review, see their current verification, and obtain a one-time Instagram DM challenge once the destination inbox is configured. On another member's profile, an eligible member can vouch after selecting how they know the person and affirming that they recognize the account. A member can withdraw their vouch later.

### Initial policy

| Rule | Behavior |
| --- | --- |
| Staff root | An active moderator explicitly grants a check in Admin → Verification, with a reason and method of confirmation. Staff may bootstrap their own personal account through this same audited decision. No admin is automatically verified. |
| Community check | Two distinct, currently eligible vouches unlock a blue check. |
| Vouch eligibility | Staff-confirmed members can vouch immediately. Community-confirmed members wait seven days. |
| Issuance limit | Three vouches per rolling 30 days, including withdrawn vouches. One vouch per issuer/recipient pair; withdrawn endorsements cannot be reissued. |
| Roots and cycles | Verification is rebuilt from active staff roots. A circular group without sufficient rooted support cannot establish or retain checks. |
| Staff control | Grant, revoke, block verification, clear override, revoke a particular vouch, and revoke social ownership evidence. Reasons are audited. A revoke/block remains in force until explicitly cleared or replaced by a staff decision. |
| Cascades | Losing an eligible issuer can remove downstream checks. Accounts and listings remain available unless independently moderated. Account sanctions and erasure trigger recalculation; the existing worker also refreshes eligibility. |
| Excluded actors | Sample accounts, managed inventory profiles, deleted/inactive accounts, and Act as sessions cannot verify or issue vouches. |

The `isVerified` field is a derived display cache. The old admin toggle cannot directly set it. Staff overrides, vouches, DM challenges, and social evidence are separate records so phone, other social accounts, and stronger verification methods can be added later without redefining transaction reputation.

## DM account ownership

1. A member supplies the Instagram username they intend to use.
2. Poachland issues a random `POACH-…` code, valid for 60 minutes. Only its hash is stored. A replacement invalidates the old code; issuance is limited to three per day.
3. The member sends the code to the configured Poachland Instagram inbox.
4. Staff read the actual inbox and enter the code, actual sender handle, and review note in Admin → Verification. Staff must affirm that they checked the inbox.
5. The code is consumed once. Confirming ownership adds evidence and requests staff review; it does not independently grant a community check.

A signed webhook can ingest incoming codes once Meta messaging access is connected. It validates the raw request signature, destination account, event shape, size, and message replay. If the payload cannot establish the sender's username, evidence stays pending until staff compare it with the actual inbox. Screenshots and merely adding a handle are not ownership proofs. Active social identities cannot attach to multiple members; revoked reservations can be reclaimed while history remains auditable.

No public story, black image, hashtag, or outbound automated DM is required. A voluntary invitation/share campaign can be added independently from verification.

## Instagram highlights

Admin → Instagram provides:

- Daily, weekly, and 1–30 day custom draft generation, with up to three items per highlight.
- An editable caption, source links, an actual 1080 × 1350 JPEG preview, download, and copy caption.
- Manual approval for the next worker run or a local date/time, cancellation, source refresh, and controlled retry before publication.
- Daily/weekly scheduled generation, explicit automatic approval for future highlights, and a global pause control.
- Published media IDs and a review state for ambiguous API outcomes.

Daily periods use the previous complete UTC day. Weekly periods use the previous Monday–Sunday. Custom periods use the specified number of complete UTC days. Generation happens after the chosen UTC hour. Repeated worker runs use the same period key instead of creating duplicate highlights. The existing five-minute background worker processes up to two due posts per run; no new scheduling vendor is needed.

### Selection and permission

Only actual available listings and publicly shared completed exchanges are candidates. Selection uses a deterministic score: completed exchanges take priority; capped saves and views help rank listings; recency breaks ties. This is a first implementation of “interesting,” without an AI writing service or fabricated activity. It scans bounded recent candidates, not unlimited marketplace history.

Members must opt in in Settings → Poachland highlights. Both participants must opt in for a completed exchange. Real managed inventory can be opted in only by its managing moderator. Staff cannot grant marketing consent while acting as an ordinary member.

A listing must have a valid uploaded photo belonging to its seller. Sample records, hidden/removed records, inactive/deleted members, unresolved source items, and withdrawn permissions are excluded. Publication and image requests recheck current records and permissions. If approved source details change, the post requires a source refresh and fresh approval. Empty periods create no invented content or filler posts.

### Publication safety

Publishing starts paused; daily, weekly, and automatic approval start off. Credentials stay in server environment variables. Drafts, previews, image downloads, and copied captions work without Instagram API credentials when eligible activity exists.

The worker uses persistent leases, container IDs, and a recorded publish attempt. An ambiguous `media_publish` response moves the item to manual review and is never automatically retried. Staff can record the confirmed media ID or cancel the queue item after checking Instagram. Turning automatic approval off affects future generation; Pause stops already scheduled items. After Instagram accepts a post, removing it requires Instagram itself. This application does not promise recall of external copies or cached images.

## Free setup still needed

For **manual DM verification**, provide the real inbox handle you control. Set `INSTAGRAM_HANDLE` on the authoritative Vercel project. Staff can then check messages manually using the existing Instagram app; no API access or paid subscription is needed for this path.

For **automatic Instagram publishing and webhook ingestion**, use a free Instagram professional account (Business or Creator), a Meta developer app, and the Instagram Login integration. Configure the account/app roles and permissions appropriate to the app's mode and requested access. Meta may require review or business verification before broader access; adding environment variables alone does not approve permissions.

| Environment variable | Purpose |
| --- | --- |
| `INSTAGRAM_HANDLE` | Owned inbox handle shown to members and administrators. |
| `INSTAGRAM_ACCOUNT_ID` | Numeric Instagram professional account ID, also used to restrict webhook recipients. |
| `INSTAGRAM_ACCESS_TOKEN` | Server-only account token with the necessary publishing permissions. |
| `INSTAGRAM_API_VERSION` | Supported Graph version selected from Meta's current app configuration, such as `vNN.0`; no guessed version default. |
| `INSTAGRAM_APP_SECRET` | HMAC verification of incoming Meta webhook requests. |
| `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` | Random secret for Meta's callback verification handshake. |

Publishing requires `instagram_business_basic` and `instagram_business_content_publish`; message access uses `instagram_business_manage_messages` as required by Meta's current Instagram Login flow. Callback URL: `https://poachland.com/api/instagram/webhook`. Subscribe the app/account to the relevant incoming messaging events. Keep tokens current and rotate server secrets through Vercel, not in chat or source control.

No Meta Verified subscription, paid SMS provider, Buffer/Hootsuite account, or external AI service is required. Existing hosting, database, and storage usage still apply. Account creation/connection, permission approval, eligible real photos/activity, and member consent remain prerequisites for actual posts.

Official references: [Meta Instagram API workspace](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api), [Instagram API with Instagram Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/), [content publishing](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/content-publishing/).

## Rollout and reversal

Migrations 0023–0024 add tables, columns, and indexes. Existing explicit staff checks on active human-owned accounts are preserved as staff roots. Old social-account achievement badges are retired. Existing sample batches are hidden and remain private even through a normal application rollback.

To stop Instagram, check Pause all scheduled publishing and save. Revoke/clear a member's verification decision through Admin → Verification; do not edit the display cache directly. Roll application code back to the previous immutable deployment if needed, retaining the additive database structures and audit history. A rollback to the old application removes the new controls and must leave Instagram disconnected/paused; do not use the old public sample publishing controls.

## Acceptance checks

The release exercises authorization, concurrent issuance limits, rooted graph/cycle behavior, downstream revocation, challenge replacement/expiry/replay, sender binding, social identity conflicts/reclaim, private samples, real inventory conversion, consent filtering, duplicate window generation, and ambiguous publish outcomes. Desktop and mobile browser journeys cover staff grants, two distinct vouches, withdrawal, consent persistence, posting without a check, and the disconnected Instagram queue.
