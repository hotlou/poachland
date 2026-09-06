# Accessibility acceptance criteria

Poachland targets WCAG 2.2 Level AA for the public marketplace and authenticated core deal flow. Accessibility is a release gate, not a one-time certification.

## Automated release gate

- Axe reports no WCAG A/AA violations on the landing, authentication, browse, wanted, haul, shop, policy, and accessibility routes at desktop and mobile viewports.
- Authenticated axe coverage waits for hydration and scans the dashboard, listing creation, inbox, trades, and settings surfaces.
- The skip link is the first keyboard stop and moves focus to the main region.
- Authentication controls have accessible names and remain keyboard operable.
- Type checking, linting, Playwright accessibility tests, and the production build pass in CI.

## Manual beta audit

Before each beta promotion, test sign-in, onboarding, create listing, browse/search, make and respond to an offer, message, add shipment tracking, confirm receipt, open a dispute, and report content using:

- Keyboard only at 1280 px and 390 px widths, including visible focus, dialogs, and focus return.
- VoiceOver with Safari on the current macOS/iOS release and NVDA with Chrome on the current Windows release.
- Text zoom at 200% and browser zoom at 400% without loss of content or controls.
- Light/dark mode, reduced motion, and forced-colors/high-contrast mode.
- Current Safari, Chrome, Firefox, and Edge; one prior major version where practical.

Record tester, date, browser/assistive-technology versions, journey, result, and issue links. Block promotion for any inaccessible critical action, keyboard trap, missing accessible name, focus loss, or content-obscuring reflow. Other defects require an owner and due date.

The production-artifact HTTP check and any environment limitations are recorded in [runtime-validation.md](./runtime-validation.md). That check does not replace this manual matrix.
