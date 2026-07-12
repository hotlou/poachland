"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, PlusCircle, MessageSquare, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHydrated, useStore } from "@/lib/store-context";

const NAV_ITEMS = [
  { href: "/app", label: "Home", icon: Home },
  { href: "/app/browse", label: "Browse", icon: Search },
  { href: "/app/create", label: "Post", icon: PlusCircle },
  { href: "/app/inbox", label: "Inbox", icon: MessageSquare },
  { href: "/app/profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  const store = useStore();
  const hydrated = useHydrated();

  const me = store.requireUser();
  const inboxBadge = hydrated
    ? store.unreadMessageCount() + store.dealsAwaitingResponse(me.id).length
    : 0;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border">
      <div className="flex items-center justify-around h-16 px-2 max-w-lg mx-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== "/app" && pathname.startsWith(href));
          const isPost = href === "/app/create";
          const badge = href === "/app/inbox" ? inboxBadge : 0;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors",
                isActive && !isPost ? "text-accent" : "text-muted-foreground",
              )}
            >
              {isPost ? (
                <span className="flex items-center justify-center w-11 h-11 rounded-full bg-accent text-accent-foreground shadow-lg">
                  <Icon size={22} strokeWidth={2.5} />
                </span>
              ) : (
                <>
                  <span className="relative">
                    <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                    {badge > 0 && (
                      <span className="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 rounded-full bg-accent text-accent-foreground text-[9px] font-bold flex items-center justify-center">
                        {badge > 9 ? "9+" : badge}
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] font-medium tracking-wide">{label}</span>
                </>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
