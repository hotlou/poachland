# Poachland

The ultimate frisbee collector marketplace. Trade jerseys. Collect discs. Built by players, for players.

## What this is

A mobile-first web app where ultimate frisbee players list, discover, and complete trades or sales of jerseys and discs. All listings are free. No fees. Community trust built in.

**Live demo routes:**
- `/` — Landing page
- `/onboarding` — 4-step onboarding flow
- `/app` — Home feed (authenticated shell)
- `/app/browse` — Browse + search with filters
- `/app/listings/[id]` — Listing detail with photo gallery
- `/app/create` — Create listing flow
- `/app/profile` — User profile / collector showcase
- `/app/wanted` — Wanted board (ISO posts)
- `/app/wanted/create` — Create ISO post
- `/app/trades/new` — Trade proposal flow
- `/app/inbox` — Message inbox
- `/app/notifications` — Notification feed
- `/app/ratings` — Ratings & reputation page
- `/admin` — Admin/moderation dashboard scaffold

## Tech stack

- **Framework:** Next.js 16 (App Router)
- **UI:** React 19, TypeScript, Tailwind CSS v4, shadcn/ui
- **Fonts:** Barlow Condensed (display), Inter (body) via `next/font/google`
- **Icons:** lucide-react
- **State:** Client-side React hooks (no backend yet)
- **Deployment:** Vercel-ready

## Design system

| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `oklch(0.09 0 0)` | Near-black base |
| `--surface` | `oklch(0.13 0 0)` | Card/elevated surfaces |
| `--accent` | `oklch(0.82 0.23 142)` | Electric grass green — CTAs, badges, active states |
| `--accent-foreground` | `oklch(0.09 0 0)` | Text on accent backgrounds |
| Display font | Barlow Condensed 600–900 | Headings, badges, navigation |
| Body font | Inter | Body text, descriptions, inputs |

**Visual language:** Dark base, high-contrast cards, stamp/sticker badges, grain texture overlay, card-lift hover animations, photo-forward listing cards.

## Project structure

```
app/
  layout.tsx              # Root layout (fonts, metadata, analytics)
  globals.css             # Design tokens, base styles, badge/card utilities
  page.tsx                # Landing page
  onboarding/page.tsx     # 4-step onboarding
  admin/page.tsx          # Admin dashboard scaffold
  app/
    layout.tsx            # Authenticated shell (bottom nav, max-width)
    page.tsx              # Home feed
    browse/page.tsx       # Browse + search + filters
    listings/[id]/page.tsx # Listing detail
    create/page.tsx       # Create listing
    profile/page.tsx      # Current user profile
    wanted/page.tsx       # Wanted board
    wanted/create/page.tsx # Create ISO post
    trades/new/page.tsx   # Trade proposal flow
    inbox/page.tsx        # Messages
    notifications/page.tsx # Notifications
    ratings/page.tsx      # Ratings & reputation

components/
  bottom-nav.tsx          # Mobile bottom navigation
  listing-card.tsx        # Reusable listing card
  trust-badge.tsx         # TrustBadge + TrustScore components
  photo-gallery.tsx       # Swipeable photo gallery for listing detail
  ui/                     # shadcn/ui primitives

lib/
  seed-data.ts            # Demo data with full type definitions
  utils.ts                # cn() utility
```

## Database schema (next phase)

When connecting to a real database (Supabase, PlanetScale, Neon, etc.), here are the tables needed:

### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| username | varchar(30) | unique, lowercase |
| display_name | varchar(100) | |
| email | varchar(255) | unique |
| avatar_url | text | |
| bio | text | max 500 chars |
| location | varchar(100) | |
| favorite_teams | text[] | array of team names |
| trust_score | decimal(2,1) | computed from ratings, 0.0-5.0 |
| trades_completed | int | computed |
| is_verified | boolean | default false |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `badges`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK -> users |
| type | enum | founding, trusted, veteran, collector, quick-shipper |
| label | varchar(50) | display label |
| awarded_at | timestamptz | |

### `listings`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| seller_id | uuid | FK -> users |
| item_type | enum | jersey, disc |
| title | varchar(200) | |
| team | varchar(100) | |
| year | varchar(4) | nullable |
| division | enum | open, women, mixed, masters (nullable) |
| level | enum | club, college, pro, national, tournament |
| size | varchar(5) | nullable (jerseys only) |
| condition | enum | Mint, Near Mint, Good, Fair, Worn |
| listing_type | enum | trade, sell, trade+cash, free |
| asking_price | decimal(8,2) | nullable |
| trade_for | text | nullable |
| description | text | |
| shipping_preference | enum | seller-pays, buyer-pays, local-only |
| tags | text[] | |
| is_rare | boolean | default false |
| is_featured | boolean | default false |
| status | enum | active, sold, traded, removed |
| views_count | int | default 0 |
| saves_count | int | default 0 |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `listing_photos`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| listing_id | uuid | FK -> listings |
| url | text | |
| sort_order | int | 0-indexed position |

### `iso_posts`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK -> users |
| item_type | enum | jersey, disc |
| description | text | |
| team | varchar(100) | nullable |
| size | varchar(5) | nullable |
| max_price | decimal(8,2) | nullable |
| saves_count | int | default 0 |
| status | enum | active, found, closed |
| created_at | timestamptz | |

### `trade_proposals`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| from_user_id | uuid | FK -> users |
| to_user_id | uuid | FK -> users |
| offered_listing_id | uuid | FK -> listings |
| wanted_listing_id | uuid | FK -> listings |
| cash_added | decimal(8,2) | nullable |
| note | text | |
| status | enum | pending, accepted, rejected, countered, completed, expired, disputed |
| shipped_at | timestamptz | nullable |
| tracking_number | varchar(100) | nullable |
| received_at | timestamptz | nullable |
| completed_at | timestamptz | nullable |
| expires_at | timestamptz | 7 days from creation |
| created_at | timestamptz | |

### `ratings`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| trade_id | uuid | FK -> trade_proposals |
| from_user_id | uuid | FK -> users |
| to_user_id | uuid | FK -> users |
| communication | int | 1-5 |
| shipping_speed | int | 1-5 |
| item_accuracy | int | 1-5 |
| would_trade_again | boolean | |
| comment | text | nullable |
| created_at | timestamptz | |

**Constraint:** Ratings unlock only after both parties mark the deal complete.

### `messages`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| thread_id | uuid | FK -> trade_proposals or separate threads table |
| sender_id | uuid | FK -> users |
| content | text | |
| read_at | timestamptz | nullable |
| created_at | timestamptz | |

### `notifications`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK -> users |
| type | enum | trade_proposal, offer_accepted, offer_rejected, iso_match, new_message, deal_complete, new_rating |
| title | varchar(200) | |
| body | text | |
| link_to | varchar(255) | nullable |
| read | boolean | default false |
| created_at | timestamptz | |

### `saves`
| Column | Type | Notes |
|--------|------|-------|
| user_id | uuid | composite PK |
| target_type | enum | listing, iso_post |
| target_id | uuid | composite PK |
| created_at | timestamptz | |

### `reports`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| reporter_id | uuid | FK -> users |
| target_type | enum | listing, user, trade |
| target_id | uuid | |
| reason | text | |
| status | enum | pending, reviewed, resolved, dismissed |
| created_at | timestamptz | |

### `blocks`
| Column | Type | Notes |
|--------|------|-------|
| blocker_id | uuid | composite PK |
| blocked_id | uuid | composite PK |
| created_at | timestamptz | |

## Deployment to Vercel

```bash
pnpm install
pnpm dev        # localhost:3000
pnpm build      # production build
npx vercel      # deploy via CLI, or connect repo in Vercel dashboard
```

No env vars needed for the demo. In production, add:
- `DATABASE_URL` — Postgres connection string
- `NEXTAUTH_SECRET` — Auth session secret
- `NEXTAUTH_URL` — Canonical app URL
- `CLOUDINARY_URL` or `UPLOADTHING_SECRET` — Image storage
- `RESEND_API_KEY` — Transactional email

## Product principles

- All listings are free. No fees to list or complete a deal.
- No fake trades, no fake users, no dark patterns.
- Trust is the product.
- Built for 400,000 people who actually play this sport.

---

**Poachland** — What are you hunting?
