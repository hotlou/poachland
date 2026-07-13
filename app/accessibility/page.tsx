import type { Metadata } from "next";
import { LegalHeading, LegalShell } from "@/components/legal-shell";

export const metadata: Metadata = {
  title: "Accessibility — Poachland",
  description: "How Poachland works toward being usable by everyone.",
  alternates: { canonical: "/accessibility" },
};

const CONTACT = "broker@poachland.com";

export default function AccessibilityPage() {
  return (
    <LegalShell title="Accessibility" lastUpdated="July 13, 2026">
      <p>
        Poachland is built by players, for players — all of them. We want the
        marketplace to be usable no matter how you browse: mouse, keyboard,
        touch, screen reader, or with motion turned down. We aim to meet the
        spirit of WCAG 2.1 AA, and we treat accessibility as ongoing work, not a
        checkbox.
      </p>

      <LegalHeading>What we&apos;ve built in</LegalHeading>
      <p>
        <strong>Keyboard navigation</strong> — every interactive control is
        reachable and operable by keyboard, with a &ldquo;skip to content&rdquo;
        link and a clear, consistent focus outline that appears for keyboard
        users. <br />
        <strong>Screen readers</strong> — semantic landmarks and headings,
        descriptive labels on icon-only buttons, and alt text on meaningful
        images. <br />
        <strong>Reduced motion</strong> — if your system asks for reduced
        motion, we cut animations and smooth-scrolling. <br />
        <strong>Readable by default</strong> — a warm, high-contrast light theme
        (with a dark toggle), scalable text, and layouts that reflow down to
        small screens.
      </p>

      <LegalHeading>Known limits</LegalHeading>
      <p>
        Some content is created by other traders — listing photos, for
        instance, may not always carry a rich description. We&apos;re a young
        project and some corners are still being polished. If something gets in
        your way, that&apos;s a bug to us.
      </p>

      <LegalHeading>Tell us</LegalHeading>
      <p>
        Hit a barrier, or have an idea that would make Poachland easier to use?
        Email{" "}
        <a href={`mailto:${CONTACT}`} className="text-accent font-semibold hover:underline">{CONTACT}</a>
        {" "}— accessibility reports go to the top of the pile.
      </p>
    </LegalShell>
  );
}
