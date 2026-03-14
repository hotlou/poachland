# Poachland — v0 Upgrade Prompts

Paste these prompts into v0 one at a time, in order. Each builds on the existing codebase.
Wait for each to finish before pasting the next.

---

## PROMPT 1: Home Feed + Listing Card Polish

```
Redesign the home feed page at app/app/page.tsx and the listing card component at components/listing-card.tsx.

CONTEXT: This is Poachland, an ultimate frisbee jersey/disc collector marketplace. Dark UI (#0e0e0e background), electric grass green accent (#ccff00 / oklch(0.82 0.23 142)). Barlow Condensed for headings (font-display class), Inter for body. The existing seed data is in lib/seed-data.ts — use the DEMO_LISTINGS, DEMO_USERS, and DEMO_ISO_POSTS exports. The existing design tokens are in app/globals.css (bg-background, bg-surface, bg-card, text-accent, badge-stamp class, card-lift class, etc).

LISTING CARD IMPROVEMENTS:
- Make photos larger and more dominant — aspect-[3/4] instead of [4/3] for that Depop-style portrait density
- Condition badges should feel like physical stamps: slight rotation (rotate-[-2deg]), thicker 2px borders, badge-stamp class already exists in globals.css
- Add a subtle shimmer/gradient on "Rare" tagged items — a thin accent-colored line along the top edge of the card
- The listing type badge (Trade, For Sale, Free, Trade+Cash) should sit at bottom-left overlapping the image edge slightly, not top-right
- Seller avatar + username row at the bottom should be tighter, smaller
- On hover: scale the photo slightly (already have group-hover:scale-105), add a faint accent glow to the border
- Make the price/trade label bold and attention-grabbing

HOME FEED IMPROVEMENTS:
- "Hot right now" featured section: make these cards wider (w-60) with a horizontal scroll that feels like flipping through a crate — slight overlap or peek of next card
- Activity feed: add a subtle left-border accent line connecting the activity items, like a timeline
- "Fresh drops" grid: 2 columns on mobile, 3 on wider screens, tighter gap (gap-2.5)
- Wanted board preview: make the ISO cards feel slightly rotated and overlapping, like pinned notes on a board — even just 1-2deg rotation alternating
- Trader spotlight card: add a faint accent border glow, make the avatar larger (w-14 h-14) with a double ring effect (border + ring)
- The profile nudge banner should pulse subtly once on load, then stop

TONE: Dense but not cluttered. Every item has personality. The feed should feel like browsing a physical flea market or record crate. Copy should be dry and community-native. Keep existing empty state copy ("Nothing here yet. Be the first to poach it.").

DO NOT change the data types or seed data structure. Keep all existing imports working.
```

---

## PROMPT 2: Listing Detail Page

```
Redesign the listing detail page at app/app/listings/[id]/page.tsx.

CONTEXT: Poachland — ultimate frisbee collector marketplace. Dark UI, grass green accent. Design tokens and types are defined in app/globals.css and lib/seed-data.ts. There's a PhotoGallery component at components/photo-gallery.tsx that handles swipe — import and use it for the photo section. TrustBadge and TrustScore are at components/trust-badge.tsx. Condition colors are exported as CONDITION_COLORS from seed-data.

THE PAGE SHOULD HAVE THESE SECTIONS (top to bottom, mobile-first):

1. PHOTO GALLERY (full-width, edge-to-edge)
   - Use the PhotoGallery component from components/photo-gallery.tsx
   - Photos should be the hero — full viewport width, aspect-[4/3]
   - Floating back button (top-left, circular, bg-black/50 backdrop-blur)
   - Floating save/heart button (top-right, same style)
   - Photo count pill (bottom-right, e.g. "1/4")

2. ITEM INFO SECTION (px-4)
   - Row of badge-stamps: condition badge (use CONDITION_COLORS), listing type badge, "Rare" if applicable
   - Title: font-display font-800 text-xl, team + year as smaller muted text above it
   - Price or trade preference: large and bold if selling ($65), accent-colored "Open to trades" if trade
   - Size, level, division as small muted metadata row
   - Tags as small pill badges

3. DESCRIPTION
   - Clean readable text, text-sm leading-relaxed
   - Shipping preference badge (seller-pays = "Free shipping" in accent, buyer-pays = "Buyer pays shipping", local-only = "Local pickup only")

4. SELLER CARD
   - Card with seller avatar, display name, username, trust score, badges
   - "View profile" link
   - Member since date, trades completed count
   - This should feel like a proper trust indicator — not just a name

5. ACTION BUTTONS (sticky bottom bar)
   - If trade listing: "Propose Trade" (accent bg, full width) + "Message" (outline, icon)
   - If sell listing: "Make Offer" (accent bg) + "Buy Now" if price is set + "Message"
   - If trade+cash: "Propose Trade + Cash" (accent bg) + "Message"
   - If free: "Claim It" (accent bg) + "Message"
   - Buttons should be in a sticky bottom bar with bg-background/95 backdrop-blur, border-t

6. "You might also like" section
   - Show 2-3 other listings from DEMO_LISTINGS (different from current)
   - Horizontal scroll of ListingCard components

Use the seed data to find the listing by params.id. Show DEMO_LISTINGS[0] as fallback if ID not found. The page uses "use client" and useParams from next/navigation.

VISUAL STYLE: Photo-forward, clean info hierarchy, stamp badges, trust indicators prominent. The CTA bar should feel weighty and satisfying, not like a generic checkout button.
```

---

## PROMPT 3: User Profile / Collector Showcase

```
Redesign the profile page at app/app/profile/page.tsx.

CONTEXT: Poachland — ultimate frisbee jersey/disc marketplace. Dark UI, grass green accent (#ccff00). Barlow Condensed headings, Inter body. Import from lib/seed-data.ts (DEMO_USERS, DEMO_LISTINGS) and components/trust-badge.tsx (TrustBadge, TrustScore). Import ListingCard from components/listing-card.tsx.

THIS IS A COLLECTOR'S SHOWCASE, NOT A SETTINGS SCREEN. The items should do the talking.

LAYOUT (top to bottom, mobile-first):

1. PROFILE HEADER
   - Large avatar (w-20 h-20) centered, with a double-ring effect: inner ring = accent border, outer ring = subtle glow/shadow
   - Display name large and bold below
   - @username in muted text
   - Location with a small map-pin icon
   - Bio text, text-sm, max 3 lines
   - Member since date
   - "Edit Profile" button (outline, small)

2. TRUST & REPUTATION BAR
   - Horizontal card below the header
   - Trust score with stars (TrustScore component, size="lg")
   - Trades completed count, large number
   - Badges displayed as a row of TrustBadge stamps
   - Link to /app/ratings: "See all ratings →"
   - This section should feel like a trust credential — slightly elevated card with accent border-left

3. STATS ROW
   - Three stats in a row: Active Listings | Completed Trades | Saves Received
   - Each with a large number (font-display) and small label below
   - Separated by thin vertical dividers

4. FAVORITE TEAMS
   - Horizontal scrollable chips showing the user's favorite teams
   - Styled like the badge-stamp aesthetic — bordered, uppercase, small

5. COLLECTION TABS
   - Tab bar: "Listings" | "Wanted" | "Completed"
   - "Listings" tab (default): grid of user's active listings using ListingCard (2 cols mobile)
   - "Wanted" tab: list of their ISO posts
   - "Completed" tab: list of completed trades with ratings received
   - Empty states should be interesting, not sad. E.g. "No ISO posts yet. Post what you're hunting."

6. BOTTOM ACTIONS
   - "Share Profile" button
   - "Report User" / "Block User" as subtle text links

Use DEMO_USERS[0] as the current user. Filter DEMO_LISTINGS by sellerId === "u1" for their listings.

VISUAL STYLE: This should feel like a collector's showcase. The items are the personality. Trust indicators should feel earned, like physical patches on a jersey. The page should make you want to trade with this person.
```

---

## PROMPT 4: Wanted Board

```
Redesign the wanted board page at app/app/wanted/page.tsx.

CONTEXT: Poachland — ultimate frisbee collector marketplace. Dark UI, grass green accent. Existing data: DEMO_ISO_POSTS from lib/seed-data.ts. Import types from there too.

THE WANTED BOARD SHOULD FEEL LIKE A PHYSICAL BULLETIN BOARD with pinned notes. Slightly chaotic but visually cohesive.

DESIGN:

1. HEADER
   - "Wanted Board" title, font-display font-800 uppercase
   - Subtitle: "What the community is hunting"
   - "Post ISO" button (accent, links to /app/wanted/create) — styled like a thumbtack or pin action

2. FILTER BAR
   - Quick filters: All | Jerseys | Discs
   - Sort: Newest | Most Saved

3. ISO CARDS (the main content)
   Each ISO post should look like a PINNED NOTE:
   - Card with a slightly off-white/cream tinted background against the dark UI (like bg-[#1a1a18] or similar warm dark)
   - SLIGHT RANDOM ROTATION on each card: alternate between rotate-[-1deg], rotate-[0.5deg], rotate-[1deg], rotate-[-0.5deg] — use the index to vary
   - A small "pin" dot at the top-center of each card (a small colored circle, like a thumbtack)
   - User avatar + username row at top
   - ISO description text as the main content — slightly larger, like handwritten urgency
   - Team name and size as small metadata if present
   - Max price shown as a badge if present: "Budget: $80"
   - Saves count with a small bookmark icon
   - "I have this" button — accent outline, small — this is the main CTA per card
   - Cards should be in a MASONRY-ISH layout: not a perfect grid. On mobile, single column with varied card heights. On wider screens, 2 columns with the rotation creating visual variety.

4. EMPTY STATE
   - If no posts match filter: "Nobody's looking for that yet. Be the first."

5. FLOATING ACTION
   - A floating "Post ISO" button at bottom-right (accent bg, circular with a + icon), linking to /app/wanted/create

VISUAL STYLE: The bulletin board metaphor is key. Not literally a cork board texture, but the FEELING of pinned notes with slight disorder. The rotation, warm card tint, and pin dots create this. The content should feel urgent and personal — these are real people hunting real items.

DO NOT change the ISOPost type or seed data structure.
```

---

## PROMPT 5: Trade Proposal Flow

```
Redesign the trade proposal flow at app/app/trades/new/page.tsx.

CONTEXT: Poachland — ultimate frisbee collector marketplace. Dark UI, grass green accent (#ccff00). Types and data in lib/seed-data.ts. Use DEMO_LISTINGS and DEMO_USERS for demo items.

This flow should feel DELIBERATE AND SATISFYING — like making a real offer to a real person. Not a checkout flow.

MULTI-STEP FLOW:

STEP 1: "What are you offering?"
- Show a grid of the current user's listings (DEMO_LISTINGS filtered by sellerId === "u1")
- Each shown as a selectable card: photo thumbnail, title, condition badge
- Selected card gets an accent border + checkmark overlay
- Only one item can be selected
- "Next" button at bottom (disabled until selection)

STEP 2: "What do you want?"
- Show the listing they're proposing to trade FOR
- This should be pre-selected / shown as a fixed card at top (use DEMO_LISTINGS[1] or pass via searchParams)
- Below it: "Add cash to sweeten the deal?" with a slider/input
- Range: $0 — $100, with $0 as default
- Show the proposed trade visually: YOUR ITEM ←→ THEIR ITEM (with optional +$X)
- Clean visual comparison of the two items side by side

STEP 3: "Add a note"
- Textarea for a personal message
- Placeholder: "Tell them why this is a fair trade..."
- Character count (max 500)
- Show the full proposal summary: your item, their item, cash added, your note
- Preview of what the other person will see

STEP 4: "Send it"
- Full proposal summary card
- "Send Proposal" button (accent, full width, large)
- Below: "Proposals expire in 7 days if no response"
- On click: show a satisfying success state — checkmark animation, "Proposal sent to @username" — then link back to inbox

DESIGN DETAILS:
- Step indicator at top: 4 dots/bars showing progress, accent-filled for completed/current
- Each step should transition smoothly (no page reload, just state change)
- The trade comparison in step 2 should feel like a physical card swap — two cards with a ⇄ icon between them
- The "Add cash" slider should show the dollar amount updating in real-time on the comparison
- Step 4 success state should have a brief scale-up animation on the checkmark

VISUAL STYLE: Each step should feel intentional. This isn't "add to cart → checkout." It's "I'm making you an offer." The comparison view is the emotional core — make it feel like a handshake.

Use "use client", useState for step management. searchParams for the target listing ID.
```

---

## HOW TO USE THESE PROMPTS

1. Push your Poachland repo to GitHub (or wherever v0 can access it)
2. Open v0 connected to that repo
3. Paste Prompt 1, let it generate, review, iterate if needed
4. Commit the result
5. Paste Prompt 2, repeat
6. Continue through all 5

Each prompt is designed to work with the existing codebase — same imports, same types, same design tokens. v0 should be able to drop these changes in without breaking anything else.

If v0 generates something that misses the mark on a specific screen, you can re-prompt with:
"Keep the structure but make [specific thing] more [specific direction]. Reference: [Depop/StockX/Are.na/etc]."

The structural improvements (README, ratings page, photo gallery component) are already in the codebase from the scaffold. These v0 prompts build on top of that.
