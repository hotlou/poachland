import type { Metadata } from "next";
import { LegalHeading, LegalShell } from "@/components/legal-shell";

export const metadata: Metadata = {
  title: "Community Guidelines — Poachland",
  description: "Poachland's marketplace conduct and enforcement standards.",
  alternates: { canonical: "/community-guidelines" },
};

export default function CommunityGuidelinesPage() {
  return (
    <LegalShell title="Community Guidelines" lastUpdated="September 6, 2026">
      <p>
        Poachland should feel like the best sideline: competitive about the collection,
        generous with the community, and safe for every player. These rules apply to profiles,
        listings, messages, offers, ratings, comments, and referrals.
      </p>

      <LegalHeading>Be honest about gear and deals</LegalHeading>
      <p>
        List only items you own and may transfer. Use current photos, disclose meaningful wear
        or repairs, identify reproductions, and do not manipulate ratings or identity signals.
        Follow accepted terms, communicate delays promptly, and preserve shipping evidence.
      </p>

      <LegalHeading>Respect people and privacy</LegalHeading>
      <p>
        No harassment, threats, hate, sexual exploitation, impersonation, doxxing, or pressure
        to move a conversation off-platform. Do not publish another person&apos;s address, payment
        details, private messages, or identity documents.
      </p>

      <LegalHeading>No fraud, spam, or manipulation</LegalHeading>
      <p>
        Counterfeit or stolen goods, payment scams, phishing, artificial engagement, duplicate
        accounts used to evade enforcement, and unsolicited bulk promotion are prohibited.
        Referral links may be shared with people who are likely to want Poachland; automated,
        purchased, misleading, or repetitive referral distribution is not allowed.
      </p>

      <LegalHeading>How enforcement works</LegalHeading>
      <p>
        We consider severity, evidence, context, prior behavior, and risk of further harm.
        Actions may include a warning, content removal, reduced visibility, time-limited
        suspension, or a permanent ban. Urgent safety, fraud, or privacy reports are targeted
        for immediate containment; ordinary reports within two business days; appeals within
        five business days. Severe conduct may skip progressive steps.
      </p>

      <LegalHeading>Report and appeal</LegalHeading>
      <p>
        Use the report control on a listing, profile, or deal and include relevant facts. For
        urgent danger, contact local emergency services first. Appeals can be sent to
        broker@poachland.com; include the account or deal ID and explain what was missed. When
        practical, a different moderator reviews the appeal.
      </p>
    </LegalShell>
  );
}
