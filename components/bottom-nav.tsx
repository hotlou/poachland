"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, PlusCircle, MessageSquare, User } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/app", label: "Home", icon: Home },
  { href: "/app/browse", label: "Browse", icon: Search },
  { href: "/app/create", label: "Post", icon: PlusCircle },
  { href: "/app/inbox", label: "Inbox", icon: MessageSquare },
  { href: "/app/profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border">
      <div className="flex items-center justify-around h-16 px-2 max-w-lg mx-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== "/app" && pathname.startsWith(href));
          const isPost = href === "/app/create";
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors",
                isPost ? "" : "",
                isActive && !isPost ? "text-accent" : "text-muted-foreground",
              )}
            >
              {isPost ? (
                <span className="flex items-center justify-center w-11 h-11 rounded-full bg-accent text-accent-foreground shadow-lg">
                  <Icon size={22} strokeWidth={2.5} />
                </span>
              ) : (
                <>
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
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
