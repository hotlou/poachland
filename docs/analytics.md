# Product analytics definitions

Poachland records successful server-side marketplace actions in the append-only
`product_events` table. Client navigation and button clicks are intentionally
not treated as conversion evidence. User IDs are retained for unique-user and
retention counts; event properties contain product metadata, not email
addresses, message bodies, payment handles, or shipment details.

## Acquisition and activation

- **Direct members:** users without a persisted `referred_by` value.
- **Referred members:** users whose onboarding resolved a valid, onboarded,
  non-self referrer. Invalid and self referrals are recorded as direct.
- **Onboarded:** successful, one-time `onboarding_completed` events.
- **Activated listers:** distinct users with at least one successful
  `listing_created` event.
- **Listing activation rate:** activated listers divided by onboarded users.

The referral reward is a non-monetary profile badge. A referral does not grant
cash, marketplace credit, ranking, verification, or moderation privileges.

## Marketplace funnel

- **Listings:** successful listing creations.
- **Offers:** newly opened trade, purchase, or claim negotiations. Counteroffers
  do not inflate this acquisition-stage count.
- **Accepted:** offers accepted by the counterparty.
- **Completed:** deals for which both parties confirmed receipt or handoff.
- **Disputed:** accepted deals escalated to moderation.

Acceptance rate uses opened offers as its denominator. Completion and dispute
rates use accepted offers. These lifetime ratios are operational indicators,
not cohort conversion rates; export event-level data for cohort analysis.

## Activity and retention

Seven- and thirty-day active members are distinct authenticated users with at
least one successful tracked marketplace event in the rolling window. This is
an action-based active-user measure, not a page-view measure. The 30-day active
rate divides that count by all members.

## Data quality checks

- Every event must have a generated `evt_` identifier and server timestamp.
- Subject identifiers are entity IDs, never user-entered labels.
- Referral attribution is tested through the complete onboarding path.
- The engine smoke suite reconciles event-derived funnel, acquisition,
  activation, and rolling active-user counts against its isolated database.
