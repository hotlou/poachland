export type ContentKind = "listing" | "wanted" | "rating" | "haul" | "comment";
export type ContentAction = "hide" | "restore" | "delete";
export type ContentQuery = { kind: ContentKind; query?: string; scope?: "all" | "real" | "sample"; visibility?: "all" | "visible" | "hidden"; page?: number };
export type AdminContentRow = { id: string; kind: ContentKind; title: string; body: string; userId: string; username: string | null; state: string;
  hidden: boolean; visible: boolean; sampleBatchId: string | null; createdAt: string; photo: string | null };
export type AdminContentPage = { items: AdminContentRow[]; total: number; page: number; pageSize: number };
export type AdminMemberDetail = { id: string; username: string | null; lastActiveAt: string | null; joinedAt: string; sampleBatchId: string | null;
  listings: number; activeListings: number; completedDeals: number; inFlightDeals: number; messagesSent: number; ratingsReceived: number; reportsReceived: number;
  events: { name: string; count: number }[]; recentEvents: { name: string; createdAt: string; subjectId: string | null }[] };
