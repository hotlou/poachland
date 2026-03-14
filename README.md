# Poachland

A modern marketplace for ultimate frisbee collectors to buy, sell, and trade jerseys, discs, and collectibles. Built for the niche but passionate disc golf community.

## Features

### 🏠 Home Feed
- Personalized feed of listings based on your interests
- Infinite scroll browsing
- Quick preview of each item with pricing and seller info

### 🔍 Browse & Search
- Advanced filtering by category (Jerseys, Discs, Apparel, Collectibles)
- Search by condition, price range, and seller rating
- Sort by newest, trending, or price

### 📝 Create & Manage Listings
- Photo upload with preview
- Detailed product descriptions
- Set pricing or trade preferences
- Manage active listings and sales

### 💱 Trade System
- Propose trades between collectors
- Built-in messaging during negotiations
- Trade completion and escrow handling
- Trade history and feedback

### 👤 User Profiles
- Collector reputation and trust badges
- Public collection showcase
- Trade history and reviews
- Follower/following system

### 📌 Wanted Board (ISO)
- Post items you're looking for
- Set condition preferences and budget
- Get notified when matches appear
- Browse other collectors' ISOs

### 📬 Inbox
- Message threads with other collectors
- Trade offer management
- Notification alerts
- Read/unread status

### 🔔 Notifications
- Real-time trade offers and messages
- Price drop alerts for watched items
- Account verification status
- Community announcements

### 🎯 Onboarding
- User preference collection
- Interest-based personalization
- Trading style preferences
- Quick setup wizard

### 🛡️ Admin Dashboard
- User and listing management
- Flagged content review
- Activity monitoring
- Quick action controls

## Design System

### Color Palette
- **Primary**: #0e0e0e (Near-black background)
- **Accent**: #ccff00 (Acid yellow/grass green)
- **Secondary**: #1a1a1a (Dark gray for cards)
- **Neutral**: #ffffff, #808080 (Text and borders)

### Typography
- **Headings**: Bold, chunky display font
- **Body**: Clean sans-serif for readability

### UI Elements
- Card-based listing design
- Bottom navigation for mobile
- Badge/stamp elements for trust indicators
- Collector culture aesthetic

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript
- **Styling**: Tailwind CSS v4
- **Components**: shadcn/ui
- **Icons**: lucide-react
- **State**: Client-side with React hooks

## Mobile-First Approach

- 44px minimum touch targets
- Bottom navigation for thumb reach
- Responsive grid layouts
- iOS Safari optimized (16px minimum input size)

## Project Structure

```
/app
  /app (authenticated routes)
    /page.tsx (home feed)
    /browse/page.tsx (browse & search)
    /listings/[id]/page.tsx (listing detail)
    /create/page.tsx (create listing)
    /profile/page.tsx (user profile)
    /wanted/page.tsx (wanted board)
    /wanted/create/page.tsx (create ISO)
    /trades/new/page.tsx (propose trade)
    /inbox/page.tsx (messages)
    /notifications/page.tsx (notifications)
    /layout.tsx (app shell)
  /page.tsx (landing page)
  /onboarding/page.tsx (onboarding flow)
  /admin/page.tsx (admin dashboard)
  /layout.tsx (root layout)
  /globals.css (design tokens)

/components
  /bottom-nav.tsx (mobile bottom nav)
  /listing-card.tsx (reusable listing card)
  /trust-badge.tsx (seller reputation)
  /ui/* (shadcn components)

/lib
  /seed-data.ts (mock data)
  /utils.ts (utility functions)
```

## Getting Started

### Installation

1. Clone the repository
2. Install dependencies:
```bash
pnpm install
```

3. Run the development server:
```bash
pnpm dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Environment Variables

No environment variables needed for this demo version. In production, you would configure:
- Database connection
- Authentication provider
- Image storage
- Payment processing

## Features by Page

### Landing Page (`/`)
- Hero section with value proposition
- Feature highlights
- Call-to-action buttons
- Social proof

### Onboarding (`/onboarding`)
- 4-step setup wizard
- Profile customization
- Trading preferences
- Interest selection

### Home Feed (`/app`)
- Infinite scroll listings
- Category filters
- Sort options
- Seller details and ratings

### Browse Page (`/app/browse`)
- Grid view of all listings
- Advanced filters
- Search functionality
- Sorting options

### Listing Detail (`/app/listings/[id]`)
- Full product information
- Photo gallery
- Seller information
- Trade/buy options
- Related items

### Create Listing (`/app/create`)
- Multi-step form
- Photo upload
- Condition selection
- Pricing setup
- Availability settings

### User Profile (`/app/profile`)
- User information
- Collection showcase
- Trading statistics
- Verification badges
- Action buttons

### Wanted Board (`/app/wanted`)
- Browse ISO requests
- Create new ISO (`/app/wanted/create`)
- Filter by category
- Match notifications

### Trade Flow (`/app/trades/new`)
- Propose counter-offers
- Select items to trade
- Add notes and conditions
- Review and send

### Inbox (`/app/inbox`)
- Message threads
- Trade offer details
- Read/unread status
- Quick reply

### Notifications (`/app/notifications`)
- Notification feed
- Type-based filtering
- Delete notifications
- Mark as read

### Admin Dashboard (`/admin`)
- Real-time metrics
- Recent activity log
- Flagged content review
- Quick actions
- User management

## Future Enhancements

- User authentication and real database
- Payment processing and escrow
- Image upload to cloud storage
- Real-time messaging with WebSockets
- Advanced search and recommendations
- User reviews and ratings system
- Community forums and blog
- Mobile app (React Native)
- Analytics dashboard

## Responsive Design

All pages are built mobile-first and scale beautifully to desktop:
- Mobile: Optimized for 375px+ screens
- Tablet: 768px+
- Desktop: 1024px+

## Accessibility

- Semantic HTML
- ARIA labels and roles
- Color contrast compliance
- Keyboard navigation
- Screen reader support
- Focus management

## License

This project is open source and available under the MIT License.

## Support

For questions or feedback, please open an issue or contact the Poachland team.

---

**Poachland** — Where Collectors Connect 🛩️
