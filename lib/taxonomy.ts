export const ULTIMATE_TEAMS = [
  "Austin Torch",
  "Boston Brute Squad",
  "Boston DiG",
  "Chicago Machine",
  "Denver Johnny Bravo",
  "Denver Molly Brown",
  "New York Gridlock",
  "New York PoNY",
  "Portland Schwa",
  "Raleigh Phoenix",
  "Raleigh Ring of Fire",
  "San Francisco Fury",
  "San Francisco Revolver",
  "Seattle Riot",
  "Seattle Sockeye",
  "Washington DC Truck Stop",
] as const;

export const ULTIMATE_EVENTS = [
  "USA Ultimate Club Championships",
  "USA Ultimate College Championships",
  "USA Ultimate National Championships",
  "UFA Championship Weekend",
  "WFDF World Ultimate Championships",
  "WFDF World Ultimate Club Championships",
  "World Games",
] as const;

export const TEAM_EVENT_OPTIONS = [
  ...ULTIMATE_TEAMS.map((name) => ({ name, kind: "Team" as const })),
  ...ULTIMATE_EVENTS.map((name) => ({ name, kind: "Event" as const })),
];

function normalizedTaxonomyKey(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

const CANONICAL_TEAM_EVENTS = new Map(
  TEAM_EVENT_OPTIONS.map(({ name }) => [normalizedTaxonomyKey(name), name]),
);

/** Canonicalize known teams/events while preserving local and uncommon names. */
export function canonicalizeTeamOrEvent(value: string): string {
  const cleaned = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  return CANONICAL_TEAM_EVENTS.get(normalizedTaxonomyKey(cleaned)) ?? cleaned;
}
