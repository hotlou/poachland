"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AccountGate } from "@/components/account-gate";
import { BottomNav } from "@/components/bottom-nav";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { TopNav } from "@/components/top-nav";
import { useHydrated, useStore } from "@/lib/store-context";

/** Everything under /app requires a session. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const store = useStore();
  const router = useRouter();
  const ready = useHydrated();
  const signedOut = ready && !store.sessionMe;

  useEffect(() => {
    if (signedOut) router.replace("/login");
  }, [signedOut, router]);

  if (!ready || signedOut) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div
          className="w-8 h-8 rounded-full border-2 border-border border-t-accent animate-spin"
          role="status"
          aria-label="Loading"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ImpersonationBanner />
      <AccountGate>
        <TopNav />
        <main className="pb-20 md:pb-12 mx-auto w-full max-w-lg md:max-w-3xl lg:max-w-4xl">
          {children}
        </main>
        <div className="md:hidden">
          <BottomNav />
        </div>
      </AccountGate>
    </div>
  );
}
