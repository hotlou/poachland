/**
 * Transactional email (server-only).
 *
 * Notifications write an `email_outbox` row inside the same transaction that
 * creates the in-app notification (see notify.ts). Delivery is decoupled:
 * `flushEmailOutbox()` runs after the request's DB work commits, sends via
 * Resend, and marks rows sent. This keeps email failures off the write path
 * and survives Resend downtime (unsent rows retry on the next flush).
 */

import "server-only";

import { randomBytes } from "node:crypto";
import { and, asc, eq, isNull, lt } from "drizzle-orm";
import type { NotificationType } from "../types";
import { getDb, type Db } from "./db";
import {
  emailOutbox,
  users,
  type EmailCategory,
  type EmailPrefs,
} from "./schema";

export const DEFAULT_EMAIL_PREFS: EmailPrefs = {
  deals: true,
  messages: true,
  community: true,
  account: true,
};

/** Which email category (if any) a notification type belongs to. */
export const EMAIL_CATEGORY: Record<NotificationType, EmailCategory> = {
  trade_proposal: "deals",
  buy_offer: "deals",
  claim_request: "deals",
  offer_countered: "deals",
  offer_accepted: "deals",
  offer_rejected: "deals",
  offer_withdrawn: "deals",
  deal_cancelled: "deals",
  deal_disputed: "deals",
  shipped: "deals",
  deal_complete: "deals",
  new_message: "messages",
  iso_match: "community",
  new_rating: "community",
  badge_earned: "community",
  listing_removed: "account",
  system: "account",
};

export const EMAIL_CATEGORY_LABELS: Record<EmailCategory, { title: string; blurb: string }> = {
  deals: { title: "Deal activity", blurb: "Offers, counters, acceptances, shipping, completions." },
  messages: { title: "Messages", blurb: "When someone messages you (one email per conversation until you read it)." },
  community: { title: "Community", blurb: "Wanted-post matches, new ratings, badges you earn." },
  account: { title: "Account & safety", blurb: "Moderation notices, dispute updates, important account changes." },
};

/** Message emails coalesce per-thread; other events each get their own email. */
export function emailDedupeKey(type: NotificationType, linkTo?: string | null): string | null {
  if (type === "new_message" && linkTo) return `msg:${linkTo}`;
  return null;
}

function appOrigin(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://poachland.com").replace(/\/$/, "");
}

async function ensureUnsubToken(db: Db, userId: string, existing: string | null): Promise<string> {
  if (existing) return existing;
  const token = randomBytes(24).toString("base64url");
  await db.update(users).set({ emailUnsubToken: token }).where(eq(users.id, userId));
  return token;
}

/**
 * Send unsent outbox rows. Best-effort and bounded — called after a mutation
 * commits. Without RESEND_API_KEY (local dev) it logs and marks sent so the
 * outbox doesn't pile up.
 */
export async function flushEmailOutbox(limit = 15): Promise<void> {
  const db = await getDb();
  const now = new Date();

  // Claimable rows: never sent, under the attempt cap. Join the recipient.
  const rows = await db
    .select({ o: emailOutbox, u: users })
    .from(emailOutbox)
    .innerJoin(users, eq(emailOutbox.userId, users.id))
    .where(and(isNull(emailOutbox.sentAt), lt(emailOutbox.attempts, 5)))
    .orderBy(asc(emailOutbox.createdAt))
    .limit(limit);

  if (rows.length === 0) return;

  const { Resend } = process.env.RESEND_API_KEY
    ? await import("resend").catch(() => ({ Resend: null }))
    : { Resend: null };
  const resend = Resend ? new Resend(process.env.RESEND_API_KEY) : null;
  const from = process.env.EMAIL_FROM || "Poachland <onboarding@resend.dev>";

  for (const { o, u } of rows) {
    // Respect the user's per-category preference and skip locked-out accounts.
    const prefs = (u.emailPrefs ?? DEFAULT_EMAIL_PREFS) as EmailPrefs;
    const suspended =
      u.status === "banned" ||
      (u.status === "suspended" && (!u.suspendedUntil || u.suspendedUntil > now));
    if (prefs[o.category] === false || suspended) {
      await db.update(emailOutbox).set({ sentAt: now }).where(eq(emailOutbox.id, o.id));
      continue;
    }

    const token = await ensureUnsubToken(db, u.id, u.emailUnsubToken);
    const html = renderEmail({
      title: o.title,
      body: o.body,
      linkTo: o.linkTo,
      category: o.category,
      unsubToken: token,
    });
    const text = `${o.title}\n\n${o.body}\n\n${o.linkTo ? appOrigin() + o.linkTo + "\n\n" : ""}Manage emails: ${appOrigin()}/app/settings\nUnsubscribe: ${appOrigin()}/api/email/unsubscribe?token=${token}`;

    try {
      if (resend) {
        const { error } = await resend.emails.send({
          from,
          to: u.email,
          subject: subjectFor(o.title),
          html,
          text,
        });
        if (error) throw error;
      } else {
        console.log(`[email:dev] → ${u.email}: ${o.title}`);
      }
      await db.update(emailOutbox).set({ sentAt: now }).where(eq(emailOutbox.id, o.id));
    } catch (err) {
      console.error(`[email] send failed for ${o.id}:`, err);
      await db
        .update(emailOutbox)
        .set({ attempts: o.attempts + 1 })
        .where(eq(emailOutbox.id, o.id));
    }
  }
}

function subjectFor(title: string): string {
  // Titles already read like subjects ("New trade proposal", "Offer accepted 🤝").
  return `Poachland — ${title}`;
}

function renderEmail(opts: {
  title: string;
  body: string;
  linkTo?: string | null;
  category: EmailCategory;
  unsubToken: string;
}): string {
  const origin = appOrigin();
  const cta = opts.linkTo ? `${origin}${opts.linkTo}` : origin + "/app";
  const unsubAll = `${origin}/api/email/unsubscribe?token=${opts.unsubToken}`;
  const unsubCat = `${unsubAll}&cat=${opts.category}`;
  const catLabel = EMAIL_CATEGORY_LABELS[opts.category].title.toLowerCase();
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background-color:#f6f4ec;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f6f4ec;padding:40px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background-color:#ffffff;border:1px solid #e7e3d6;border-radius:16px;padding:32px;">
          <tr><td style="padding-bottom:20px;">
            <span style="color:#2d6b3f;font-size:20px;font-weight:800;letter-spacing:-0.02em;">Poachland</span>
          </td></tr>
          <tr><td style="color:#262420;font-size:18px;font-weight:700;line-height:1.35;padding-bottom:10px;">${escapeHtml(opts.title)}</td></tr>
          <tr><td style="color:#5a564d;font-size:14px;line-height:1.6;padding-bottom:26px;">${escapeHtml(opts.body)}</td></tr>
          <tr><td style="padding-bottom:26px;">
            <a href="${cta}" style="display:inline-block;background-color:#2d6b3f;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 26px;border-radius:9999px;">Open Poachland</a>
          </td></tr>
          <tr><td style="color:#9b9689;font-size:12px;line-height:1.6;border-top:1px solid #eee7d8;padding-top:18px;">
            You're getting this because you have ${escapeHtml(catLabel)} emails on.
            <a href="${unsubCat}" style="color:#2d6b3f;">Turn these off</a> ·
            <a href="${unsubAll}" style="color:#2d6b3f;">Unsubscribe from all</a> ·
            <a href="${origin}/app/settings" style="color:#2d6b3f;">Manage in settings</a>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Apply an unsubscribe link. `cat` turns off one category; omitted turns off
 * all. Idempotent; unknown tokens are a no-op (returns false).
 */
export async function applyUnsubscribe(
  token: string,
  cat?: string | null,
): Promise<{ ok: boolean; category?: EmailCategory }> {
  if (!token) return { ok: false };
  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.emailUnsubToken, token)).limit(1);
  if (!u) return { ok: false };
  const prefs = { ...DEFAULT_EMAIL_PREFS, ...(u.emailPrefs ?? {}) } as EmailPrefs;
  const valid: EmailCategory[] = ["deals", "messages", "community", "account"];
  if (cat && valid.includes(cat as EmailCategory)) {
    prefs[cat as EmailCategory] = false;
    await db.update(users).set({ emailPrefs: prefs }).where(eq(users.id, u.id));
    return { ok: true, category: cat as EmailCategory };
  }
  for (const k of valid) prefs[k] = false;
  await db.update(users).set({ emailPrefs: prefs }).where(eq(users.id, u.id));
  return { ok: true };
}
