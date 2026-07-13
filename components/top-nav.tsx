"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Handshake, Home, Pin, PlusCircle, MessageSquare, Search, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHydrated, useStore } from "@/lib/store-context";

const LINKS = [
  { href: "/app", label: "Home", icon: Home, exact: true },
  { href: "/app/browse", label: "Browse", icon: Search },
  { href: "/app/wanted", label: "Wanted", icon: Pin },
  { href: "/app/trades", label: "Deals", icon: Handshake },
  { href: "/app/haul", label: "The Haul", icon: Trophy },
  { href: "/app/inbox", label: "Inbox", icon: MessageSquare },
];

/** Desktop navigation — hidden on mobile, where BottomNav takes over. */
export function TopNav() {
  const pathname = usePathname();
  const store = useStore();
  const hydrated = useHydrated();
  const me = store.requireUser();
  const unreadMessages = hydrated
    ? store.unreadMessageCount() + store.dealsAwaitingResponse(me.id).length
    : 0;
  const unreadNotifications = hydrated ? store.unreadNotificationCount() : 0;

  return (
    <header className="hidden md:block sticky top-0 z-50 bg-background/90 backdrop-blur border-b border-border">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center gap-6">
        <Link href="/app" className="font-display font-bold text-lg tracking-tight text-accent">
          Poachland
        </Link>
        <nav className="flex items-center gap-1">
          {LINKS.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            const badge = href === "/app/inbox" ? unreadMessages : 0;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13.5px] font-medium transition-colors",
                  active
                    ? "bg-accent/10 text-accent"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                )}
              >
                <Icon size={15} strokeWidth={active ? 2.4 : 2} />
                {label}
                {badge > 0 && (
                  <span className="ml-0.5 min-w-4 h-4 px-1 rounded-full bg-accent text-accent-foreground text-[10px] font-bold flex items-center justify-center">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="flex-1" />
        <Link
          href="/app/create"
          className="inline-flex items-center gap-1.5 rounded-full bg-accent text-accent-foreground px-4 py-1.5 text-[13.5px] font-semibold hover:bg-accent/90 transition-colors shadow-sm"
        >
          <PlusCircle size={15} /> Post
        </Link>
        <Link
          href="/app/notifications"
          aria-label="Notifications"
          className="relative text-muted-foreground hover:text-foreground transition-colors"
        >
          <Bell size={18} />
          {unreadNotifications > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-0.5 rounded-full bg-accent text-accent-foreground text-[9px] font-bold flex items-center justify-center">
              {unreadNotifications > 9 ? "9+" : unreadNotifications}
            </span>
          )}
        </Link>
        <Link href="/app/profile" aria-label="Your profile" className="flex-shrink-0">
          <span className="block w-8 h-8 rounded-full overflow-hidden border border-border hover:border-accent transition-colors">
            <img src={me.avatar} alt={me.displayName} className="w-full h-full object-cover" />
          </span>
        </Link>
      </div>
    </header>
  );
}
