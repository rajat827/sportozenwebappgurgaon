# Sportozen web app architecture

## Status and boundaries

This repository was empty when implementation began. The requested `Sportozen7/App`, `cloud-functions`, `Admin`, and `Vendor` repositories returned 404 to the connected GitHub account, so their schemas, APIs, inventory rules, payment provider, and WhatsApp provider could not be verified. The app therefore ships with a **demo-only, source-linked venue adapter** and an optional HTTP venue adapter. Demo records are discovery examples, not Sportozen inventory or proof that a venue accepts a booking.

## Flow

`Browser → venue discovery adapter → venue detail → central Sportozen WhatsApp handoff`

When existing cloud services become accessible, the production flow is:

`Browser → existing venue API → enquiry API → official WhatsApp Business webhook → existing availability/pricing/hold/payment/booking services → Admin/Vendor`

The browser owns only discovery, presentation, selected venue/sport/date preference, and opening a WhatsApp enquiry. It cannot quote a final price, hold inventory, accept payment, or mark a booking confirmed. The WhatsApp message explicitly asks the team to confirm availability and price. The central destination is configured with `SPORTOZEN_WHATSAPP_NUMBER` in `config.js` (default `919311683317`).

## Data contract

The UI consumes `GET {VENUE_API_BASE_URL}/venues?city=gurugram` when configured. Response: `{ "venues": Venue[] }`, where `Venue` has stable `id`, `name`, `city`, `locality`, `address`, `latitude`, `longitude`, `sports[]`, optional `photos[]`, `facilities[]`, `openingHours`, `startingPrice` (`amount`, `currency`, `unit`), `rating` (`value`, `count`), `offer` (`label`, `terms`), and `sourceUrl`. Missing fields stay missing in the UI. The real API should return only venues eligible for customer enquiries. A failure displays an error rather than silently falling back to demo inventory. `?demo=1` forces the local demo adapter for review.

## Booking handoff

For production, `POST {VENUE_API_BASE_URL}/enquiries` receives `{ venueId, sport, preferredDate, preferredTime, durationMinutes, clientRequestId }` and returns an opaque `reference`. The backend must idempotently map `clientRequestId` to one enquiry. The browser caches the request ID per unchanged selection and reuses it for repeated taps. If the endpoint is unavailable, handoff still opens WhatsApp with venue context and clearly says tracking is unavailable. No customer phone number or personal details are placed in the public venue URL.

The WhatsApp provider webhook and backend booking worker are **integration points, not live features in this repository**. Activation requires provider credentials and webhook signature verification, existing availability/price/hold/booking API contracts, payment webhook credentials, a staff escalation path, and a venue-ID mapping approved by Sportozen operations.

## Required backend invariants

1. Resolve provider messages by enquiry reference and idempotently store message IDs.
2. Revalidate availability and calculate price server-side. Durations supported by the UI are 30 and 60 minutes; actual eligibility comes from inventory.
3. Create an atomic hold in the same inventory used by App and Vendor, with expiry and a unique slot constraint.
4. Send a payment link only for an active hold; verify payment through the provider webhook, idempotently.
5. Confirm a booking once, after verified payment. Recover paid-but-unconfirmed holds through a retry queue and staff alert.
6. Explain unavailable slots, hold expiry, payment failure, cancellation terms, and human assistance in the conversation.
7. If live availability is unreliable, route the enquiry to staff and never promise an instant reservation.

## Scaling

The HTTP adapter can paginate and filter server-side for 400+ venues. The browser clusters nearby map points and caps the initial list view at ten cards, with more results on demand. City metadata and venue IDs are separate, so additional cities can be added without changing booking logic. Map tile and venue APIs should have their own caching and monitoring policies.
