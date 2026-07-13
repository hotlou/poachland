import type { Metadata } from "next";
import Link from "next/link";
import { LegalHeading, LegalShell } from "@/components/legal-shell";

export const metadata: Metadata = {
  title: "Terms of Service — Poachland",
  description: "The rules of the road for trading on Poachland.",
  alternates: { canonical: "/terms" },
};

const CONTACT = "broker@poachland.com";

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" lastUpdated="July 13, 2026">
      <p>
        Welcome to Poachland, a community marketplace where ultimate frisbee
        players trade, sell, and give away jerseys and discs. By creating an
        account or using the site, you agree to these Terms. If you don&apos;t
        agree, please don&apos;t use Poachland.
      </p>

      <LegalHeading>Who can use Poachland</LegalHeading>
      <p>
        You must be at least 13 years old to use Poachland, and old enough to
        form a binding contract where you live. You&apos;re responsible for
        anything that happens under your account, so keep your email and
        password secure. Sign-in links are single-use and expire quickly —
        don&apos;t share them.
      </p>

      <LegalHeading>Listings, trades &amp; deals</LegalHeading>
      <p>
        Poachland is <strong>free</strong> — we charge no fees to list, trade,
        buy, or give anything away. Poachland is a venue that connects traders;
        we are <strong>not a party</strong> to any deal, we don&apos;t take
        possession of items, and we don&apos;t currently offer escrow or payment
        processing. When cash is part of a deal, you settle it directly with the
        other trader using the handles you each choose to share. That means you
        rely on your own judgment: inspect what&apos;s offered, use tracked
        shipping, keep proof, and only trade with people you trust. Ratings,
        trust scores, verification, and deal proof exist to help you decide, but
        they are signals, not guarantees.
      </p>
      <p>
        You agree to list only items you own and may lawfully transfer, to
        describe them honestly, and to follow through on deals you accept.
        Backing out of accepted deals, misrepresenting items, or failing to
        deliver may hurt your reputation and can lead to moderation.
      </p>

      <LegalHeading>Your content</LegalHeading>
      <p>
        You keep ownership of the photos, descriptions, comments, and other
        content you post. You grant Poachland a non-exclusive, worldwide,
        royalty-free license to host, display, and distribute that content for
        the purpose of operating and promoting the marketplace (for example,
        showing your listing in browse, your trade on The Haul, or a preview
        card when a page is shared). You&apos;re responsible for your content and
        confirm you have the right to post it.
      </p>

      <LegalHeading>Things you may not do</LegalHeading>
      <p>
        Don&apos;t use Poachland to break the law, infringe others&apos; rights,
        post counterfeit or stolen goods, harass or deceive other traders, spam,
        scrape, probe or disrupt the service, or evade moderation. Don&apos;t
        post content that is unlawful, hateful, or invades someone&apos;s
        privacy.
      </p>

      <LegalHeading>Moderation</LegalHeading>
      <p>
        To keep the community healthy we may remove content, limit visibility,
        suspend, or ban accounts that violate these Terms or harm other traders,
        with or without notice. You can report listings, users, and deals, and
        open a dispute on a deal for a moderator to review.
      </p>

      <LegalHeading>Disclaimers &amp; liability</LegalHeading>
      <p>
        Poachland is provided &ldquo;as is,&rdquo; without warranties of any
        kind. We don&apos;t guarantee that items are as described, that traders
        will perform, or that the service will be uninterrupted or error-free.
        To the fullest extent permitted by law, Poachland and its operators
        aren&apos;t liable for indirect, incidental, or consequential damages, or
        for losses arising out of deals between traders.
      </p>

      <LegalHeading>Changes &amp; contact</LegalHeading>
      <p>
        We may update these Terms as Poachland grows; we&apos;ll change the
        &ldquo;last updated&rdquo; date above, and significant changes may be
        announced in the app. Questions? Reach us at{" "}
        <a href={`mailto:${CONTACT}`} className="text-accent font-semibold hover:underline">{CONTACT}</a>.
        See also our{" "}
        <Link href="/privacy" className="text-accent font-semibold hover:underline">Privacy Policy</Link>.
      </p>
    </LegalShell>
  );
}
