import { describe, expect, it } from "vitest";

import { canonicalizeTeamOrEvent, TEAM_EVENT_OPTIONS } from "../../lib/taxonomy";

describe("team and event taxonomy", () => {
  it("canonicalizes known names despite casing and whitespace", () => {
    expect(canonicalizeTeamOrEvent("  boston   brute squad ")).toBe("Boston Brute Squad");
    expect(canonicalizeTeamOrEvent("ｗｏｒｌｄ games")).toBe("World Games");
  });

  it("preserves cleaned uncommon and local names", () => {
    expect(canonicalizeTeamOrEvent("  Pickup   Wizards  ")).toBe("Pickup Wizards");
  });

  it("exposes both structured team and event suggestions", () => {
    expect(TEAM_EVENT_OPTIONS.some((option) => option.kind === "Team")).toBe(true);
    expect(TEAM_EVENT_OPTIONS.some((option) => option.kind === "Event")).toBe(true);
  });
});
