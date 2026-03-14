"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Send, ArrowLeft } from "lucide-react";
import { DEMO_PROPOSALS, DEMO_USERS, DEMO_LISTINGS } from "@/lib/seed-data";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  pending: "text-yellow-400 border-yellow-400",
  accepted: "text-accent border-accent",
  rejected: "text-red-400 border-red-400",
  countered: "text-purple-400 border-purple-400",
  completed: "text-sky-400 border-sky-400",
  expired: "text-muted-foreground border-border",
};

const MOCK_MESSAGES = [
  { sender: "u2", content: "That Brute jersey is sick. Offering my 2011 UPA disc + $15. Let me know.", time: "2h ago" },
  { sender: "u1", content: "Appreciate the offer! Let me think about it — that disc is legit though.", time: "1h ago" },
  { sender: "u2", content: "No rush. Been hunting a Brute jersey for two seasons lol.", time: "45m ago" },
];

export default function InboxPage() {
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState(MOCK_MESSAGES);

  const activeProposal = DEMO_PROPOSALS.find((p) => p.id === activeThread);

  const sendMessage = () => {
    if (!message.trim()) return;
    setMessages((prev) => [...prev, { sender: "u1", content: message, time: "now" }]);
    setMessage("");
  };

  if (activeThread && activeProposal) {
    const otherUser = activeProposal.fromUserId === "u1" ? activeProposal.toUser : activeProposal.fromUser;
    const offeredListing = DEMO_LISTINGS.find((l) => l.id === activeProposal.offeredListingId);
    const wantedListing = DEMO_LISTINGS.find((l) => l.id === activeProposal.wantedListingId);

    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Thread header */}
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
          <button onClick={() => setActiveThread(null)}>
            <ArrowLeft size={20} />
          </button>
          <div className="w-8 h-8 rounded-full overflow-hidden">
            <Image src={otherUser.avatar} alt={otherUser.username} width={32} height={32} className="object-cover" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">@{otherUser.username}</p>
            <span className={cn("badge-stamp text-[9px]", STATUS_COLORS[activeProposal.status])}>
              {activeProposal.status}
            </span>
          </div>
        </header>

        {/* Trade summary card */}
        <div className="mx-4 mt-4 bg-card border border-border rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-2 uppercase tracking-widest font-semibold">Trade proposal</p>
          <div className="flex items-center gap-3">
            {offeredListing && (
              <div className="flex-1 text-center">
                <div className="relative aspect-square w-full rounded-lg overflow-hidden mb-1">
                  <Image src={offeredListing.photos[0]} alt={offeredListing.title} fill className="object-cover" sizes="80px" />
                </div>
                <p className="text-[10px] text-muted-foreground line-clamp-1">{offeredListing.title}</p>
              </div>
            )}
            <div className="text-muted-foreground font-display font-700 text-lg">⟷</div>
            {wantedListing && (
              <div className="flex-1 text-center">
                <div className="relative aspect-square w-full rounded-lg overflow-hidden mb-1">
                  <Image src={wantedListing.photos[0]} alt={wantedListing.title} fill className="object-cover" sizes="80px" />
                </div>
                <p className="text-[10px] text-muted-foreground line-clamp-1">{wantedListing.title}</p>
              </div>
            )}
          </div>
          {activeProposal.cashAdded && (
            <p className="text-xs text-accent font-semibold text-center mt-2">
              +${activeProposal.cashAdded} cash sweetener
            </p>
          )}
          {activeProposal.status === "pending" && (
            <div className="flex gap-2 mt-3">
              <button className="flex-1 py-2 bg-accent text-accent-foreground text-xs font-display font-700 uppercase rounded-sm">
                Accept
              </button>
              <button className="flex-1 py-2 bg-surface border border-border text-xs font-display font-700 uppercase rounded-sm text-muted-foreground">
                Counter
              </button>
              <button className="flex-1 py-2 bg-surface border border-destructive text-destructive text-xs font-display font-700 uppercase rounded-sm">
                Decline
              </button>
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 px-4 py-4 flex flex-col gap-3 overflow-y-auto">
          {messages.map((msg, i) => {
            const isMe = msg.sender === "u1";
            return (
              <div key={i} className={cn("flex gap-2", isMe ? "justify-end" : "justify-start")}>
                {!isMe && (
                  <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 mt-auto">
                    <Image src={otherUser.avatar} alt="" width={28} height={28} className="object-cover" />
                  </div>
                )}
                <div className={cn(
                  "max-w-[75%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
                  isMe
                    ? "bg-accent text-accent-foreground rounded-br-sm"
                    : "bg-surface-raised text-foreground rounded-bl-sm",
                )}>
                  {msg.content}
                  <p className={cn("text-[10px] mt-1", isMe ? "text-accent-foreground/60" : "text-muted-foreground")}>
                    {msg.time}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Input */}
        <div className="sticky bottom-0 bg-surface border-t border-border px-4 py-3 pb-safe">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Message..."
              className="flex-1 bg-background border border-border rounded-full px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-accent transition-colors"
            />
            <button
              onClick={sendMessage}
              className="w-10 h-10 rounded-full bg-accent flex items-center justify-center flex-shrink-0"
            >
              <Send size={16} className="text-accent-foreground" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
        <h1 className="font-display font-800 text-xl uppercase tracking-tight">Inbox</h1>
      </header>

      <div className="divide-y divide-border">
        {DEMO_PROPOSALS.map((proposal) => {
          const otherUser = proposal.fromUserId === "u1" ? proposal.toUser : proposal.fromUser;
          const offeredListing = DEMO_LISTINGS.find((l) => l.id === proposal.offeredListingId);

          return (
            <button
              key={proposal.id}
              onClick={() => setActiveThread(proposal.id)}
              className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-surface transition-colors"
            >
              <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                <Image src={otherUser.avatar} alt={otherUser.username} width={48} height={48} className="object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-semibold">@{otherUser.username}</p>
                  <span className={cn("badge-stamp text-[9px]", STATUS_COLORS[proposal.status])}>
                    {proposal.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1">{proposal.note}</p>
              </div>
              <div className="flex-shrink-0">
                {offeredListing && (
                  <div className="w-10 h-10 rounded-lg overflow-hidden relative">
                    <Image src={offeredListing.photos[0]} alt="" fill className="object-cover" sizes="40px" />
                  </div>
                )}
              </div>
            </button>
          );
        })}

        {DEMO_PROPOSALS.length === 0 && (
          <div className="text-center py-16 px-4">
            <p className="font-display font-700 text-xl uppercase text-muted-foreground mb-2">
              No active trades
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Browse listings and propose your first trade.
            </p>
            <Link href="/app/browse" className="text-accent text-sm font-semibold">
              Start browsing
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
