import type { Metadata } from "next";
import Link from "next/link";
import { LegalHeading, LegalShell } from "@/components/legal-shell";

export const metadata: Metadata = {
  title: "Deal Safety & Buyer Protection — Poachland",
  description: "What Poachland does, what traders must do, and how disputes work.",
  alternates: { canonical: "/buyer-protection" },
};

export default function BuyerProtectionPage() {
  return (
    <LegalShell title="Deal safety & buyer protection" lastUpdated="September 6, 2026">
      <p>
        Poachland is a <strong>coordination-only marketplace</strong>. We do not process
        payments, hold funds in escrow, insure shipments, or guarantee a refund. A deal is
        an agreement directly between its two traders. The safeguards below help both sides
        make an informed decision and preserve evidence when something goes wrong.
      </p>

      <LegalHeading>Before accepting</LegalHeading>
      <p>
        Keep negotiation in Poachland messages; confirm the exact items, condition, cash,
        shipping responsibility, and deadline; inspect profile history and ratings; and ask
        for current photos when authenticity or condition matters. Payment handles are shown
        only after both sides accept. Never send credentials, one-time codes, or more money
        than the accepted terms require.
      </p>

      <LegalHeading>Shipping and handoff</LegalHeading>
      <p>
        Use the carrier and tracking fields in the deal, photograph the packed item and
        shipping receipt, and add that proof to the deal. For local handoff, agree on a public
        place and add a concise confirmation in the thread. Do not mark your side complete
        until you have received and inspected what was promised.
      </p>

      <LegalHeading>Cancellation</LegalHeading>
      <p>
        Before acceptance, a pending offer may be declined or withdrawn. After acceptance,
        either party can cancel while the deal is still active, but must give a truthful
        reason. If payment or shipping has already occurred, open a dispute instead so the
        record remains available for review. Repeated or abusive cancellations may result in
        account restrictions.
      </p>

      <LegalHeading>Disputes and evidence</LegalHeading>
      <p>
        Either party may open a dispute on an accepted deal. Include a specific description,
        relevant messages, item and packaging photos, tracking, receipts, and any payment
        confirmation with sensitive details redacted. Moderators can preserve the deal,
        restrict accounts, remove listings, and close the record as cancelled or completed.
        Because Poachland does not control payment or carriers, moderators cannot reverse a
        transfer, compel a refund, or guarantee recovery.
      </p>

      <LegalHeading>Response and appeal</LegalHeading>
      <p>
        Safety threats, suspected fraud, and exposed private information are prioritized for
        immediate containment. Other deal disputes are targeted for initial review within two
        business days. To appeal an enforcement decision, email broker@poachland.com with the
        deal ID and new or missing evidence. See the{" "}
        <Link href="/community-guidelines" className="text-accent font-semibold hover:underline">
          Community Guidelines
        </Link>{" "}
        for enforcement principles.
      </p>
    </LegalShell>
  );
}
