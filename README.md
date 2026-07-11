# Poachland

The ultimate frisbee collector marketplace. Trade jerseys. Collect discs. Built by players, for players.

## What this is

A mobile-first web app where ultimate frisbee players list, discover, and complete trades, sales, and giveaways of jerseys and discs. All listings are free. No fees. Community trust built in — and now fully functional: every flow below works end-to-end against a real domain engine.

## Features

- **Listings** — post items to trade, sell, trade+cash, or give away free; edit, remove, photos (stock or uploads), tags, condition, shipping preference.
- **Claims** — free items get claim requests with a pitch note; the owner picks who gets it.
- **Negotiation** — real multi-round deals: propose (multiple items + cash), counter-offer from either side, accept, decline with a reason, withdraw. Offers expire after 7 days.
- **Deal lifecycle** — accepted deals lock the items (competing deals auto-close), both parties mark shipped (with tracking) and confirm completion. Either side can cancel or open a dispute for moderators.
- **Trust & reputation** — ratings unlock only after both parties complete a deal: communication / shipping speed / item accuracy + "would trade again". Trust scores are computed from ratings; badges (First Trade, Trusted Trader, Veteran, Quick Shipper, Collector, Community Giver) are earned automatically.
- **Wanted board (ISO)** — post what you're hunting; new listings auto-match against active ISO posts and notify the hunter; "I have this" starts a conversation.
- **Messaging** — per-listing and per-deal threads, offer cards inline, unread counts, system messages for every deal event.
- **Notifications** — every marketplace event lands in the feed with a deep link.
- **Saves** — watchlist for listings and ISO posts.
- **Moderation** — report listings/users/deals, block traders (mutually hides content and prevents deals), admin dashboard with a report queue, dispute resolution, verification, and featuring.
- **Accounts** — onboarding creates a real account; a demo user-switcher (Settings) lets you play both sides of a negotiation.

**Routes:**
- `/` — Landing page
- `/onboarding` — account creation flow
- `/app` — Home feed (your-move strip, hot items, fresh drops, activity, spotlight)
- `/app/browse` — search + filters + sort
- `/app/listings/[id]` — listing detail (state-aware CTAs: propose / buy / offer / claim / message)
- `/app/listings/[id]/edit` — edit listing
- `/app/create` — create listing
- `/app/wanted`, `/app/wanted/create` — wanted board (ISO)
- `/app/trades` — deals dashboard
- `/app/trades/new` — trade proposal flow
- `/app/trades/[id]` — deal room (negotiation timeline, counter composer, fulfillment, ratings)
- `/app/inbox`, `/app/inbox/[id]` — messages
- `/app/notifications` — notification feed
- `/app/ratings` — reputation dashboard
- `/app/profile`, `/app/profile/edit`, `/app/u/[username]` — profiles
- `/app/saved` — saved items
- `/app/settings` — demo user switcher, blocks, reset data
- `/admin` — moderation dashboard

## Tech stack

- **Framework:** Next.js 16 (App Router)
- **UI:** React 19, TypeScript, Tailwind CSS v4, shadcn/ui
- **Fonts:** Barlow Condensed (display), Inter (body) via `next/font/google`
- **Icons:** lucide-react
- **State:** a client-side domain engine (see below) persisted to `localStorage`
- **Deployment:** Vercel-ready, zero config, no env vars

## Architecture

All marketplace logic lives in a single domain engine, cleanly separated from the view layer:

```
lib/
  types.ts           # Domain model. *Record types are persisted; hydrated views for rendering.
  engine.ts          # PoachStore — THE api. Deal state machine, reputation, matching,
                     # notifications, moderation. Every mutation returns Res<T> (ok | error).
  seed.ts            # Internally-consistent demo world (deals in every lifecycle state).
  store-context.tsx  # React binding: useStore() (auto re-render), useHydrated().
  constants.ts       # Labels, colors, stock photos, report reasons.
  format.ts          # timeAgo, formatDate, money…

components/
  listing-card, trust-badge, save-button, offer-card, deal-status-badge,
  star-rating-input, photo-picker, photo-gallery, hydrated, bottom-nav
```

Pages never touch storage or business rules — they call engine methods. **To move to a real backend**, re-implement the `PoachStore` API against a database (the README's schema below maps 1:1 to `lib/types.ts`) and swap the provider; no page changes required.

### Deal state machine

```
open ──accept──▶ accepted ──both confirm──▶ completed ──▶ ratings unlock
 │ │ │                │ │
 │ │ └─ counter (new offer version, roles swap)   │ └─ cancel ──▶ cancelled
 │ └─── decline ▶ declined                        └─── dispute ▶ disputed ▶ (admin: cancel/complete)
 └───── withdraw ▶ withdrawn        unanswered 7 days ▶ expired
```

Accepting locks every listing in the offer (status `pending`) and auto-declines competing deals that involve those items. Completion flips listings to `traded`/`sold`/`claimed`, increments trade counts, recomputes trust, and awards badges.

## Database schema (for the real-backend phase)

The persisted shape in `lib/types.ts` (`DBState`) maps directly to tables: `users` (with rating baselines), `listings`, `iso_posts`, `deals` + `offers` (absolute proposer/owner sides), `threads` + `messages`, `ratings`, `notifications`, `saves`, `reports`, `blocks`, `activity`. Constraint worth keeping: **ratings unlock only after both parties confirm the deal complete** — enforced in `rateDeal`.

## Run it

```bash
pnpm install
pnpm dev        # localhost:3000
pnpm build      # production build
npx vercel      # deploy
```

No env vars needed. All state is per-browser (localStorage); Settings → "Reset demo data" restores the seed world. Settings → "Switch trader" lets you demo both sides of a deal.

## Product principles

- All listings are free. No fees to list or complete a deal.
- No fake trades, no fake users, no dark patterns.
- Trust is the product.
- Built for 400,000 people who actually play this sport.

---

**Poachland** — What are you hunting?
