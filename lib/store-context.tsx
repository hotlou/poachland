"use client";

/**
 * React binding for the Poachland engine.
 *
 * Usage in a page/component (all pages under the provider are client
 * components):
 *
 *   const store = useStore();          // re-renders on every store change
 *   const hydrated = useHydrated();    // false during SSR + first paint
 *   if (!hydrated) return <Skeleton/>; // avoid SSR/localStorage mismatch
 *   const me = store.requireUser();
 *   const listings = store.listListings({ listingType: "trade" });
 *   ... onClick={() => { const res = store.acceptOffer(deal.id); if (!res.ok) toast(res.error); }}
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { createEphemeralStore, getClientStore, PoachStore } from "./engine";

const StoreContext = createContext<PoachStore | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState<PoachStore>(() =>
    typeof window === "undefined" ? createEphemeralStore() : getClientStore(),
  );

  // Sweep offer expirations once per mount (and thus per full page load).
  useEffect(() => {
    store.sweepExpirations();
  }, [store]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

/**
 * The engine, with a subscription so the component re-renders whenever any
 * store data changes. Call methods on it directly for both reads and writes.
 */
export function useStore(): PoachStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used inside <StoreProvider>");
  useSyncExternalStore(store.subscribe, store.getVersion, () => 0);
  return store;
}

/**
 * True once mounted on the client. Server HTML is rendered from seed data
 * while the browser store may hold user changes, so gate store-driven UI
 * behind this to avoid hydration mismatches.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}

/** Convenience: the signed-in user (demo default if none). */
export function useCurrentUser() {
  return useStore().requireUser();
}
