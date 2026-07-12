"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store-context";
import { Hydrated } from "@/components/hydrated";
import { STOCK_AVATARS } from "@/lib/constants";
import type { User } from "@/lib/types";

const MAX_BIO = 500;
const MAX_TEAMS = 8;

function EditSkeleton() {
  return (
    <div className="px-4 md:px-6 pt-5 space-y-4 animate-pulse md:max-w-2xl md:mx-auto">
      <div className="h-10 bg-surface rounded-md" />
      <div className="h-10 bg-surface rounded-md" />
      <div className="h-24 bg-surface rounded-md" />
      <div className="h-10 bg-surface rounded-md" />
    </div>
  );
}

function EditForm({ me }: { me: User }) {
  const store = useStore();
  const router = useRouter();

  const [displayName, setDisplayName] = useState(me.displayName);
  const [username, setUsername] = useState(me.username);
  const [bio, setBio] = useState(me.bio);
  const [location, setLocation] = useState(me.location);
  const [teams, setTeams] = useState<string[]>(me.favoriteTeams);
  const [teamDraft, setTeamDraft] = useState("");
  const [avatar, setAvatar] = useState(me.avatar);
  const [saving, setSaving] = useState(false);

  const avatarOptions: string[] = [
    me.avatar,
    ...STOCK_AVATARS.filter((a) => a !== me.avatar),
  ];

  const addTeam = () => {
    const t = teamDraft.trim();
    if (!t) return;
    if (teams.some((x) => x.toLowerCase() === t.toLowerCase())) {
      toast.error("Already in your list");
      return;
    }
    if (teams.length >= MAX_TEAMS) {
      toast.error(`Max ${MAX_TEAMS} teams — pick your true loyalties`);
      return;
    }
    setTeams([...teams, t]);
    setTeamDraft("");
  };

  const save = () => {
    setSaving(true);
    const res = store.updateProfile({
      displayName,
      username,
      bio,
      location: location.trim(),
      favoriteTeams: teams,
      avatar,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Profile updated");
    router.push("/app/profile");
  };

  const inputClass =
    "w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors";
  const labelClass =
    "block text-xs font-display font-bold uppercase tracking-wider text-muted-foreground mb-1.5";

  return (
    <form
      className="px-4 md:px-6 pt-5 md:pt-6 pb-8 space-y-5 md:max-w-2xl md:mx-auto"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      {/* Avatar */}
      <div>
        <span className={labelClass}>Avatar</span>
        <div className="flex gap-3 flex-wrap">
          {avatarOptions.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setAvatar(url)}
              aria-label={i === 0 ? "Keep current avatar" : "Choose avatar"}
              className="flex flex-col items-center gap-1"
            >
              <span
                className={cn(
                  "relative block w-16 h-16 rounded-full overflow-hidden border-2 transition-colors",
                  avatar === url
                    ? "border-accent"
                    : "border-border hover:border-muted-foreground",
                )}
              >
                <img
                  src={url}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                />
                {avatar === url && (
                  <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                    <Check size={11} className="text-accent-foreground" strokeWidth={3} />
                  </span>
                )}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {i === 0 ? "Current" : `Stock ${i}`}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Display name */}
      <div>
        <label htmlFor="displayName" className={labelClass}>
          Display Name
        </label>
        <input
          id="displayName"
          className={inputClass}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Your name"
          maxLength={40}
        />
      </div>

      {/* Username */}
      <div>
        <label htmlFor="username" className={labelClass}>
          Username
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            @
          </span>
          <input
            id="username"
            className={cn(inputClass, "pl-7")}
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            placeholder="handle"
            maxLength={24}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          Lowercase letters, numbers, and . _ - only. At least 3 characters.
        </p>
      </div>

      {/* Bio */}
      <div>
        <label htmlFor="bio" className={labelClass}>
          Bio
        </label>
        <textarea
          id="bio"
          className={cn(inputClass, "min-h-24 resize-y leading-relaxed")}
          value={bio}
          onChange={(e) => setBio(e.target.value.slice(0, MAX_BIO))}
          placeholder="What do you collect? What are you hunting?"
          maxLength={MAX_BIO}
        />
        <p
          className={cn(
            "text-[11px] mt-1 text-right tabular-nums",
            bio.length >= MAX_BIO ? "text-accent" : "text-muted-foreground",
          )}
        >
          {bio.length}/{MAX_BIO}
        </p>
      </div>

      {/* Location */}
      <div>
        <label htmlFor="location" className={labelClass}>
          Location
        </label>
        <input
          id="location"
          className={inputClass}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="City, State"
          maxLength={60}
        />
      </div>

      {/* Favorite teams */}
      <div>
        <span className={labelClass}>Favorite Teams</span>
        {teams.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mb-2">
            {teams.map((team) => (
              <span
                key={team}
                className="inline-flex items-center gap-1.5 text-[13px] bg-card border border-border px-3 py-1 rounded-full text-foreground"
              >
                {team}
                <button
                  type="button"
                  aria-label={`Remove ${team}`}
                  onClick={() => setTeams(teams.filter((t) => t !== team))}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            className={cn(inputClass, "flex-1")}
            value={teamDraft}
            onChange={(e) => setTeamDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTeam();
              }
            }}
            placeholder="e.g. Seattle Riot"
            maxLength={40}
          />
          <button
            type="button"
            onClick={addTeam}
            aria-label="Add team"
            className="w-10 flex items-center justify-center rounded-full border border-border text-muted-foreground hover:text-accent hover:border-accent transition-colors"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Save */}
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 py-2.5 rounded-full bg-accent text-accent-foreground text-sm font-semibold disabled:opacity-60"
        >
          Save changes
        </button>
        <Link
          href="/app/profile"
          className="px-4 py-2.5 rounded-full border border-border bg-card text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

function EditProfileContent() {
  const store = useStore();
  const me = store.requireUser();
  // Key on user id so switching accounts resets the form state.
  return <EditForm key={me.id} me={me} />;
}

export default function EditProfilePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 md:top-14 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 md:px-6 py-3 flex items-center gap-3">
        <Link href="/app/profile" aria-label="Back to profile">
          <ArrowLeft
            size={20}
            className="text-muted-foreground hover:text-foreground transition-colors"
          />
        </Link>
        <h1 className="font-display font-bold text-xl tracking-tight">
          Edit profile
        </h1>
      </header>
      <Hydrated fallback={<EditSkeleton />}>
        <EditProfileContent />
      </Hydrated>
    </div>
  );
}
