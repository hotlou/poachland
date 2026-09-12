import type { User } from "../types";
import { users } from "./schema";

export const publicUserColumns = {
  sampleBatchId: users.sampleBatchId,
  id: users.id, username: users.username, displayName: users.displayName, avatar: users.avatar,
  bio: users.bio, location: users.location, favoriteTeams: users.favoriteTeams, history: users.history,
  gallery: users.gallery, memberSince: users.memberSince, isVerified: users.isVerified, badges: users.badges,
  baselineTrades: users.baselineTrades, baselineRatingCount: users.baselineRatingCount,
  baselineRatingSum: users.baselineRatingSum, trustScore: users.trustScore,
  ratingsCount: users.ratingsCount, tradesCompleted: users.tradesCompleted,
};

export function hydratePublicUser(row: Record<keyof typeof publicUserColumns, unknown>): User {
  return {
    sampleBatchId: row.sampleBatchId ? String(row.sampleBatchId) : undefined,
    id: String(row.id), username: String(row.username), displayName: String(row.displayName), avatar: String(row.avatar),
    bio: String(row.bio), location: String(row.location), favoriteTeams: row.favoriteTeams as string[],
    history: row.history as User["history"], gallery: row.gallery as User["gallery"],
    memberSince: (row.memberSince as Date).toISOString(), isVerified: Boolean(row.isVerified), badges: row.badges as User["badges"],
    baselineTrades: Number(row.baselineTrades), baselineRatingCount: Number(row.baselineRatingCount),
    baselineRatingSum: Number(row.baselineRatingSum), trustScore: Number(row.trustScore),
    ratingsCount: Number(row.ratingsCount), tradesCompleted: Number(row.tradesCompleted),
  };
}
