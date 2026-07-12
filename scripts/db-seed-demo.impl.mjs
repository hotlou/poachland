/**
 * Demo seeder implementation. Do not run directly — use
 * `SEED_DEMO=yes node scripts/db-seed-demo.mjs`, which launches this through
 * tsx after checking the guard.
 *
 * Ports every record from lib/seed.ts buildSeedState() into the database:
 *   - users gain synthetic emails (<username>@demo.poachland.local) and an
 *     onboarded_at (their memberSince), since the server schema requires both
 *   - DealRecord.offers arrays are normalized into offers rows with position
 *   - ISO-string timestamps become Date values for the timestamptz columns
 */

if (process.env.SEED_DEMO !== "yes") {
  console.error("Refusing to seed: set SEED_DEMO=yes to run this script.");
  process.exit(1);
}

const { getDb } = await import("../lib/server/db.ts");
const schema = await import("../lib/server/schema.ts");
const { buildSeedState } = await import("../lib/seed.ts");

const db = await getDb();

const existing = await db.select({ id: schema.users.id }).from(schema.users).limit(1);
if (existing.length > 0) {
  console.error("Refusing to seed: the users table is not empty.");
  process.exit(1);
}

const date = (s) => new Date(s);
const dateOrNull = (s) => (s ? new Date(s) : null);

const state = buildSeedState();

await db.transaction(async (tx) => {
  await tx.insert(schema.users).values(
    state.users.map((u) => ({
      id: u.id,
      email: `${u.username}@demo.poachland.local`,
      username: u.username,
      displayName: u.displayName,
      avatar: u.avatar,
      bio: u.bio,
      location: u.location,
      favoriteTeams: u.favoriteTeams,
      memberSince: date(u.memberSince),
      isVerified: u.isVerified,
      isAdmin: false,
      badges: u.badges,
      baselineTrades: u.baselineTrades,
      baselineRatingCount: u.baselineRatingCount,
      baselineRatingSum: u.baselineRatingSum,
      trustScore: u.trustScore,
      ratingsCount: u.ratingsCount,
      tradesCompleted: u.tradesCompleted,
      onboardedAt: date(u.memberSince),
    })),
  );

  await tx.insert(schema.listings).values(
    state.listings.map((l) => ({
      id: l.id,
      sellerId: l.sellerId,
      type: l.type,
      title: l.title,
      team: l.team,
      year: l.year ?? null,
      division: l.division ?? null,
      level: l.level,
      size: l.size ?? null,
      condition: l.condition,
      listingType: l.listingType,
      askingPrice: l.askingPrice ?? null,
      tradeFor: l.tradeFor ?? null,
      photos: l.photos,
      description: l.description,
      views: l.views,
      saves: l.saves,
      createdAt: date(l.createdAt),
      updatedAt: date(l.updatedAt),
      shippingPreference: l.shippingPreference,
      tags: l.tags,
      isRare: l.isRare ?? false,
      isFeatured: l.isFeatured ?? false,
      status: l.status,
    })),
  );

  await tx.insert(schema.isoPosts).values(
    state.isoPosts.map((p) => ({
      id: p.id,
      userId: p.userId,
      itemType: p.itemType,
      description: p.description,
      team: p.team ?? null,
      size: p.size ?? null,
      maxPrice: p.maxPrice ?? null,
      createdAt: date(p.createdAt),
      saves: p.saves,
      status: p.status,
    })),
  );

  await tx.insert(schema.threads).values(
    state.threads.map((t) => ({
      id: t.id,
      participantIds: t.participantIds,
      listingId: t.listingId ?? null,
      isoPostId: t.isoPostId ?? null,
      dealId: t.dealId ?? null,
      createdAt: date(t.createdAt),
      updatedAt: date(t.updatedAt),
      lastRead: t.lastRead,
    })),
  );

  await tx.insert(schema.deals).values(
    state.deals.map((d) => ({
      id: d.id,
      kind: d.kind,
      listingId: d.listingId,
      proposerId: d.proposerId,
      ownerId: d.ownerId,
      status: d.status,
      threadId: d.threadId,
      createdAt: date(d.createdAt),
      updatedAt: date(d.updatedAt),
      acceptedAt: dateOrNull(d.acceptedAt),
      completedAt: dateOrNull(d.completedAt),
      closedAt: dateOrNull(d.closedAt),
      declineReason: d.declineReason ?? null,
      disputeReason: d.disputeReason ?? null,
      fulfillment: d.fulfillment,
    })),
  );

  // DealRecord.offers arrays → offers rows ordered by (deal_id, position).
  const offerRows = state.deals.flatMap((d) =>
    d.offers.map((o, position) => ({
      id: o.id,
      dealId: d.id,
      position,
      byUserId: o.byUserId,
      proposerListingIds: o.proposerListingIds,
      ownerListingIds: o.ownerListingIds,
      cashFromProposer: o.cashFromProposer,
      cashFromOwner: o.cashFromOwner,
      note: o.note,
      createdAt: date(o.createdAt),
      expiresAt: date(o.expiresAt),
      status: o.status,
    })),
  );
  if (offerRows.length > 0) await tx.insert(schema.offers).values(offerRows);

  if (state.messages.length > 0) {
    await tx.insert(schema.messages).values(
      state.messages.map((m) => ({
        id: m.id,
        threadId: m.threadId,
        senderId: m.senderId,
        kind: m.kind,
        content: m.content,
        offerId: m.offerId ?? null,
        createdAt: date(m.createdAt),
      })),
    );
  }

  if (state.ratings.length > 0) {
    await tx.insert(schema.ratings).values(
      state.ratings.map((r) => ({
        id: r.id,
        dealId: r.dealId,
        fromUserId: r.fromUserId,
        toUserId: r.toUserId,
        communication: r.communication,
        shippingSpeed: r.shippingSpeed,
        itemAccuracy: r.itemAccuracy,
        wouldTradeAgain: r.wouldTradeAgain,
        comment: r.comment ?? null,
        createdAt: date(r.createdAt),
      })),
    );
  }

  if (state.notifications.length > 0) {
    await tx.insert(schema.notifications).values(
      state.notifications.map((n) => ({
        id: n.id,
        userId: n.userId,
        type: n.type,
        title: n.title,
        body: n.body,
        read: n.read,
        createdAt: date(n.createdAt),
        linkTo: n.linkTo ?? null,
      })),
    );
  }

  if (state.saves.length > 0) {
    await tx.insert(schema.saves).values(
      state.saves.map((s) => ({
        userId: s.userId,
        targetType: s.targetType,
        targetId: s.targetId,
        createdAt: date(s.createdAt),
      })),
    );
  }

  if (state.reports.length > 0) {
    await tx.insert(schema.reports).values(
      state.reports.map((r) => ({
        id: r.id,
        reporterId: r.reporterId,
        targetType: r.targetType,
        targetId: r.targetId,
        reason: r.reason,
        details: r.details ?? null,
        status: r.status,
        resolution: r.resolution ?? null,
        createdAt: date(r.createdAt),
        resolvedAt: dateOrNull(r.resolvedAt),
      })),
    );
  }

  if (state.blocks.length > 0) {
    await tx.insert(schema.blocks).values(
      state.blocks.map((b) => ({
        blockerId: b.blockerId,
        blockedId: b.blockedId,
        createdAt: date(b.createdAt),
      })),
    );
  }

  if (state.activity.length > 0) {
    await tx.insert(schema.activity).values(
      state.activity.map((a) => ({
        id: a.id,
        type: a.type,
        actorId: a.actorId,
        targetId: a.targetId ?? null,
        summary: a.summary,
        createdAt: date(a.createdAt),
        linkTo: a.linkTo ?? null,
      })),
    );
  }
});

console.log(
  `Seeded: ${state.users.length} users, ${state.listings.length} listings, ` +
    `${state.isoPosts.length} ISO posts, ${state.deals.length} deals, ` +
    `${state.threads.length} threads, ${state.messages.length} messages, ` +
    `${state.ratings.length} ratings.`,
);
console.log("Demo user emails follow <username>@demo.poachland.local.");
