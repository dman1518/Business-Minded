# Business Clarity Session — open product-owner decisions

This file collects every business-policy question the Business Clarity
Session build deliberately left unanswered rather than guessing. Code
comments throughout the paid-offer code reference this file by name.
Nothing below blocks the app from running — each item has a safe,
honest default (usually "do nothing automatically, let a human handle
it") — but all of them are real gaps a production consulting business
would normally want a real answer to.

## Refunds, cancellations, rescheduling, no-shows

No policy is implemented. The webhook listens for Stripe's
`charge.refunded` event and updates purchase status accordingly, but
nothing in this app *initiates* a refund — that has to be done manually
in the Stripe Dashboard today. There is no cancellation window, no
reschedule-without-penalty policy, and no defined no-show handling
(the fulfillment view lets an internal user manually cancel a
*scheduled* session, but doesn't encode any policy about when that's
appropriate).

## Tax handling

Stripe Checkout is not configured for Stripe Tax or any other
automatic tax calculation. The full amount charged is treated as the
service price with no tax line item. Whether tax needs to be
collected (and in which jurisdictions) is unanswered.

## Supported countries / currencies

Everything is hardcoded to USD (`CLARITY_OFFER_CURRENCY` in
`src/domain/policies/ClarityOfferConfig.ts`). Stripe Checkout is not
restricted to specific countries, so in principle anyone anywhere can
pay in USD, but nothing has been decided about whether that's
intended or whether geographic/currency restrictions should apply.

## Plan-delivery timing and method

The offer promises a written Business Clarity Plan "within 24 hours."
Nothing in this app enforces or reminds anyone about that SLA — the
internal fulfillment view lets a human mark a purchase "delivered"
whenever they actually send it, and the plan-template endpoint
generates a starting-point Markdown file, but delivery itself (email,
shared doc, etc.) and the 24-hour clock are entirely manual.

## Scheduling provider

`CLARITY_SESSION_SCHEDULING_URL` is a placeholder env var pointing at
whatever external booking page gets chosen (Calendly, Cal.com, etc.).
No provider has been selected. Until it's set, customers see a "we'll
follow up personally to schedule" message instead of a booking link —
that fallback was a deliberate choice (never show a broken/fake link),
not a recommendation for how scheduling should ultimately work.

## Support contact

No dedicated support email or phone number is surfaced anywhere in the
paid-offer flow beyond "just reply to this email" in the receipt
template (`src/infrastructure/email/clarityEmailTemplates.ts`), which
only reaches customers if `RESEND_FROM_EMAIL` is a real, monitored
inbox.

## Data retention

No retention or deletion policy exists for `ClarityPurchase` or
`ClarityIntake` rows — intake answers (business details, revenue
range, etc.) are kept indefinitely today. Whether/when that data
should be deleted, and what the privacy policy should say about it,
is unanswered. (The existing `/privacy` page has not been updated to
mention the paid-offer data collection at all — see the completion
report's open-items list.)

## Founding-price cutoff mechanism

The spec said founding pricing ends after 10 paid purchases. That's
what's implemented (`computeOfferPricing` in `ClarityOfferConfig.ts`),
derived from a real DB count — never a hardcoded or guessed number.
No date-based cutoff or manual override switch exists. There's also a
documented, accepted-for-v1 race condition: the count read isn't
atomic with checkout-session creation, so a concurrent burst right at
the 10th sale could in principle let slightly more than 10 people
start a founding-priced checkout (every one would still be charged
the founding price honestly — never a bait-and-switch — but the total
could exceed exactly 10 by a small amount under real concurrency).

## Guarantee / refund-request process

No guarantee is offered or promised anywhere in the current copy, and
no self-serve refund-request flow exists (see "Refunds" above).

## Admin authentication model

The internal fulfillment view (`/internal/clarity-fulfillment`) is
protected by a single shared secret (`CLARITY_ADMIN_SHARED_SECRET`)
rather than real per-user accounts — explicitly a stopgap given this
codebase has no auth system at all. Anyone holding the secret can view
every customer's intake answers and purchase data, and there is no
audit log of who took which fulfillment action (mark scheduled, mark
delivered, etc.) — only *that* it happened and *when*.

## Follow-up check-in scheduling

The offer promises "one 15-minute follow-up check-in." There's no
automated way to schedule or remind about this — the fulfillment view
only tracks a manually-set `followUpDueAt`/`followUpDoneAt` pair that
an internal user sets and clears by hand.
