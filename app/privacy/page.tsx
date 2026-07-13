import type { Metadata } from "next";
import Link from "next/link";
import { LegalHeading, LegalShell } from "@/components/legal-shell";

export const metadata: Metadata = {
  title: "Privacy Policy — Poachland",
  description: "What Poachland collects, why, and the choices you have.",
  alternates: { canonical: "/privacy" },
};

const CONTACT = "hello@poachland.com";

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" lastUpdated="July 13, 2026">
      <p>
        This policy explains what Poachland collects, why, who we share it with,
        and the choices you have. We try to collect as little as possible and
        never sell your data.
      </p>

      <LegalHeading>What we collect</LegalHeading>
      <p>
        <strong>Account &amp; profile:</strong> your email address, and the
        profile you create — username, display name, location, bio, photos,
        favorite teams, playing history, and any social handles or USAU ID you
        choose to link. <br />
        <strong>Marketplace activity:</strong> your listings, wanted posts,
        deals, messages, ratings, reactions, and comments. <br />
        <strong>Payment handles:</strong> if you save Venmo/PayPal/Cash
        App/Zelle/crypto handles, we store them <strong>privately</strong>. They
        are never shown publicly and are revealed only to the other party of a
        deal you&apos;ve both accepted, so you can settle up. <br />
        <strong>Usage:</strong> privacy-friendly, aggregate analytics (via Vercel
        Analytics) about page visits, and basic security/technical logs.
      </p>

      <LegalHeading>How we use it</LegalHeading>
      <p>
        To run the marketplace (show your public profile and listings, power
        trades and messaging, compute trust and badges); to send you
        transactional and notification emails (sign-in links, deal activity,
        messages, community events) via our email provider; to keep Poachland
        safe from spam, fraud, and abuse; and to understand and improve how the
        site is used.
      </p>

      <LegalHeading>What&apos;s public vs. private</LegalHeading>
      <p>
        Your profile, listings, wanted posts, ratings, and any trades you share
        to The Haul are <strong>public</strong> and may be indexed by search
        engines. Your email, payment handles, private messages, notifications,
        and deal details are <strong>not public</strong> — messages and deal
        details are visible only to you and the trader you&apos;re dealing with;
        payment handles only to an accepted-deal counterparty.
      </p>

      <LegalHeading>Who we share it with</LegalHeading>
      <p>
        We don&apos;t sell your data. We use a small set of service providers to
        run Poachland, and share only what each needs: <strong>Neon</strong>
        {" "}(database hosting), <strong>Vercel</strong> (site hosting and
        analytics), and <strong>Resend</strong> (sending email). Other traders
        see the public information described above. We may disclose information
        if required by law or to protect the safety and rights of the community.
      </p>

      <LegalHeading>Cookies</LegalHeading>
      <p>
        We use a single essential, http-only cookie to keep you signed in, plus
        a small preference for your light/dark theme. Our analytics are designed
        to be privacy-friendly and don&apos;t use advertising cookies.
      </p>

      <LegalHeading>Your choices</LegalHeading>
      <p>
        You can edit your profile and linked identities anytime, and remove your
        payment handles. You control which emails you receive with per-category
        toggles in Settings, and every notification email has a one-click
        unsubscribe. To access, export, or delete your account and associated
        data, email us at{" "}
        <a href={`mailto:${CONTACT}`} className="text-accent font-semibold hover:underline">{CONTACT}</a>
        {" "}and we&apos;ll take care of it.
      </p>

      <LegalHeading>Retention &amp; security</LegalHeading>
      <p>
        We keep your information while your account is active and as needed to
        operate the service, resolve disputes, and meet legal obligations.
        Sign-in is passwordless by default (magic links); if you set a password
        it&apos;s stored only as a salted hash. No online service is perfectly
        secure, but we take reasonable measures to protect your data.
      </p>

      <LegalHeading>Children</LegalHeading>
      <p>
        Poachland isn&apos;t directed to children under 13, and we don&apos;t
        knowingly collect their information.
      </p>

      <LegalHeading>Changes &amp; contact</LegalHeading>
      <p>
        We&apos;ll update this policy as Poachland evolves and revise the
        &ldquo;last updated&rdquo; date above. Questions or requests? Email{" "}
        <a href={`mailto:${CONTACT}`} className="text-accent font-semibold hover:underline">{CONTACT}</a>.
        See also our{" "}
        <Link href="/terms" className="text-accent font-semibold hover:underline">Terms of Service</Link>.
      </p>
    </LegalShell>
  );
}
