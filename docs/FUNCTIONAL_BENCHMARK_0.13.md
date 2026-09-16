# ANTIQUA — Global Functional Benchmark & Product Matrix (0.13)

Updated: 2026-09-16

## Product thesis
ANTIQUA should not be a clone of an auction house or antiques marketplace. It combines five systems around one permanent object passport:

1. Research dossier / object passport.
2. Collector collection-management workspace.
3. Dealer marketplace and private negotiation.
4. Auction-house transaction engine.
5. Collection graph, virtual reunification and online exhibitions.

Core lifecycle: **discover → study → compare → acquire/win → document → collect → exhibit → reunite → lend/insure/restore → resell**.

## Market patterns to absorb

### Auction-house standard
From current public Sotheby's / Christie's / Phillips / Bonhams practices and help flows:
- sale registration and bidder eligibility;
- absentee / maximum bidding;
- live/timed auction state;
- condition reports separated from marketing copy;
- provenance, literature and exhibition history;
- specialist contact / estimate request;
- invoices and post-sale fulfilment;
- shipping / collection instructions;
- watchlists and reminders;
- transparent buyer fees and sale terms before bidding.

### Dealer marketplace standard
From 1stDibs and comparable dealer-marketplace flows:
- verified dealer storefront;
- fixed-price purchase;
- make-offer / counteroffer lifecycle;
- item-level seller contact;
- shipping quote before checkout where needed;
- saved objects / dealer follows;
- buyer-protection and issue workflow;
- order lifecycle distinct from listing lifecycle.

### Curated marketplace / expert-review standard
From Catawiki and comparable expert-reviewed marketplace flows:
- specialist review before auction admission;
- structured object submission requirements;
- seller / buyer verification gates;
- automatic bidding;
- payment held until transaction milestones where legally appropriate;
- shipment tracking and dispute evidence.

### Collector management standard
From Artlogic / Artsy-like collector workflows:
- private inventory independent of sale status;
- acquisition information;
- location and movement history;
- provenance;
- condition / restoration history;
- valuations and insurance values;
- documents;
- private presentation / viewing room;
- shared or delegated access;
- saved market objects and market intelligence.

### Interoperability standard
- IIIF Presentation API for image/object manifests.
- Linked Art / JSON-LD compatible cultural-heritage graph.
- Persistent internal object IDs independent of sale listing or auction lot.

## ANTIQUA mandatory capability families

### A. Object Passport
- Permanent object ID.
- Multilingual cataloguing.
- Maker / workshop / attribution / dating.
- Category, period, country, materials, technique, dimensions, marks.
- Condition grade + full condition report.
- Restoration map linked to photographs.
- Provenance timeline with evidence states.
- Literature / exhibitions.
- External identifiers and museum catalogue links.
- Ownership claim vs verified ownership kept distinct.
- Export/cultural-property screening state.
- Media roles: hero, overall views, marks, underside/reverse, damage, restoration, documents.
- Evidence graph with source and review state.
- Passport version history / amendments.
- IIIF / Linked Art export.

### B. Search & Discovery
- Full-text search.
- Facets: category, maker, period, country, material, technique, dimensions, condition, price, location, seller, purchase method, availability, auction ending.
- Saved searches.
- Follow maker / category / dealer.
- Wanted list.
- Recently viewed.
- Similar objects.
- Compare 2–4 objects side-by-side.
- Sold archive / realized-price semantics separated from asking/current/hammer/all-in.

### C. Collector Workspace
- Personal collection, private by default.
- Nested collections / folders / tags.
- Acquisition date, purchase price, current valuation, insurance value.
- Documents and receipts.
- Location / storage / movement log.
- Condition and restoration events.
- Loans and exhibitions.
- Delegated family/advisor access.
- Succession / emergency access plan.
- Private sharing link / QR / printable catalogue.
- Exhibition builder.
- Collection completeness and missing-item tracking.

### D. Collection Graph / Virtual Reunification
- Ensemble/set definition.
- Expected slots / known components.
- VERIFIED / CANDIDATE / KNOWN_PRIVATE / INSTITUTIONAL / MISSING / UNKNOWN_LOCATION.
- Owner privacy independent from object visibility.
- Evidence behind relationship claims.
- Distributed-owner consent.
- Completeness percentage.
- Virtual reconstruction / map.
- Claims workflow for unknown components.
- Research curator moderation.

### E. Dealer / Seller Workspace
- Organisation profile + members/roles.
- KYB state.
- Inventory independent from listing state.
- Object-passport creation workflow.
- Media and evidence checklist.
- Catalogue review / changes requested / approval.
- Choice of route: store / make offer / private sale / timed auction / future live auction.
- Listing pricing, negotiability, shipping origin, tax fields.
- Offer inbox and counters.
- Orders and fulfilment.
- Analytics: views, saves, inquiries, conversion, offer acceptance.
- Payout state and reconciliation.

### F. Auctions
- Server time only.
- Registration / eligibility gates.
- Hidden proxy maximum.
- Deterministic tie rule.
- Transactional serialization per lot.
- Mandatory idempotency.
- Anti-sniping rule.
- Immutable accepted bid events.
- Reserve logic.
- Bidder masking.
- Outbid / ending / won notifications.
- Auction close → winner → order atomically.
- Non-payment workflow that does not silently obligate prior bidder.
- Admin halt / amendment / relist with audit trail.
- Live-video layer must remain separate from bid acceptance authority.

### G. Commerce / Private Sales
- Buy now.
- Make offer / counter / accept / decline / withdraw / expiry.
- Private sale invitation.
- Item-level conversation.
- Total-cost estimate: item, buyer premium if any, tax, shipping, duties disclaimer.
- Order state machine.
- Invoice.
- Payment intent.
- Release approval.
- Insured shipment / collection.
- Delivery proof.
- Ownership-transfer event.

### H. Payments / Ledger
- Provider-neutral payment adapter.
- Double-entry internal ledger.
- Separate charge / refund / partial refund / payout / fee / tax / shipping entries.
- Payout holds.
- Chargeback representation.
- Reconciliation runs and exceptions.
- Seller statements.
- Do not call funds 'escrow' unless the legal/payment setup is actually escrow.

### I. Trust / Compliance
- KYC person.
- KYB dealer/company.
- Authority to sell.
- Sanctions / PEP / risk adapter where applicable.
- Stolen-object / cultural-property workflow.
- Export/import flags.
- Country × seller × buyer × category × payment rule matrix.
- Catalogue approval independent of authentication guarantee.
- Evidence-based authenticity workflow; AI can assist but never make final authentication decision.

### J. Fulfilment & Disputes
- Package dimensions / weight / crate needs.
- Shipping quote.
- Insured value.
- Packing photographs.
- Tracking.
- Pickup appointment.
- Delivery / collection proof.
- Dispute classes: non-receipt, damage, mismatch, completeness, authenticity concern.
- Evidence upload, deadlines, operator review, refund outcome.

### K. Notifications & Communication
- In-app activity feed.
- Email/push adapter later.
- Saved-search alerts.
- Watchlist auction reminders.
- Outbid / leading / won.
- Offer / counter / expiry.
- Order payment / shipping / delivery.
- Catalogue review requests.
- Seller inquiries.
- Idempotent notification generation.

## ANTIQUA differentiation
1. Permanent object passport survives every sale/listing/auction.
2. Collection utility is valuable even when the owner never sells.
3. Distributed-collection graph can digitally reunite separated sets.
4. Owner identity / object visibility / commercial availability are three independent dimensions.
5. Provenance and condition are event histories, not static text boxes.
6. Exhibition layer works over private/public passports with explicit owner consent.
7. Research evidence states are visible and auditable rather than collapsed into a generic 'verified' badge.
8. IIIF / Linked Art interoperability prevents ANTIQUA becoming a closed data silo.

## Current priorities after 0.13
P0: dedicated PostgreSQL + object storage + restart persistence + backup/restore + row-lock concurrency proof.
P0: external KYC/KYB provider.
P0: PSP + ledger/reconciliation/payout implementation.
P1: saved searches/follows/wanted list; conversations; shipping/disputes; dealer analytics.
P1: nested collection folders; acquisition/insurance/restoration/movement data.
P1: auction settlement and non-payment lifecycle.
P2: similarity / OCR / translation / cataloguing assistance; never final authentication.
