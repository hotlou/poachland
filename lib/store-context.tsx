"use client";

/**
 * React binding for the Poachland engine.
 *
 * Usage in a page/component (all pages under the provider are client
 * components):
 *
 *   const store = useStore();          // re-renders on every store change
 *   const hydrated = useHydrated();    // false until the first server snapshot
 *   if (!hydrated) return <Skeleton/>; // avoid SSR/empty-store mismatch
 *   const me = store.requireUser();
 *   const listings = store.listListings({ listingType: "trade" });
 *   ... onClick={() => { const res = store.acceptOffer(deal.id); if (!res.ok) toast(res.error); }}
 *
 * The store is remote-backed: mutations apply locally right away (optimistic)
 * and are reconciled against the server's authoritative snapshot.
 */

import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { getRemoteStore, RemotePoachStore } from "./remote-store";

const StoreContext = createContext<RemotePoachStore | null>(null);

const REFRESH_INTERVAL_MS = 45_000;

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState<RemotePoachStore>(() => getRemoteStore());

  // Bootstrap once on mount, then keep the snapshot fresh: on tab focus,
  // on visibility change, and every 45s while the tab stays open.
  useEffect(() => {
    void store.refetch();
    const onFocus = () => void store.refetch();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void store.refetch();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void store.refetch();
    }, REFRESH_INTERVAL_MS);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(interval);
    };
  }, [store]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

/**
 * The engine, with a subscription so the component re-renders whenever any
 * store data changes. Call methods on it directly for both reads and writes.
 */
export function useStore(): RemotePoachStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used inside <StoreProvider>");
  useSyncExternalStore(store.subscribe, store.getVersion, () => 0);
  return store;
}

/**
 * True once the first authoritative snapshot has landed. Server HTML renders
 * from an empty store, so gate store-driven UI behind this to avoid both
 * hydration mismatches and empty-state flashes.
 */
export function useHydrated(): boolean {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useHydrated must be used inside <StoreProvider>");
  return useSyncExternalStore(
    store.subscribe,
    () => store.ready,
    () => false,
  );
}

/** Convenience: the signed-in user (a ghost placeholder pre-auth). */
export function useCurrentUser() {
  return useStore().requireUser();
}
