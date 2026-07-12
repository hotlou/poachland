"use client";

/**
 * Remote-backed Poachland store.
 *
 * `RemotePoachStore` keeps the synchronous PoachStore API every page relies on
 * (reads and `Res<T>` mutations in render), but backs it with the multi-user
 * server:
 *
 *  - OPTIMISTIC LOCAL: every mutation runs the local rules engine first for an
 *    instant, validated UI update.
 *  - AUTHORITATIVE RECONCILE: if the local call succeeded, the same op (with
 *    the SAME client-generated ids) is dispatched to the server, which
 *    re-validates and replies with a fresh WorldSnapshot the client swaps in
 *    wholesale. On server rejection we toast the error and swap in the
 *    server's snapshot anyway, rolling the optimistic change back.
 *
 * A monotonically increasing request counter guards snapshot application so a
 * stale in-flight response can never overwrite a newer one.
 */

import { toast } from "sonner";
import { dispatchOp, fetchBootstrap } from "@/app/actions/engine";
import type { OpMap, OpName, SessionMe, WorldSnapshot } from "./shared/ops";
import {
  emptyDBState,
  PoachStore,
  type CreateISOInput,
  type CreateListingInput,
  type OfferTermsInput,
  type RatingInput,
  type Res,
} from "./engine";
import type {
  Deal,
  IdentityProvider,
  IdentityRecord,
  PaymentKind,
  PaymentMethod,
  ISOPost,
  ISOStatus,
  Listing,
  Message,
  Rating,
  ReportTargetType,
  SaveTargetType,
  Thread,
  User,
  UserRecord,
} from "./types";

/** Strip session-only fields so a SessionMe can live in `state.users`. */
function toUserRecord(me: SessionMe): UserRecord {
  const {
    email: _email,
    isAdmin: _isAdmin,
    needsOnboarding: _needs,
    hasPassword: _hasPassword,
    accountStatus: _status,
    suspendedUntil: _suspendedUntil,
    moderationNote: _modNote,
    impersonatedByAdmin: _impersonatedBy,
    ...user
  } = me;
  return user;
}

export class RemotePoachStore extends PoachStore {
  /** False until the first snapshot lands. */
  ready = false;
  /** The authenticated session, or null when signed out (or pre-bootstrap). */
  sessionMe: SessionMe | null = null;

  /** Monotonic request counter; responses apply only if newer than the last applied. */
  private reqSeq = 0;
  private appliedSeq = 0;
  private inflightRefetch: Promise<void> | null = null;

  constructor() {
    super(false, emptyDBState()); // never touches localStorage or seed data
  }

  // ── Snapshot plumbing ───────────────────────────────────────────────────────

  applySnapshot(snap: WorldSnapshot): void {
    this.applyIfFresh(snap, ++this.reqSeq);
  }

  private applyIfFresh(snap: WorldSnapshot, seq: number): void {
    if (seq <= this.appliedSeq) return; // stale response — a newer one already landed
    this.appliedSeq = seq;
    const me = snap.me;
    // Defensive: make sure the viewer exists in the public users collection.
    const users =
      me && !snap.users.some((u) => u.id === me.id)
        ? [...snap.users, toUserRecord(me)]
        : snap.users;
    this.state = {
      v: 1,
      currentUserId: me?.id ?? null,
      users,
      listings: snap.listings,
      isoPosts: snap.isoPosts,
      deals: snap.deals,
      threads: snap.threads,
      messages: snap.messages,
      ratings: snap.ratings,
      notifications: snap.notifications,
      saves: snap.saves,
      reports: snap.reports,
      blocks: snap.blocks,
      activity: snap.activity,
      identities: snap.identities ?? [],
      paymentMethods: snap.paymentMethods ?? [],
    };
    this.sessionMe = me;
    this.ready = true;
    this.commit();
  }

  /** Pull a fresh snapshot from the server. Concurrent calls are deduped. */
  refetch = (): Promise<void> => {
    if (this.inflightRefetch) return this.inflightRefetch;
    const seq = ++this.reqSeq;
    this.inflightRefetch = fetchBootstrap()
      .then((snap) => this.applyIfFresh(snap, seq))
      .catch((error) => {
        console.error("[store] refetch failed", error);
      })
      .finally(() => {
        this.inflightRefetch = null;
      });
    return this.inflightRefetch;
  };

  /**
   * Fire-and-forget dispatch of an op the local engine already accepted.
   * The server's snapshot (success or rejection) reconciles local state.
   */
  private send<K extends OpName>(op: K, payload: OpMap[K], opts: { quiet?: boolean } = {}): void {
    const seq = ++this.reqSeq;
    void dispatchOp(op, payload)
      .then((result) => {
        if (result.ok) {
          this.applyIfFresh(result.snapshot, seq);
          return;
        }
        if (!opts.quiet) toast.error(result.error);
        if (result.snapshot) this.applyIfFresh(result.snapshot, seq);
        else void this.refetch();
      })
      .catch((error) => {
        console.error(`[store] dispatch ${op} failed`, error);
        if (!opts.quiet) toast.error("Couldn't reach the server — refreshing your view.");
        void this.refetch();
      });
  }

  /** Run a void local mutation; dispatch only if it actually changed state. */
  private sendIfChanged<K extends OpName>(run: () => void, op: K, payload: OpMap[K]): void {
    const before = this.version;
    run();
    if (this.version !== before && this.sessionMe) this.send(op, payload, { quiet: true });
  }

  // ── Session / profile ───────────────────────────────────────────────────────

  override completeOnboarding(input: {
    username: string;
    displayName: string;
    location: string;
    bio?: string;
    favoriteTeams?: string[];
    avatar?: string;
  }): Res<User> {
    const res = super.completeOnboarding(input);
    if (res.ok) {
      // Reflect the finished profile on the session immediately so gates
      // (needsOnboarding checks) don't bounce the user around mid-flow.
      if (this.sessionMe) {
        this.sessionMe = { ...this.sessionMe, ...res.value, needsOnboarding: false };
        this.commit();
      }
      this.send("completeOnboarding", {
        username: input.username,
        displayName: input.displayName,
        location: input.location,
        bio: input.bio,
        favoriteTeams: input.favoriteTeams,
        avatar: input.avatar,
      });
    }
    return res;
  }

  override updateProfile(
    patch: Partial<
      Pick<
        UserRecord,
        | "displayName"
        | "bio"
        | "location"
        | "favoriteTeams"
        | "avatar"
        | "username"
        | "history"
        | "gallery"
      >
    >,
  ): Res<User> {
    const res = super.updateProfile(patch);
    // Send the locally-normalized history (engine assigns ids to blank rows)
    // so client and server converge on the same entry ids.
    if (res.ok) {
      const normalized =
        patch.history !== undefined ? { ...patch, history: res.value.history } : patch;
      this.send("updateProfile", { patch: normalized });
    }
    return res;
  }

  // ── Listings ────────────────────────────────────────────────────────────────

  override createListing(input: CreateListingInput & { id?: string }): Res<Listing> {
    const res = super.createListing(input);
    if (res.ok) {
      const { id: _id, ...rest } = input;
      this.send("createListing", { id: res.value.id, input: rest });
    }
    return res;
  }

  override updateListing(id: string, patch: Partial<CreateListingInput>): Res<Listing> {
    const res = super.updateListing(id, patch);
    if (res.ok) this.send("updateListing", { id, patch });
    return res;
  }

  override removeListing(
    id: string,
    opts: { byAdmin?: boolean; reason?: string } = {},
  ): Res {
    const res = super.removeListing(id, opts);
    if (res.ok) {
      if (opts.byAdmin) this.send("adminRemoveListing", { id, reason: opts.reason });
      else this.send("removeListing", { id });
    }
    return res;
  }

  override markListingViewed(id: string): void {
    this.sendIfChanged(() => super.markListingViewed(id), "markListingViewed", { id });
  }

  override toggleSave(targetType: SaveTargetType, targetId: string): Res<boolean> {
    const res = super.toggleSave(targetType, targetId);
    if (res.ok) this.send("toggleSave", { targetType, targetId });
    return res;
  }

  // ── Wanted board ────────────────────────────────────────────────────────────

  override createISOPost(input: CreateISOInput & { id?: string }): Res<ISOPost> {
    const res = super.createISOPost(input);
    if (res.ok) {
      const { id: _id, ...rest } = input;
      this.send("createISOPost", { id: res.value.id, input: rest });
    }
    return res;
  }

  override updateISOStatus(id: string, status: ISOStatus): Res {
    const res = super.updateISOStatus(id, status);
    if (res.ok) this.send("updateISOStatus", { id, status });
    return res;
  }

  // ── Deals ───────────────────────────────────────────────────────────────────

  override proposeTrade(input: {
    listingId: string;
    offeredListingIds: string[];
    cashAdded?: number;
    note?: string;
    dealId?: string;
    threadId?: string;
  }): Res<Deal> {
    const res = super.proposeTrade(input);
    if (res.ok) {
      this.send("proposeTrade", {
        dealId: res.value.id,
        threadId: res.value.threadId,
        listingId: input.listingId,
        offeredListingIds: input.offeredListingIds,
        cashAdded: input.cashAdded,
        note: input.note,
      });
    }
    return res;
  }

  override makeBuyOffer(input: {
    listingId: string;
    amount: number;
    note?: string;
    dealId?: string;
    threadId?: string;
  }): Res<Deal> {
    const res = super.makeBuyOffer(input);
    if (res.ok) {
      this.send("makeBuyOffer", {
        dealId: res.value.id,
        threadId: res.value.threadId,
        listingId: input.listingId,
        amount: input.amount,
        note: input.note,
      });
    }
    return res;
  }

  override claimListing(input: {
    listingId: string;
    note?: string;
    dealId?: string;
    threadId?: string;
  }): Res<Deal> {
    const res = super.claimListing(input);
    if (res.ok) {
      this.send("claimListing", {
        dealId: res.value.id,
        threadId: res.value.threadId,
        listingId: input.listingId,
        note: input.note,
      });
    }
    return res;
  }

  override counterOffer(dealId: string, terms: OfferTermsInput): Res<Deal> {
    const res = super.counterOffer(dealId, terms);
    if (res.ok) this.send("counterOffer", { dealId, terms });
    return res;
  }

  override acceptOffer(dealId: string): Res<Deal> {
    const res = super.acceptOffer(dealId);
    if (res.ok) this.send("acceptOffer", { dealId });
    return res;
  }

  override declineOffer(dealId: string, reason?: string): Res {
    const res = super.declineOffer(dealId, reason);
    if (res.ok) this.send("declineOffer", { dealId, reason });
    return res;
  }

  override withdrawOffer(dealId: string): Res {
    const res = super.withdrawOffer(dealId);
    if (res.ok) this.send("withdrawOffer", { dealId });
    return res;
  }

  override cancelDeal(dealId: string, reason?: string): Res {
    const res = super.cancelDeal(dealId, reason);
    if (res.ok) this.send("cancelDeal", { dealId, reason });
    return res;
  }

  override markShipped(dealId: string, tracking?: string): Res {
    const res = super.markShipped(dealId, tracking);
    if (res.ok) this.send("markShipped", { dealId, tracking });
    return res;
  }

  override confirmComplete(dealId: string): Res<{ completed: boolean }> {
    const res = super.confirmComplete(dealId);
    if (res.ok) this.send("confirmComplete", { dealId });
    return res;
  }

  override openDispute(dealId: string, reason: string): Res {
    const res = super.openDispute(dealId, reason);
    if (res.ok) this.send("openDispute", { dealId, reason });
    return res;
  }

  override rateDeal(dealId: string, input: RatingInput): Res<Rating> {
    const res = super.rateDeal(dealId, input);
    if (res.ok) this.send("rateDeal", { dealId, input });
    return res;
  }

  // ── Messaging ───────────────────────────────────────────────────────────────

  override getOrCreateThread(
    otherUserId: string,
    context: { listingId?: string; isoPostId?: string } = {},
    threadId?: string,
  ): Res<Thread> {
    const res = super.getOrCreateThread(otherUserId, context, threadId);
    if (res.ok) {
      // res.value.id is the found-or-created thread — the server converges on it.
      this.send("getOrCreateThread", { threadId: res.value.id, otherUserId, context });
    }
    return res;
  }

  override sendMessage(threadId: string, content: string, id?: string): Res<Message> {
    const res = super.sendMessage(threadId, content, id);
    if (res.ok) {
      this.send("sendMessage", { id: res.value.id, threadId, content: res.value.content });
    }
    return res;
  }

  override markThreadRead(threadId: string): void {
    this.sendIfChanged(() => super.markThreadRead(threadId), "markThreadRead", { threadId });
  }

  // ── Notifications ───────────────────────────────────────────────────────────

  override markNotificationRead(id: string): void {
    this.sendIfChanged(() => super.markNotificationRead(id), "markNotificationRead", { id });
  }

  override markAllNotificationsRead(): void {
    this.sendIfChanged(() => super.markAllNotificationsRead(), "markAllNotificationsRead", {});
  }

  // ── Moderation (user-level) ─────────────────────────────────────────────────

  override reportTarget(
    targetType: ReportTargetType,
    targetId: string,
    reason: string,
    details?: string,
  ): Res {
    const res = super.reportTarget(targetType, targetId, reason, details);
    if (res.ok) this.send("reportTarget", { targetType, targetId, reason, details });
    return res;
  }

  override blockUser(targetId: string): Res {
    const res = super.blockUser(targetId);
    if (res.ok) this.send("blockUser", { targetId });
    return res;
  }

  override unblockUser(targetId: string): Res {
    const res = super.unblockUser(targetId);
    if (res.ok) this.send("unblockUser", { targetId });
    return res;
  }

  // ── Linked identities ───────────────────────────────────────────────────────

  override linkIdentity(input: {
    id?: string;
    provider: IdentityProvider;
    handle: string;
    url?: string;
  }): Res<IdentityRecord> {
    const res = super.linkIdentity(input);
    if (res.ok) {
      this.send("linkIdentity", {
        id: res.value.id,
        provider: res.value.provider,
        handle: res.value.handle,
        url: res.value.url,
      });
    }
    return res;
  }

  override removeIdentity(id: string): Res {
    const res = super.removeIdentity(id);
    if (res.ok) this.send("removeIdentity", { id });
    return res;
  }

  // ── Payment handles (private) ───────────────────────────────────────────────

  override addPaymentMethod(input: {
    id?: string;
    kind: PaymentKind;
    label?: string;
    value: string;
  }): Res<PaymentMethod> {
    const res = super.addPaymentMethod(input);
    if (res.ok) {
      this.send("addPaymentMethod", {
        id: res.value.id,
        kind: res.value.kind,
        label: res.value.label,
        value: res.value.value,
      });
    }
    return res;
  }

  override removePaymentMethod(id: string): Res {
    const res = super.removePaymentMethod(id);
    if (res.ok) this.send("removePaymentMethod", { id });
    return res;
  }

  // ── Deal proof ──────────────────────────────────────────────────────────────

  override attachProof(dealId: string, photos: string[]): Res {
    const res = super.attachProof(dealId, photos);
    if (res.ok) this.send("attachProof", { dealId, photos });
    return res;
  }
}

// ─── Singleton wiring ─────────────────────────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var __remotePoachStore: RemotePoachStore | undefined;
}

/**
 * Client singleton (survives HMR and client-side navigation). On the server a
 * throwaway empty store is returned — nothing fetches during SSR.
 */
export function getRemoteStore(): RemotePoachStore {
  if (typeof window === "undefined") return new RemotePoachStore();
  if (!globalThis.__remotePoachStore) {
    globalThis.__remotePoachStore = new RemotePoachStore();
  }
  return globalThis.__remotePoachStore;
}
