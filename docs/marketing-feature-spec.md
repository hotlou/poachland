# Poachland: feature spec and creative handoff

Prepared September 12, 2026. Audience: copywriter, creative strategist, or marketing team.

This describes the product implemented in this repository. The sharing update went live at [poachland.com](https://poachland.com) on September 12, 2026. Production health and social-preview checks passed; see the [release record](releases/2026-09-12-sharing.md). Existing features have been checked against product code and repository documentation; this document does not independently establish audience size or validate every feature in production.

## The product in one sentence

Poachland is a marketplace for ultimate frisbee players to trade, buy, sell, and give away jerseys and discs, with collector profiles, direct negotiation, and a community built around the gear.

## The story to tell

A jersey can represent a team, a tournament, a season, or the player you were when you wore it. A disc can bring back a whole weekend. Poachland gives that gear a next chapter with someone who understands why it matters.

The practical promise: find gear you care about, find the player who has it, and work out the exchange in one place. Posting a listing is free, and Poachland charges no marketplace transaction fee. Shipping and any outside payment-provider charges still depend on the deal and provider.

The sharing promise: **the listing is ready to travel**. Open Share, use the prepared post or edit it, and choose where it goes. The public link carries a branded image with the item and its key details.

## Who we are talking to

| Audience | What they want | Relevant product proof | Useful CTA |
| --- | --- | --- | --- |
| Jersey and disc collectors | The specific team, year, tournament, or item they have been hunting | Search and filters, Wanted posts, matching notifications, saved searches | Browse the crate / Post what you're hunting |
| Players with a trade stack | Turn unworn or duplicate gear into something they want | Trade, sale, trade plus cash, and free listings; multi-item offers | List your gear |
| Teammates and community connectors | Get the right listing in front of the right person | Public listing pages, ready-to-edit share text, direct destinations, invite links | Send it to your team |
| Players ready to pass something along | Give gear another run with someone who wants it | Free listings, claim notes, owner chooses the recipient | Give a jersey its next chapter |

These are intended audiences, not measured customer segments. Do not infer demographics, adoption, inventory volume, or conversion rates from this brief.

## Feature inventory: translate capability into benefit

| Feature | What the product does | What the writer can say |
| --- | --- | --- |
| The crate | Public browsing for jerseys and discs; item details include team, year, size where applicable, condition, photos, tags, and listing type | Find gear that means something to you. |
| Flexible listings | Trade, sell, trade plus cash, or give away an item; edit or remove a listing; specify shipping preference | Your gear. Your kind of deal. |
| Real negotiation | Propose and counter offers with multiple items and cash; accept, decline, or withdraw; open offers expire | Work out a trade that makes sense for both players. |
| Free-item claims | Interested players send a claim note; the owner selects a recipient | Pass it along to someone who will use it. |
| Wanted board | Post an ISO request; matching new listings can notify the hunter; “I have this” starts a conversation | Tell the community what you're hunting. |
| Saves and saved searches | Save listings and Wanted posts; save browse filters and receive matching-listing notifications | Keep your next find in sight. |
| Direct messages | Listing and deal conversations, inline offers, and a record of deal events | Keep the details of the deal together. |
| Deal coordination | Accepted deals lock their items; traders record shipment tracking and evidence; both sides confirm completion | Agree on the details, track the handoff, and close the loop. |
| Profiles and reputation | Public profiles, playing history, galleries, completed-trade counts, and ratings after completed deals | Get to know the player behind the gear. |
| Community recognition | Collecting, generosity, trading, and community badges; Founding Member eligibility for the first 1,000 members | Build a collection and a reputation. |
| The Haul | Share completed trades to a public community wall with reactions and comments | Show the community what came home. |
| Sharing, updated in this change | Share listings from public and signed-in pages; edit a prepared post; copy the link or whole post; choose a destination | Find something for a teammate? Send the whole story. |
| Invitations | Share a personal referral link; eligible completed referrals earn the Connector badge | Bring your people into the crate. |
| The Shop | Discover participating gear brands and visit their sites | Find brands backing ultimate. |
| Account and community tools | Email-link sign-in, optional password, notification controls, reports, blocking, account export and deletion | Join simply and control your experience. |

Do not lead consumer copy with implementation details such as databases, email vendors, admin tooling, or rate limits.

## Sharing: the customer experience

1. Open any public listing, or a listing in the signed-in app, and tap **Share listing**.
2. See the branded link preview and a prepared post with the item title, current price or trade type, team, size, condition, shipping preference, and a short description. Trade requests appear when relevant.
3. Send it as written or edit the post in place. The listing itself is unaffected.
4. Choose a destination, **Copy link**, or **Copy post**. The whole-post option includes the public URL.
5. The recipient can view the listing without an account. Signing in is required for actions such as messaging and making an offer.

The same share panel replaces the old profile-copy action and powers personal invite sharing. Invite links retain their referral parameter. Removed listings have no share control; pending and completed listings identify their current state instead of advertising an active offer.

| Destination | Prepared for the user | How to describe it |
| --- | --- | --- |
| Share to apps | Title, edited text, and public URL passed to the device's share sheet | Choose from sharing apps available on your device. |
| WhatsApp | Edited post and URL | A message ready for a teammate or group. |
| Telegram | Edited post and URL | A message ready to share. |
| X | Shortened caption and URL | A short post ready to review. |
| Email | Subject and message with URL | An email draft ready to finish. |
| Facebook | Public URL for its link preview | Share the listing link; copy and paste the caption if wanted. |
| Instagram or other communities | Copy post; device sharing where supported | Copy your post and paste it where your people are. |

Prepared content is a draft. The user chooses the audience and performs the final send or publish action. Native share availability and the fields a receiving app accepts vary by device. The implementation follows the [Web Share API](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share), [X Web Intents](https://docs.x.com/x-for-websites/web-intents/overview), [WhatsApp click-to-chat](https://faq.whatsapp.com/5913398998672934), and [Telegram sharing](https://core.telegram.org/widgets/share) interfaces. Facebook is intentionally implemented as link sharing with a separate copy-and-paste caption workflow.

## Preview image direction

The visual system is warm cream, deep green, generous type, a Poachland wordmark, and an ultimate-specific jersey or disc motif. Listing cards give almost half the canvas to the item photo. They show the title, team, condition, size when available, and the price, trade terms, or current availability. Photos fit inside the frame so a tall jersey is not cropped to its center.

The homepage and informational/private pages have a branded fallback. The crate, Wanted, Haul, trader directory, and Shop have their own headline cards. Public profiles use the trader's name and available public stats; brand pages use the brand's name and tagline. Missing or failed images fall back to artwork. Unavailable listings and moderated or deleted accounts cannot expose their former details through a freshly fetched preview.

Every preview is a 1200 × 630 PNG with Open Graph and Twitter large-image metadata. A receiving network decides whether and how it displays that preview and may cache an older version. Do not promise an instant image refresh on an already published post.

Local design examples: [listing preview](assets/listing-share-preview-example.png) and [site preview](assets/site-share-preview-example.png). The listing example uses synthetic development data and illustrative stock photography; it is not a real listing, endorsement, or proof of a completed transaction.

## Voice and creative territory

Write like an ultimate player with a good eye for gear: warm, specific, direct, and occasionally playful. “Trade stack,” “nationals jersey,” “tournament disc,” “teammate,” “the crate,” and “what you're hunting” are useful vocabulary when context makes them clear. Explain ISO as “in search of” on first use for a broad audience.

Lead with the item or the player moment. Follow with one useful feature. End with one action. Avoid generic marketplace superlatives, invented scarcity, aggressive resale language, or jokes that make beginners feel outside the community.

Suggested directions for exploration, not approved campaign copy:

- **The next chapter:** an unworn jersey finds its next player. Anchor in listing, trading, and giveaways.
- **The one you've been hunting:** a wanted post connects the collector with the right gear. Anchor in discovery and matches.
- **This has your name on it:** someone spots a listing and sends it to their teammate. Anchor in effortless sharing.
- **The story in the stack:** the meaning attached to teams, seasons, and tournaments. Anchor in public profiles and The Haul.

## Claims to keep precise

- Say **free to join, free to list, no Poachland transaction fees**. Do not imply free shipping on every listing or zero charges from outside payment providers.
- Say **public profiles and ratings from completed deals**. Do not claim every trader is verified, every item is authenticated, or any transaction is risk-free.
- Poachland coordinates the deal. It does not process or hold payments, provide escrow, insure shipments, or guarantee refunds. Reports and dispute handling are available; they are not purchase insurance.
- “Free” describes a listing's asking terms. Owners select recipients of giveaways; a claim is not a guaranteed allocation.
- Wanted matches and saved-search notifications help discovery. They do not guarantee a match, availability, or a response.
- Founding Member eligibility is limited by the product's first-1,000 rule. Check remaining availability before urgency-based copy. Never invent a remaining count.
- Use only real, approved testimonials and verified figures. Development fixture profiles, ratings, trades, and product images are examples, not evidence of adoption, endorsements, or actual completed transactions.
- Say **ready-to-edit posts and rich link previews**. Do not claim automatic posting to every network, universal caption prefilling, bulk cross-posting, or an Instagram publishing integration.

## Requested creative deliverables

Develop three campaign directions, each with a headline, one-sentence promise, featured product proof, visual idea, and CTA. Then expand the selected direction into:

| Asset | Writing brief |
| --- | --- |
| Homepage hero | Five headline options, three supporting lines, and CTA options for browsing and listing |
| Launch post | One 80–120-word product introduction and a shorter 30–50-word version |
| Feature posts | Five posts, 40–80 words each: trade stack, Wanted, giveaways, sharing, reputation |
| Sharing announcement | One 60–100-word announcement showing “find listing → edit prepared post → choose destination” |
| Team/group message | Two conversational 30–60-word invitations; avoid unsolicited mass-message framing |
| Email | Three subject lines, preview text, and a 150–200-word launch body |
| Short video | A 15-second script and a 30-second script built around a real screen flow |

For each asset, include audience, intent, CTA, required screenshot or photo, and the feature that substantiates the promise. Keep illustrative item details clearly labeled as examples. Do not send or publish these assets as part of drafting.

## Reference for product questions

Product overview: [README](../README.md). Sharing behavior and verification: [sharing implementation spec](sharing-spec.md). Deal limits: [buyer-protection page](../app/buyer-protection/page.tsx). Real conversion definitions: [analytics](analytics.md). Synthetic-content restrictions: [backlog](backlog.md).
