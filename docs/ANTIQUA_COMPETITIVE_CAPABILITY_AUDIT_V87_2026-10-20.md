# ANTIQUA — verified competitive capabilities and delivery decisions (v87)

**Audit date:** 20 October 2026. **Scope:** paintings and painterly media only, including professional research and transactions. **Evidence standard:** publicly documented provider functionality, not access-controlled account QA. No claims of exhaustive parity, exclusive novelty, production deployment, legal rights clearance or quantified business uplift without independent proof.

**Release stack:** PR #148 (museum / private collection / independent publication review) → PR #149 (redacted Decision Dossier contract) → PR #150 (PostgreSQL-authorized read endpoint) → v87 collector-facing evidence checklist. All are draft/pre-release stacks unless separately merged and proven live. The Render main deployed version is older. The connected Supabase organization does not currently expose the original dedicated Antiqua database.

## 1. Competitive evidence register

| Provider / market | Publicly documented capabilities | Source / observed date | Adopt / improve |
|---|---|---|---|
| Artsy, global | Saved artworks, artist follows, alerts by artist/medium/price, private collection, gallery offers; September 2026 partner CMS surfaces saves and abandoned orders | [Artsy buyer guidance](https://support.artsy.net/s/article/4-Ways-to-get-Personalized-Artwork-Recommendations), [partner product update, 8 Sep 2026](https://partners.artsy.net/product-updates/new-signals-see-where-collector-interest-is-building) | Explainable tastes, availability alerts, consent-based seller leads; never reveal private saves by default |
| Artlogic, global | Inventory-based private views, expiring/login-gated sharing, configurable artwork disclosure, viewing rooms and mobile offline presentation; dynamic private views labeled beta | [Private Views, 12 Aug 2026](https://support.artlogic.net/hc/en-gb/articles/17337147499036-How-to-create-Private-Views), [Viewing Rooms](https://artlogic.net/websites/viewing-rooms), [dynamic beta](https://support.artlogic.net/hc/en-gb/articles/21575664444700-NEW-How-to-set-up-Dynamic-Private-Views-Beta) | Authenticated, identity-bound Private Rooms with per-document policy/revocation; improve on anonymous secret-link model; no Room before storage/P0 |
| Artnet, global | Specialist-reviewed auction-price database and market searches | [Official price database](https://www.artnet.com/price-database/) | Licensed/compliant comparable-sale ingestion, source lineage, hammer vs realized vs estimate and sale condition separation |
| MutualArt, global | Price database, artist market performance, alerts, similar work results, MyCollection, expert appraisals | [Official features](https://www.mutualart.com/about-us), [price database](https://www.mutualart.com/price-database), [FAQs](https://www.mutualart.com/faq) | Historical market context, expenses, inventory and opt-in alerts; never label algorithmic estimate as a signed appraisal |
| Christie's, global | Live, online, telephone and absentee participation; bidder identity checks; specialist assessment; condition reports; buyer cost calculator | [Bidding guide](https://www.christies.com/en/help/buying-guide/register-and-bid), [buying process](https://www.christies.com/en/help/buying-guide/overview) | Comprehensive bid lifecycle + condition-report request + total-cost disclosure; after legal/payment admission |
| Sotheby's, global | Auctions, buy-now, private sales, specialist-led confidential enquiries | [Buyer methods, updated Sep 2026](https://help.sothebys.com/en/support/solutions/articles/44002297457-how-can-i-buy-at-sotheby-s-), [private sales](https://help.sothebys.com/en/support/solutions/articles/44002297480-how-can-i-purchase-a-private-sales-item-) | Confidential seller-buyer conversation bound to one Artwork and existing inquiry/offer authority |
| Invaluable, global | Timed/live bidding, absentee maximums, outbid updates and buyer account approval | [Bidding FAQ](https://www.invaluable.com/inv/help/faq/bidding/), [how to bid](https://www.invaluable.com/inv/how-to-bid/) | Proxy-bid audit / consent / bid rules, then optional operator-conducted live-floor bridge |
| Литфонд, Russia | Online, telephone and absentee bidding alongside personal participation; pre-auction exhibitions and registered participation | [Auction rules](https://www.litfund.ru/auction/rules/), [how to buy](https://www.litfund.ru/how_buy/) | Pre-sale viewing/condition appointments, digital documentary trail, appropriately localized bidder permissions |
| VLADEY, Russia | Classical and curated auctions, live broadcast/online participation, special auction formats and pre-auction exhibitions | [How to buy](https://vladey.net/ru/buy), [terms](https://vladey.net/en/terms) | Painting-focused editorial auction releases; no unsupported category expansions |
| ARTinvestment.RU, Russia | Indexed auction sale history by artist, filters on artwork, date, size, house, price and flagged risk indicators | [Indexed database example](https://artinvestment.ru/auctions/185120/works.html) | Searchable sourced historical outcomes and risk explainability. Live private dashboard, full dataset/licensing and current account behavior not verified |

**Access boundary:** Claims describe vendors' published materials as of the audit. We did NOT sign in to vendor accounts, purchase subscriptions, test third-party APIs, or audit non-public workflows. Subscription features, rate limits and licensing must be individually checked before integration. Names/branding/layouts/source code must not be copied.

## 2. Implemented vs missing vs next-best feature matrix

Statuses: BASELINE_DRAFT means present in historical PR code, **not verified on production**; V87_CANDIDATE is this branch; GATED means not launched; NOT_VERIFIED means further technical audit needed.

| Capability | Antiqua implementation status | Decision | Acceptance and improvement |
|---|---|---|---|
| Editorial image-first painting discovery, artist, events, research | BASELINE_DRAFT | STRENGTHEN | Published approved images only; clear artist attribution uncertainty; phone 320 px supported |
| Saved objects, watch, collections, taste model | BASELINE_DRAFT | STRENGTHEN | Opt-in frequency preference and disclosure controls; consent before gallery outreach |
| Owner-private records, insurance and movements | BASELINE_DRAFT | STRENGTHEN | Owner-only database enforcement; private storage/valuation never in public projections |
| Public artwork provenance with disputed source states | BASELINE_DRAFT | STRENGTHEN | Show source class, gaps, disputes; hash released fields only; no fabricated certainty |
| Independent catalogue + image-rights publication | BASELINE_DRAFT | STRENGTHEN | Separate reviewers; identity/stage checks; rights documents verified by people |
| Decision Dossier public projection | DRAFT #149 / #150 | INTEGRATE | Provenance / market only after canonical PostgreSQL publication admission; READ ONLY |
| Eight-section collector evidence checklist | V87_CANDIDATE | BUILD | Identity, attribution, provenance, condition, scholarship, market, title and image rights; every unknown is explicit |
| Private viewing and selective sharing | GATED, epic already scoped | BUILD AFTER P0 | Identity-bound invite, section grants, NDA terms, revoke on every request and download; no anonymous token-only access |
| Dynamic/immutable shared revisions | GATED | BUILD | Snapshot versions, approval tokens, audit vs current read; prevent silently changing what buyer reviewed |
| Total ownership / landed cost of purchase | NOT_VERIFIED full lifecycle | BUILD | Premium, taxes, shipping, FX and insured transit show separate grounded amounts/estimates |
| Comprehensive auction history and comparables | PARTIAL baseline, no external licensed coverage | INTEGRATE LATER | Source/house/date/currency, estimate/hammer/realized; no conflating auction with payment |
| Price alerts / follow artist | BASELINE_DRAFT watch, full breadth NOT_VERIFIED | EXTEND | Explicit followed artist/category/source filters, deduplicated notice events, unsubscribe |
| Bidder registration/proxy bidding | BASELINE_DRAFT | TEST DEEPLY | Exactly-once idempotency, concurrent closes, reserve rules, roles and legal disclosures |
| Live hybrid in-person/telephone/online bidding | NOT SHIPPED | DEFER | Human auction operator arbitration, telephone consent, external-floor reconciliation |
| Condition/conservation specialist reports | PARTIAL | BUILD AFTER STORAGE | Date, author/scope, image coordinates, revisions, disputed findings; unsigned != verified |
| Market analytics dashboards | PARTIAL analytical modules | EXTEND | Valid comparables and cohorts, no fabricated current valuation or returns |
| CRM/partner engagement and sales | BASELINE_DRAFT dealer pilot | STRENGTHEN | Consent, owner-scope, meaningful qualified lead, audit and data minimization |
| Artwork displayed on a wall / AR | NOT VERIFIED | DEFER | Dimensions/reference calibration, permissioned media and phone usability |
| Digital material provenance / PDF signatures | PLANNED | DEFER AFTER P0 | C2PA and PDF signature verify documents/media only, not artwork authenticity |
| Secure media/documents / disaster recovery | P0 BLOCKED | PRIORITY 0 | Dedicated verified PostgreSQL, Storage, 001-034 lineage, restart, backup and restore, RLS, negative tests |
| Release portfolio screenshots / video | BASELINE_DRAFT CI capture | MAINTAIN | One precise SHA receipt, real CI app; distinguish mocked UI tests and live production; keep clips versioned |

## 3. Differentiation hypothesis, not proof of uniqueness

A stronger coherent user journey is:
Painting discovery → authoritative passport → redacted provenance and research → reasoned human-review checklist → permissioned private dossier → written expert clarification → authorized inquiry / offer / bid → transaction and post-sale archival evidence.

The product innovation hypothesis is **decision traceability and responsible uncertainty disclosure**, not an AI percentage claiming authenticity. Each step references canonical revisions and a server authorization boundary. No third-party app is assumed to lack such an ability: exclusivity has not been verified.

## 4. Phased delivery / testing order

**P0 — mandatory admission:** regain project/organization authorization to original Antiqua dedicated PostgreSQL (never use Marco or MFW), confirm migration hashes and grants, restore/restart and scoped document access, image rights and independent security review. No guest room or production features before P0.

**P1a — now, preview-only:** approve v86 endpoint review, build v87 checklist, test RU/EN and 320/1440 browsers, reject forged server payloads, verify immutable public digest, prove revocation and no private leaks. Instrument events by public object ID and non-sensitive stage only, after privacy review.

**P1b — post-P0 Private Rooms:** schema extension after v34; host/counterparty roles; identity-bound invitations with expiry; NDA consent revision; field-level document grants; secure download; revoke; expert Q&A; inquiry/offer reference. Required negative SQL, API, abuse, race, restart and restore tests.

**P2 — market decision support:** licensed price database connectors; normalization of currency/date, buyer premium and tax; artist comparables with source and methodology; conservative gaps. A “valuation” is only a human-authored signed estimate if professionally reviewed.

**P3 — differentiation:** mobile on-wall visualization, institution-grade preservation packages, semantic export / IIIF and creator ontology reconciliation. Every new subsystem derives from and points back to Antiqua authority, never replaces it.

## 5. Exact acceptance checklist

- Documented provider feature → sourced need → tagged status → acceptance test.
- Source authority and visibility enforced on the server, not hidden HTML.
- Every GET for review and download rejects deleted grants and revoked publication without leaking existence.
- Unknown data is “not verified / not assessed”, not zero or green.
- Preview branch tests real isolated PostgreSQL/Chromium; fixture renders are explicitly labelled mocked.
- Source image/legal title/financial values require separate human/document review.
- Merge only after tests on the exact final SHA, independent review and release HOLD removal; protected Render main unchanged meanwhile.
