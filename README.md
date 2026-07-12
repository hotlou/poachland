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
- **Accounts** — magic-link email sign-in, plus an optional password (set it in Settings after your first sign-in; scrypt-hashed, lockout after repeated failures, magic link doubles as password recovery). First sign-in claims your username through onboarding. Sessions are 30-day sliding httpOnly cookies backed by Postgres.
- **Identity scaffolding** — traders can link Instagram / Facebook / USAU ID handles to their profile (shown as chips); moderators verify them in the admin queue, laying the groundwork for real-life-identity reputation.

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
- `/app/settings` — account, linked identities, blocked traders
- `/admin` — moderation dashboard

## Tech stack

- **Framework:** Next.js 16 (App Router)
- **UI:** React 19, TypeScript, Tailwind CSS v4, shadcn/ui
- **Fonts:** Barlow Condensed (display), Inter (body) via `next/font/google`
- **Icons:** lucide-react
- **Data:** Postgres (Neon in production, embedded PGlite for local dev) via Drizzle ORM
- **Auth:** custom magic-link flow (Resend for email delivery) + optional passwords (scrypt), Postgres-backed sessions
- **State:** server-authoritative world snapshots with an optimistic client store
- **Deployment:** Vercel

## Architecture

Server-authoritative, optimistic client:

```
lib/
  types.ts           # Domain model (shared client/server)
  shared/ops.ts      # THE CONTRACT: every mutation op + WorldSnapshot shape
  engine.ts          # PoachStore — the rules engine the client runs optimistically
  remote-store.ts    # RemotePoachStore: applies mutations locally for instant UI,
                     # dispatches to the server, reconciles with its snapshot
  store-context.tsx  # React binding: useStore(), useHydrated(); refetch on focus/45s
  server/
    schema.ts        # Drizzle Postgres schema (all tables + auth + identities)
    db.ts            # Neon (pg Pool) in prod; embedded PGlite locally, auto-migrated
    auth.ts          # magic links (Resend), sessions, ADMIN_EMAILS promotion
    engine.ts        # executeOp(): every rule re-enforced in SQL transactions
    snapshot.ts      # buildSnapshot(): the viewer's world, privacy-scoped

app/actions/         # the only client→server doorway (dispatchOp / fetchBootstrap)
drizzle/             # committed SQL migrations (pnpm db:generate / db:migrate)
```

Every mutation runs twice: once in the browser for instant feedback, then on the server inside a transaction with row locks — the server's snapshot is authoritative and reconciles the client on every response, tab focus, and a 45s poll. Deal/listing ids are client-generated (validated server-side) so optimistic navigation never breaks.

### Deal state machine

```
open ──accept──▶ accepted ──both confirm──▶ completed ──▶ ratings unlock
 │ │ │                │ │
 │ │ └─ counter (new offer version, roles swap)   │ └─ cancel ──▶ cancelled
 │ └─── decline ▶ declined                        └─── dispute ▶ disputed ▶ (admin: cancel/complete)
 └───── withdraw ▶ withdrawn        unanswered 7 days ▶ expired
```

Accepting locks every listing in the offer (status `pending`) and auto-declines competing deals that involve those items. Completion flips listings to `traded`/`sold`/`claimed`, increments trade counts, recomputes trust, and awards badges.

## Run it

```bash
pnpm install
pnpm dev        # localhost:3000 — no env vars needed locally:
                # uses embedded PGlite (./.pglite) and logs magic links
                # to the console / shows a DEV link on /login
pnpm build      # production build
```

### Deploy (Vercel + Neon + Resend)

Environment variables (Vercel → Settings → Environment Variables):

| Var | Value |
|-----|-------|
| `DATABASE_URL` | Neon **pooled** connection string |
| `RESEND_API_KEY` | Resend API key (verify a sending domain!) |
| `EMAIL_FROM` | e.g. `Poachland <login@yourdomain.com>` |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `ADMIN_EMAILS` | comma-separated moderator emails |

Then run migrations once against the database:

```bash
DATABASE_URL="postgresql://…-pooler…/neondb?sslmode=require" pnpm db:migrate
```

Production starts with a clean marketplace (no fake users — that's the point).
`SEED_DEMO=yes node scripts/db-seed-demo.mjs` can populate a staging DB with
the demo world; it refuses to run on a non-empty database.

## Product principles

- All listings are free. No fees to list or complete a deal.
- No fake trades, no fake users, no dark patterns.
- Trust is the product.
- Built for 400,000 people who actually play this sport.

---

**Poachland** — What are you hunting?
