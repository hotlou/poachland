"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { readSessionContext } from "@/lib/server/session";
import { getDb } from "@/lib/server/db";
import { socialPosts, socialSettings } from "@/lib/server/social-schema";
import { recordAdminAudit } from "@/lib/server/audit";
import { generateSocialDraft, getSocialAdminData, getSocialSettings, refreshSocialDraft, validateSocialPost } from "@/lib/server/social-publishing";
import { instagramConnection } from "@/lib/server/instagram";

async function admin() {
  const context = await readSessionContext();
  if (!context || !context.realUser.isAdmin || context.realUser.status !== "active" || context.realUser.deletedAt || context.realUser.id !== context.effectiveUser.id) throw new Error("Active moderators only. Exit Act as first.");
  return context.realUser;
}

export async function fetchAdminSocial() {
  try { await admin(); return { data: await getSocialAdminData(await getDb()) }; }
  catch { return { error: "Unable to load social publishing. Active moderator access is required." }; }
}

const settingsInput = z.object({ paused: z.boolean(), daily: z.boolean(), weekly: z.boolean(), automatic: z.boolean(), hourUtc: z.number().int().min(0).max(23) }).strict();
export async function saveSocialSettings(input: unknown) {
  try {
    const actor = await admin();
    const settings = settingsInput.parse(input);
    if (settings.automatic && !instagramConnection().configured) return { error: "Connect Instagram before enabling automatic publication." };
    const db = await getDb();
    await db.transaction(async (tx) => {
      await tx.insert(socialSettings).values({ id: "instagram", ...settings, updatedBy: actor.id }).onConflictDoUpdate({ target: socialSettings.id, set: { ...settings, updatedBy: actor.id, updatedAt: new Date() } });
      await recordAdminAudit(tx, actor, "social.settings", { type: "social" }, settings);
    });
    return { ok: true };
  } catch { return { error: "Could not save social publishing settings." }; }
}

export async function createSocialDraft(input: unknown) {
  try {
    const actor = await admin();
    const args = z.object({ cadence: z.enum(["daily", "weekly", "custom"]), days: z.number().int().min(1).max(30).default(7) }).parse(input);
    const db = await getDb();
    const result = await generateSocialDraft(db, args.cadence, new Date(), args.days);
    if (!result.id) return { error: result.reason ?? "No eligible activity." };
    await recordAdminAudit(db, actor, "social.draft", { type: "social", id: result.id }, args);
    return { ok: true, id: result.id, reused: result.reused };
  } catch { return { error: "Could not generate a draft. Try again shortly." }; }
}

const postInput = z.object({
  id: z.string().regex(/^social_[a-f0-9]{36}$/),
  action: z.enum(["edit", "refresh", "approve", "cancel", "retry", "resolve_published"]),
  caption: z.string().trim().min(1).max(2200).optional(),
  scheduledAt: z.string().datetime().optional(),
  mediaId: z.string().regex(/^\d{1,50}$/).optional(),
});
export async function updateSocialPost(input: unknown) {
  try {
    const actor = await admin();
    const args = postInput.parse(input);
    const db = await getDb();
    return await db.transaction(async (tx) => {
      const [post] = await tx.select().from(socialPosts).where(eq(socialPosts.id, args.id)).for("update");
      if (!post) return { error: "Post not found." };
      const mutable = ["draft", "failed", "scheduled", "cancelled"].includes(post.status) && !post.publishAttemptedAt;
      if (args.action === "cancel") {
        if (!["draft", "failed", "scheduled", "review"].includes(post.status)) return { error: "This post is already processing or published." };
        await tx.update(socialPosts).set({ status: "cancelled", scheduledAt: null, updatedAt: new Date() }).where(eq(socialPosts.id, post.id));
      } else if (args.action === "resolve_published") {
        if (post.status !== "review" || !args.mediaId) return { error: "Enter the media ID after checking the connected Instagram account." };
        await tx.update(socialPosts).set({ status: "published", mediaId: args.mediaId, publishedAt: new Date(), error: null, updatedAt: new Date() }).where(eq(socialPosts.id, post.id));
      } else {
        if (!mutable) return { error: "Publication may already have been attempted. This post cannot be retried or edited." };
        if (args.action === "refresh") {
          if (!await refreshSocialDraft(tx, post)) return { error: "No eligible activity remains, or publication has already been attempted." };
        } else if (args.action === "edit") {
          if (!args.caption) return { error: "A caption is required." };
          await tx.update(socialPosts).set({ caption: args.caption, status: "draft", containerId: null, approvedAt: null, approvedBy: null, error: null, updatedAt: new Date() }).where(eq(socialPosts.id, post.id));
        } else {
          if (!instagramConnection().configured) return { error: "Instagram is not connected. You can still download the image and copy the caption." };
          if ((await getSocialSettings(tx)).paused) return { error: "Resume publishing before approving a post." };
          if (!await validateSocialPost(tx, post)) return { error: "Source content or permission changed. Refresh this draft and review it again." };
          if (args.action === "retry" && post.status !== "failed") return { error: "Only a failure before publication can be retried." };
          const when = args.scheduledAt ? new Date(args.scheduledAt) : new Date();
          if (when.getTime() > Date.now() + 90 * 86400000 || when.getTime() < Date.now() - 60000) return { error: "Choose a time within the next 90 days." };
          await tx.update(socialPosts).set({ status: "scheduled", scheduledAt: when, approvedAt: new Date(), approvedBy: actor.id, containerId: args.action === "retry" ? null : post.containerId, error: null, updatedAt: new Date() }).where(and(eq(socialPosts.id, post.id), isNull(socialPosts.publishAttemptedAt), inArray(socialPosts.status, ["draft", "failed", "scheduled", "cancelled"])));
        }
      }
      await recordAdminAudit(tx, actor, `social.${args.action}`, { type: "social", id: post.id }, { scheduledAt: args.scheduledAt, mediaId: args.mediaId });
      return { ok: true };
    });
  } catch { return { error: "Could not update this post. Refresh the queue and try again." }; }
}
