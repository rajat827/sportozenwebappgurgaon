# Sportozen · Play Gurugram

Mobile-first venue discovery and WhatsApp enquiry app. The production venue, availability, payment, and WhatsApp bot integrations are pending access to Sportozen's existing cloud services. See [ARCHITECTURE.md](ARCHITECTURE.md).

The map has search by sport, venue, or area, plus sport filters. Venue cards show all listed sports and display ratings or offers only when the venue API supplies verified values. Pickup games show upcoming start times and player spots left when a live game feed is connected; the demo does not invent games or player counts.

## Run

Run `node server.mjs`, then open `http://127.0.0.1:4173`. No build step or npm dependencies are required. The server is for local preview only.

Edit `config.js` to set `VENUE_API_BASE_URL` and the central WhatsApp number. With no API configured, the app displays explicitly labeled demo venue records. Demo mode can also be forced with `?demo=1`.

## Next integration work

Connect the existing venue API to the documented contract; map real Sportozen venue IDs; implement the idempotent enquiry endpoint in the existing cloud; then connect the official WhatsApp provider, shared inventory holds, payment verification, and Admin/Vendor visibility. The current WhatsApp link starts an enquiry only—it cannot confirm a booking or take payment.

Venue demo information is drawn from linked public venue listings and OpenStreetMap in the earlier Sportozen Gurgaon prototype. It is for design review, not a live inventory feed. OpenStreetMap attribution and license: https://www.openstreetmap.org/copyright.

Run `node integration/simulator.mjs` to exercise a local, fake WhatsApp conversation and payment event. Run `node --test integration/workflow.test.mjs` for the idempotency check. The simulator sends nothing externally and never reads real inventory.
