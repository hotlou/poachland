export type SocialCadence = "daily" | "weekly" | "custom";
export type SocialStatus = "draft" | "scheduled" | "preparing" | "publishing" | "published" | "failed" | "review" | "cancelled";
export type SocialSource = {
  kind: "listing" | "haul";
  id: string;
  title: string;
  photo: string;
  url: string;
  ownerIds: string[];
  listingIds: string[];
  occurredAt: string;
  score: number;
};
export type SocialSettingsView = { paused: boolean; daily: boolean; weekly: boolean; automatic: boolean; hourUtc: number };
export type SocialPostView = {
  id: string; cadence: SocialCadence; status: SocialStatus; caption: string; sources: SocialSource[];
  windowStart: string; windowEnd: string; scheduledAt: string | null; publishedAt: string | null;
  error: string | null; mediaId: string | null; containerId: string | null; imageUrl: string;
};
export type SocialAdminData = {
  settings: SocialSettingsView; posts: SocialPostView[];
  connection: { configured: boolean; handle: string | null; missing: string[] };
};

/** UTC windows make retries and overlapping cron invocations select the same draft. */
export function socialWindow(cadence: SocialCadence, now: Date, days = 7) {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (cadence === "weekly") end.setUTCDate(end.getUTCDate() - (end.getUTCDay() + 6) % 7);
  const length = cadence === "daily" ? 1 : cadence === "weekly" ? 7 : Math.max(1, Math.min(30, Math.trunc(days)));
  const start = new Date(end.getTime() - length * 86400000);
  return { start, end, key: `${cadence}:${start.toISOString()}:${end.toISOString()}` };
}

/** Capped popularity signals; public completed exchanges outrank new listings. */
export function socialScore(kind: SocialSource["kind"], views = 0, saves = 0) {
  return (kind === "haul" ? 100 : 30) + Math.min(20, Math.max(0, saves)) * 2 + Math.min(200, Math.max(0, views)) / 20;
}

export function socialCaption(sources: SocialSource[]) {
  return `${sources.some((s) => s.kind === "haul") ? "Good gear, new chapters." : "Fresh finds on Poachland."}\n\n${sources.map((s) => `${s.kind === "haul" ? "Shared completed exchange" : "Available"}: ${s.title}\n${s.url}`).join("\n\n")}\n\nFind your next jersey or disc at poachland.com.\n#Poachland #UltimateFrisbee`;
}
