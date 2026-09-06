/** Pure discovery rules shared by listing creation and direct tests. */

export type MatchableListing = {
  type: string;
  listingType?: string;
  condition?: string;
  team: string;
  size?: string | null;
  title?: string;
  description: string;
  tags?: string[] | null;
  askingPrice?: number | null;
};

export type MatchableIso = {
  itemType: string;
  team?: string | null;
  description: string;
};

export type MatchableSavedSearch = {
  itemType?: string | null;
  listingType?: string | null;
  condition?: string | null;
  maxPrice?: number | null;
  team?: string | null;
  size?: string | null;
  query?: string | null;
};

export type DuplicateComparableListing = {
  type: string;
  title: string;
  team: string;
  year?: string | null;
};

function normalizeIdentityPart(value: string | null | undefined): string {
  return String(value ?? "").normalize("NFKC").trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
}

export function isDuplicateListing(
  candidate: DuplicateComparableListing,
  existing: DuplicateComparableListing,
): boolean {
  return candidate.type === existing.type &&
    normalizeIdentityPart(candidate.title) === normalizeIdentityPart(existing.title) &&
    normalizeIdentityPart(candidate.team) === normalizeIdentityPart(existing.team) &&
    normalizeIdentityPart(candidate.year) === normalizeIdentityPart(existing.year);
}

export function listingMatchesISO(listing: MatchableListing, iso: MatchableIso): boolean {
  if (listing.type !== iso.itemType) return false;
  const team = listing.team.toLocaleLowerCase("en-US").trim();
  if (!team) return false;
  if (iso.team) {
    const wantedTeam = iso.team.toLocaleLowerCase("en-US").trim();
    if (wantedTeam && (team.includes(wantedTeam) || wantedTeam.includes(team))) return true;
  }
  return team.length > 2 && iso.description.toLocaleLowerCase("en-US").includes(team);
}

export function listingMatchesSavedSearch(
  listing: MatchableListing,
  search: MatchableSavedSearch,
): boolean {
  if (search.itemType && listing.type !== search.itemType) return false;
  if (search.listingType && listing.listingType !== search.listingType) return false;
  if (search.condition && listing.condition !== search.condition) return false;
  if (
    search.maxPrice !== null &&
    search.maxPrice !== undefined &&
    (listing.askingPrice === null || listing.askingPrice === undefined || listing.askingPrice > search.maxPrice)
  ) return false;

  const includes = (actual: string | null | undefined, expected: string | null | undefined) =>
    !expected || String(actual ?? "").toLocaleLowerCase("en-US").includes(expected.toLocaleLowerCase("en-US"));
  if (!includes(listing.team, search.team) || !includes(listing.size, search.size)) return false;

  if (search.query) {
    const haystack = [listing.title, listing.team, listing.description, ...(listing.tags ?? [])]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("en-US");
    if (!haystack.includes(search.query.toLocaleLowerCase("en-US"))) return false;
  }
  return true;
}
