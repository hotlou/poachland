import type { DealRecord, HaulPostRecord, ListingRecord, Rating, UserRecord } from "./types";
import { ratingSummaryFrom } from "./reputation";

export const SAMPLE_BATCH_ID = "samples_202609_v1";
export const SAMPLE_BATCH_NAME = "Marketplace examples · September 2026";
export const SAMPLE_DEFAULT_DAYS = 30;
export const SAMPLE_NOTICE = "Example content: fictional people and exchanges. Items are illustrations and are not available to buy or trade.";

const DAY = 86_400_000;
const userId = (key: string) => `u_samplev1${key}`;
export const sampleListingId = (key: string) => `l_samplev1${key}`;

export function buildSampleContent(anchor: Date) {
  const ago = (days: number) => new Date(anchor.getTime() - days * DAY).toISOString();
  const profiles = [
    ["nora", "Nora P.", "sparelight", "Minneapolis, MN", "Mostly here for long sleeves and old tournament prints. Medium on the tag, sometimes large in real life. Happy to measure anything."],
    ["eli", "Eli R.", "lastbackhand", "Madison, WI", "The disc shelf is full. The jersey drawer is somehow also full. Looking for lights I’ll actually wear to league."],
    ["remy", "Remy L.", "sidelinepocket", "Chicago, IL", "One in, one out. Supposedly. Mixed pickup, medium jerseys, and discs with good stamps."],
    ["tess", "Tess W.", "fadetoblue", "Durham, NC", "Collecting blue jerseys. Yes, that is the whole system. Usually get to the post office on Fridays."],
    ["dev", "Dev S.", "secondpull", "Atlanta, GA", "Large jerseys, bright discs. If something runs small, please tell me before we both buy postage."],
    ["kit", "Kit M.", "courtbag", "Richmond, VA", "Back at pickup after a few years away. Looking for a couple of practice shirts and passing along what no longer fits."],
  ];
  const users: UserRecord[] = profiles.map(([key, name, handle, location, bio], i) => ({
    id: userId(key), sampleBatchId: SAMPLE_BATCH_ID, username: `sample_${handle}`, displayName: name,
    avatar: `/images/samples-v1/avatar-${key}.png`, bio, location, favoriteTeams: [], history: [], gallery: [],
    memberSince: ago([31, 28, 24, 22, 19, 16][i]), isVerified: false, badges: [],
    baselineTrades: 0, baselineRatingCount: 0, baselineRatingSum: 0, trustScore: 0, ratingsCount: 0, tradesCompleted: 0,
  }));
  const listings: ListingRecord[] = [];
  function item(key: string, seller: string, title: string, team: string, size: string | undefined,
    condition: ListingRecord["condition"], description: string, extra: Partial<ListingRecord> = {}) {
    const row: ListingRecord = {
      id: sampleListingId(key), sampleBatchId: SAMPLE_BATCH_ID, sellerId: userId(seller),
      type: size ? "jersey" : "disc", title, team, size, level: "tournament",
      condition, listingType: "trade", photos: [`/images/samples-v1/${key}.png`], description,
      views: 0, saves: 0, createdAt: ago(2), updatedAt: ago(2), shippingPreference: "seller-pays",
      tags: ["example"], status: "active", ...extra,
    };
    // These fictional designs have no claimed club or national-team affiliation.
    listings.push(row);
    return row.id;
  }
  item("s1n", "nora", "Crosswind light jersey — M", "Crosswind", "M", "Good", "Cream with a green chest print. A little pilling near the lower back. No name or number. 20 inches across the chest, 27 inches long.");
  item("s1e", "eli", "Crosswind light jersey — L", "Crosswind", "L", "Good", "Cream light in the larger cut. Loose stitch inside the hem. 21.5 inches across the chest, 28 inches long.");
  item("s2r", "remy", "Lake Weekend 2023 disc — orange stamp", "Lake Weekend", undefined, "Near Mint", "White disc with an orange canoe stamp. Shelf copy, no rim ink.");
  item("s2t", "tess", "Night Shift disc — blue moon stamp", "Night Shift", undefined, "Good", "Light rim scuffs and a faded initial underneath. The moon stamp is still clean.");
  item("s3d", "dev", "Sideyard navy long sleeve — L", "Sideyard", "L", "Good", "Navy body, white sleeve print. Worn cuffs, no holes. 22 inches across the chest.");
  item("s3k", "kit", "Sideyard white practice jersey — M", "Sideyard", "M", "Near Mint", "Small navy chest print, plain back. 20 inches across the chest.");
  item("s4n1", "nora", "Plain white practice top — M", "Practice gear", "M", "Good", "Unnumbered white top. Collar is slightly gray, no holes.");
  item("s4n2", "nora", "Second Pull gray practice top — M", "Second Pull", "M", "Fair", "Softened print and a small repaired seam near the lower hem. Good spare for pickup.");
  item("s4r", "remy", "Crosswind green alternate — M", "Crosswind", "M", "Good", "Deep green, cream side panels, plain back. Light wear around the collar.");
  item("s5e", "eli", "Night Shift charcoal jersey — L", "Night Shift", "L", "Good", "Charcoal with a small silver moon print. No number. 22 inches across the chest.");
  item("s5d", "dev", "River Loop disc — coral stamp", "River Loop", undefined, "Near Mint", "White disc with a coral loop stamp. No ink; faint storage marks underneath.");

  const scenarios = [
    { key: "s1", a: "nora", b: "eli", aItems: ["s1n"], bItems: ["s1e"], days: 17, cash: 0, sharedBy: "nora", note: "Same shirt, one size up. The medium was fine until I tried reaching for anything. Thanks for measuring yours, Eli." },
    { key: "s2", a: "remy", b: "tess", aItems: ["s2r"], bItems: ["s2t"], days: 11, cash: 0, sharedBy: "remy", note: "The moon stamp got me. This one’s going in the bag, so a few rim scuffs were no problem." },
    { key: "s3", a: "kit", b: "dev", aItems: ["s3k"], bItems: ["s3d"], days: 7, cash: 10, sharedBy: "kit", note: "Finally a long sleeve with sleeves long enough. White practice top and $10 went the other way." },
    { key: "s4", a: "nora", b: "remy", aItems: ["s4n1", "s4n2"], bItems: ["s4r"], days: 3, cash: 0, sharedBy: "remy", note: "Two practice shirts sorted. The green jersey was spending more time in my drawer than on me." },
    { key: "s5", a: "eli", b: "dev", aItems: ["s5e"], bItems: ["s5d"], days: 1, cash: 0, sharedBy: "dev", note: "Needed a dark for pickup. Eli wanted the coral stamp. Easy enough." },
  ];
  const deals: DealRecord[] = [];
  const haulPosts: HaulPostRecord[] = [];
  for (const s of scenarios) {
    const id = `d_samplev1${s.key}`;
    const aItems = s.aItems.map(sampleListingId), bItems = s.bItems.map(sampleListingId);
    for (const l of listings.filter((l) => [...aItems, ...bItems].includes(l.id))) {
      l.status = "traded"; l.createdAt = ago(s.days + 5); l.updatedAt = ago(s.days);
    }
    deals.push({ id, kind: "trade", listingId: bItems[0], proposerId: userId(s.a), ownerId: userId(s.b),
      status: "completed", threadId: `t_samplev1${s.key}`, createdAt: ago(s.days + 4), updatedAt: ago(s.days),
      acceptedAt: ago(s.days + 3), completedAt: ago(s.days),
      offers: [{ id: `of_samplev1${s.key}`, byUserId: userId(s.a), proposerListingIds: aItems, ownerListingIds: bItems,
        cashFromProposer: s.cash, cashFromOwner: 0, note: "Example exchange — no actual transaction occurred.",
        createdAt: ago(s.days + 4), expiresAt: ago(s.days - 3), status: "accepted" }],
      fulfillment: { [userId(s.a)]: { shippedAt: ago(s.days + 2), receivedAt: ago(s.days) }, [userId(s.b)]: { shippedAt: ago(s.days + 2), receivedAt: ago(s.days) } },
    });
    const side = (ids: string[], cash: number) => ({ cash, items: ids.map((id) => {
      const l = listings.find((l) => l.id === id)!;
      return { listingId: id, title: l.title, photo: l.photos[0], type: l.type };
    }) });
    haulPosts.push({ id: `h_samplev1${s.key}`, sampleBatchId: SAMPLE_BATCH_ID, dealId: id, kind: "trade",
      proposerId: userId(s.a), ownerId: userId(s.b), sharedBy: userId(s.sharedBy),
      proposerSide: side(aItems, s.cash), ownerSide: side(bItems, 0), note: s.note,
      commentsEnabled: false, hidden: false, createdAt: ago(s.days - 0.1),
    });
  }
  const ratingSpecs: [string, string, string, number, number, number, string][] = [
    ["s1", "nora", "eli", 5, 5, 5, "Sent chest and length measurements before we agreed. Large fits how I hoped."],
    ["s1", "eli", "nora", 5, 5, 5, "Medium arrived clean. Pilling wasn’t a surprise."],
    ["s2", "remy", "tess", 5, 4, 5, "Went out a day later than planned, but Tess let me know. Disc was packed flat and the rim looked as described."],
    ["s2", "tess", "remy", 5, 5, 5, "No ink, clean rim, good stamp. Thanks for checking before we traded."],
    ["s3", "kit", "dev", 4, 5, 5, "Had to follow up once to confirm the cash amount. All good after that; sleeves and chest measurements were accurate."],
    ["s3", "dev", "kit", 5, 5, 5, "Shirt was clean and the $10 came through when agreed. Would swap again."],
    ["s4", "remy", "nora", 5, 5, 4, "The gray shirt’s print was a bit more faded than I expected. The seam repair was disclosed, and both shirts are fine for practice."],
    ["s4", "nora", "remy", 5, 5, 5, "Green one fits. Collar wear was described clearly. Appreciate it."],
  ];
  const ratings: Rating[] = ratingSpecs.map(([s, from, to, communication, shippingSpeed, itemAccuracy, comment], i) => ({
    id: `r_samplev1${i + 1}`, sampleBatchId: SAMPLE_BATCH_ID, dealId: `d_samplev1${s}`,
    fromUserId: userId(from), toUserId: userId(to), communication, shippingSpeed, itemAccuracy,
    wouldTradeAgain: true, comment, createdAt: ago(scenarios.find((row) => row.key === s)!.days - 0.2),
  }));
  for (const user of users) {
    const summary = ratingSummaryFrom(ratings.filter((r) => r.toUserId === user.id), user);
    user.trustScore = summary.overall; user.ratingsCount = summary.count;
    user.tradesCompleted = deals.filter((d) => d.proposerId === user.id || d.ownerId === user.id).length;
  }
  item("a1", "nora", "Crosswind rust long sleeve — M", "Crosswind", "M", "Good", "Love the color, but the sleeves are a touch short on me. About 20 inches pit to pit and 27 inches long laid flat. Small pull near the right cuff. Looking for a large long sleeve. Team doesn’t matter much.", { tradeFor: "Long sleeve in L; earth tones or a plain dark preferred.", createdAt: ago(0.2) });
  item("a2", "eli", "Lake Weekend 2024 disc — green tent stamp", "Lake Weekend", undefined, "Near Mint", "Bought two and only need one. This one has lived on a shelf. No name on the rim, a couple of faint marks underneath from stacking. $18 plus postage.", { listingType: "sell", askingPrice: 18, shippingPreference: "buyer-pays", createdAt: ago(0.6) });
  item("a3", "remy", "Second Pull reversible — white / forest, L", "Second Pull", "L", "Good", "A little too wide for me. Both sides are clean apart from a small gray mark near the white hem. Looking for a medium reversible plus $15. Not after another large, even if it ‘runs small’ — learned that one already.", { listingType: "trade+cash", askingPrice: 15, tradeFor: "M reversible plus $15 paid to Remy.", createdAt: ago(1.1) });
  item("a4", "tess", "Sideyard blue short sleeve — S", "Sideyard", "S", "Near Mint", "Good blue. Wrong size. Wore it for one warmup before accepting that. After a medium, ideally another blue, but I’ll look at other colors.", { tradeFor: "Short sleeve in M.", createdAt: ago(1.5) });
  item("a5", "dev", "Night Shift gray warmup — XL", "Night Shift", "XL", "Fair", "More of a loose XL than a fitted one. Print is faded and there are two small pulls below the number. Still gets used; just clearing out the sizes I don’t reach for. $28 with shipping included.", { listingType: "sell", askingPrice: 28, createdAt: ago(2) });
  item("a6", "kit", "White practice jersey — S, free", "Practice gear", "S", "Worn", "Small white practice shirt, no number. Some grass staining that isn’t coming out. No holes. If you need a spare light, you can have it. Richmond pickup.", { listingType: "free", shippingPreference: "local-only", createdAt: ago(2.5) });
  item("a7", "nora", "River Loop cream jersey — L", "River Loop", "L", "Good", "Would like to swap this for a medium short sleeve plus $8. The cream shows a little wash wear, but the print is still clean. No player name.", { listingType: "trade+cash", askingPrice: 8, tradeFor: "M short sleeve plus $8 paid to Nora.", createdAt: ago(3) });
  item("a8", "eli", "Orange practice disc — rim ink, free", "Practice gear", undefined, "Worn", "Plenty of field time left in it. Scuffed rim and an old initial underneath. Not a collector piece. Free if you cover postage.", { listingType: "free", shippingPreference: "buyer-pays", createdAt: ago(3.5) });
  const pendingId = item("p1", "tess", "Crosswind blue alternate — M", "Crosswind", "M", "Good", "Spare blue top, ready for another pickup bag. Recipient covers postage.", { listingType: "free", shippingPreference: "buyer-pays", status: "pending", createdAt: ago(4) });
  item("x1", "dev", "Second Pull black practice top — L", "Second Pull", "L", "Good", "Removed example. This description must not appear on a public page.", { listingType: "sell", askingPrice: 20, status: "removed", createdAt: ago(5) });
  deals.push({ id: "d_samplev1p1", kind: "claim", listingId: pendingId, proposerId: userId("kit"), ownerId: userId("tess"),
    status: "accepted", threadId: "t_samplev1p1", createdAt: ago(3), updatedAt: ago(2), acceptedAt: ago(2), fulfillment: {},
    offers: [{ id: "of_samplev1p1", byUserId: userId("kit"), proposerListingIds: [], ownerListingIds: [pendingId], cashFromProposer: 0, cashFromOwner: 0,
      note: "Example claim — no actual item is available.", createdAt: ago(3), expiresAt: ago(-4), status: "accepted" }],
  });
  // Update timestamps must never precede listing creation.
  for (const l of listings) if (l.updatedAt < l.createdAt) l.updatedAt = l.createdAt;
  return { users, listings, deals, ratings, haulPosts };
}
