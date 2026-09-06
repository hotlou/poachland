import { describe, expect, it } from "vitest";
import { isDuplicateListing, listingMatchesISO, listingMatchesSavedSearch } from "../../lib/listing-matching";

const listing = {
  type: "jersey",
  listingType: "sale",
  condition: "excellent",
  team: "Seattle Sockeye",
  year: "2018",
  size: "M",
  title: "2018 dark jersey",
  description: "Tournament-worn but clean",
  tags: ["AUDL", "dark"],
  askingPrice: 75,
};

describe("listing discovery matching", () => {
  it("matches ISO posts by type and normalized team context", () => {
    expect(listingMatchesISO(listing, { itemType: "jersey", team: "Sockeye", description: "Any year" })).toBe(true);
    expect(listingMatchesISO(listing, { itemType: "disc", team: "Sockeye", description: "Any year" })).toBe(false);
    expect(listingMatchesISO(listing, { itemType: "jersey", team: null, description: "Looking for Seattle Sockeye gear" })).toBe(true);
    expect(listingMatchesISO({ ...listing, team: "" }, { itemType: "jersey", team: null, description: "anything" })).toBe(false);
  });

  it("applies every structured saved-search constraint", () => {
    expect(listingMatchesSavedSearch(listing, {
      itemType: "jersey", listingType: "sale", condition: "excellent",
      team: "sockeye", size: "m", maxPrice: 80, query: "audl",
    })).toBe(true);
    expect(listingMatchesSavedSearch(listing, { maxPrice: 50 })).toBe(false);
    expect(listingMatchesSavedSearch(listing, { size: "XL" })).toBe(false);
    expect(listingMatchesSavedSearch(listing, { query: "revolver" })).toBe(false);
    expect(listingMatchesSavedSearch({ ...listing, askingPrice: null }, { maxPrice: 80 })).toBe(false);
  });

  it("detects normalized duplicate listing identities without conflating distinct years", () => {
    expect(isDuplicateListing(
      { type: "jersey", title: "  2018   Dark Jersey ", team: "SEATTLE SOCKEYE", year: "2018" },
      listing,
    )).toBe(true);
    expect(isDuplicateListing({ ...listing, year: "2019" }, listing)).toBe(false);
    expect(isDuplicateListing({ ...listing, type: "shorts" }, listing)).toBe(false);
  });
});
