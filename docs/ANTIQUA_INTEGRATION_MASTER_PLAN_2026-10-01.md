# Antiqua — Artwork-First Integration Master Plan

**Status:** ACTIVE — PRODUCT SCOPE RESET / v0.43 planning  
**Date:** 2026-10-06  
**Canonical file:** `docs/ANTIQUA_INTEGRATION_MASTER_PLAN_2026-10-01.md`  
**Reference main state before this reset:** `446f9521b568f9a849c3212a677bbbcd9ee11a74` — v0.42 Cultural Calendar

## 1. Product decision

ANTIQUA is a focused platform for **paintings and works on paper**, not a universal antiques / collectible-object marketplace.

The product should become unusually strong at four things:

1. seeing a work properly;
2. understanding the work, artist and context;
3. building trusted personal / public collections and expert knowledge around it;
4. enabling an inquiry, viewing, private sale or auction only when the work actually has a commercial state.

### Public promise

**Discover art -> understand it -> save and collect -> connect with people around it -> attend -> acquire when relevant.**

### Primary public journey

`Home / Gallery -> Artwork -> Artist -> Related works -> Research / provenance -> Save -> Collection -> Community / Event -> Inquiry / Bid`

Commerce is progressive disclosure. The Gallery must never imply that every work is for sale.

---

## 2. Active artwork taxonomy

Public catalogue and recommendations prioritize only:

- painting;
- drawing;
- graphics;
- engraving;
- etching;
- lithography;
- woodcut;
- linocut;
- screenprint and other artist prints;
- watercolor;
- gouache;
- pastel;
- mixed-media works on paper where the work is still primarily two-dimensional fine art.

Photography, sculpture, decorative art, furniture, jewellery, watches, coins, militaria, books-as-collectibles and generic antiques do **not** define the active product.

Existing legacy records do not need destructive deletion. They may remain technically stored, but they must not shape the public navigation, seed content, recommendations or investor demo.

---

## 3. Primary audiences

### Collector / art lover
Discover, research, save, compare, build collections, follow artists and specialists, plan exhibitions, request viewings and transact when relevant.

### Artist
Maintain a reviewed professional profile, connect works to exhibitions and publications, show available works when appropriate and participate in the professional community.

### Gallery / dealer
Maintain a verified profile and inventory, publish or propose works, answer inquiries, manage viewings, offers and auction participation.

### Expert / historian / curator
Add reviewed context, provenance evidence, catalogue notes, exhibition history, bibliography, annotations and expert commentary without becoming an untraceable parallel authority.

### Auction / institutional partner
Publish reviewed lots or exhibition/event references through bounded professional workflows.

---

## 4. Public information architecture

Keep the top-level product compact:

1. **Gallery** — image-first discovery.
2. **Artists** — artist pages and related works.
3. **Community** — art-specific professional and collector network.
4. **Collections** — saved/private/curated collections.
5. **Research** — editorial essays, provenance context, exhibition history, bibliography and scholarly notes.
6. **Events** — exhibitions, previews, lectures and art events.
7. **Auction** — only works with an actual auction state.
8. **My ANTIQUA** — saves, collections, follows, plans, inquiries, offers and bids.

### What changes from the previous concept

- **Books and Courses stop being independent product pillars.** A book, catalogue, article, lecture or course may appear only as a research/reference/event relation to an artist, work, movement or exhibition.
- **Dealer/pilot/evidence governance remains backstage.** It is important infrastructure, not consumer navigation.
- **Generic “objects / antiques / collectibles” language is removed from the public promise.**
- **Community is retained**, but it must be art-specific rather than a generic social feed.

---

## 5. Core domain model

### Artwork
The central public entity.

Required public facts:
- title;
- artist / attribution state;
- date / date range;
- medium / technique;
- support;
- dimensions;
- inscriptions / signatures / marks;
- edition where relevant;
- current location visibility state;
- high-resolution media;
- exhibition history;
- literature / catalogue references;
- provenance summary;
- condition summary;
- publication/review state;
- commercial state: none / inquiry / private sale / auction / historical result.

### Artist
- reviewed identity;
- dates / geography;
- biography;
- movements / schools;
- works;
- exhibitions;
- bibliography / catalogue references;
- related artists;
- professional representation where verified.

### Provenance / Research evidence
Every substantive claim should be traceable to a source, reviewer and status. Competing or disputed claims must be representable.

### Collection
A collection is not merely a wishlist. Support:
- private personal collections;
- curated thematic collections;
- public institutional / editorial collections;
- save/favorite state separately from collection membership.

### Art Network
Profiles and relationships for artists, galleries, experts, historians, curators, collectors and institutions. Network actions should resolve back to art: a work, artist, collection, exhibition or research topic.

### Event / Exhibition
v0.42 Cultural Calendar remains relevant because exhibitions and viewings are part of the art journey. Generic city/event functionality must not expand beyond art.

### Commercial state
Reuse existing inquiry, offer/counteroffer, condition report, viewing and auction authorities. Do not create a second commerce stack.

---

## 6. Keep now

These capabilities directly improve the painting / works-on-paper product and remain in the active roadmap:

- high-resolution artwork media;
- IIIF manifest/viewing pattern;
- zoom and comparison;
- region annotation for signatures, labels, condition and details;
- provenance graph with evidence and uncertainty;
- authority reconciliation for artists, places, techniques and institutions;
- OCR only as a candidate observation for labels/inscriptions/documents;
- visual similarity for related works, duplicate/reappearance detection and discovery;
- artist / creator graph;
- related works;
- collections;
- art-specific community;
- exhibitions and Cultural Calendar;
- condition report and viewing request;
- inquiry and offer negotiation;
- auction state and historical results;
- privacy controls for private collections, locations and unpublished works.

---

## 7. Remove from the active concept

The following must not consume current product or investor-demo capacity:

- universal antiques marketplace positioning;
- non-art collectible categories as public discovery pillars;
- standalone book marketplace;
- standalone course marketplace;
- generic lifestyle events;
- generic social feed detached from artworks/artists;
- 3D-first presentation of paintings;
- photogrammetry as a near-term requirement;
- glTF pipeline as an MVP requirement;
- transferable verifiable-credential passport as an MVP requirement;
- speculative blockchain-style ownership concepts;
- enterprise workflow surfaces in the primary consumer navigation;
- transaction/settlement complexity presented before a real provider contour is verified.

Existing code can remain where removing it would create unnecessary regression risk, but it should be hidden, deprioritized or marked deferred rather than promoted as product scope.

---

## 8. Deferred research backlog

Potentially useful later, but not active MVP work:

- C2PA ingestion;
- Linked Art / RDF public export;
- OCFL-style preservation packaging;
- external research APIs beyond the minimum required authority reconciliation;
- transferable credentials;
- 3D / photogrammetry / glTF;
- advanced institutional interoperability;
- large-scale automated semantic enrichment.

Reopen a deferred item only when it materially improves one of:
1. artwork understanding;
2. artwork trust/research;
3. collection value;
4. art-community collaboration;
5. commercial conversion for eligible works.

---

## 9. v0.43 — Focused Gallery & Artwork Dossier

This is the next product wave.

### 9.1 Public language cleanup
Replace visible generic terms:
- object -> artwork / work;
- maker -> artist where semantically correct;
- object passport -> artwork dossier;
- culture of things -> art / provenance / collecting.

Internal identifiers may remain for compatibility.

### 9.2 Catalogue scope guard
Add an explicit public artwork allow-list. Legacy non-art records should not enter:
- Gallery;
- recommendations;
- related works;
- investor-demo seed data;
- public search facets.

### 9.3 Gallery
Gallery must be:
- image-first;
- quiet;
- fast on iPhone, tablet and desktop;
- filterable by artist, period, medium/technique, support, dimensions, availability and provenance/review state;
- free from dealer-operations UI.

### 9.4 Artwork Dossier
The artwork page becomes the strongest surface in the product:

**Image -> essential facts -> artist -> why this work matters -> provenance -> exhibition history -> literature -> condition -> expert notes -> related works -> collection/save -> commercial state if any.**

Research depth stays progressive; first screen remains visual.

### 9.5 Artist page
Prioritize:
- portrait or archival image only when rights/quality are acceptable;
- biography;
- timeline;
- movements / schools;
- works in Antiqua;
- exhibitions;
- references;
- related artists;
- follow/save.

### 9.6 Community
No generic posting race.

Useful actions:
- follow artist / gallery / expert / collector;
- ask a question on an artwork or research topic;
- publish reviewed note;
- contribute provenance lead;
- connect a work to an exhibition/publication;
- invite to viewing/event;
- create or follow a curated collection.

### 9.7 Events
Keep exhibitions, private views, auctions, talks and specialist events that have a direct art relation. Do not turn Antiqua into a general city guide.

---

## 10. Research and trust rules

1. Similarity is not attribution.
2. OCR is not authentication.
3. A valid digital signature on a document proves document-integrity properties under the configured trust policy; it does not prove the artwork is authentic.
4. Provenance claims must preserve source, reviewer, status and uncertainty.
5. Private owner/location information is private by default.
6. Publication review and authentication must not be conflated.
7. Original media must not be overwritten.

---

## 11. Commercial boundary

A work can be:

- research/discovery only;
- in a private or public collection;
- in an exhibition;
- available for inquiry;
- available for private sale;
- scheduled/live/closed auction lot;
- linked to a historical auction result.

The commercial CTA appears only when supported by an actual commercial state.

Existing v0.21-v0.23 inquiry / offer / condition / viewing workflows are still valuable because they map naturally to art dealing. They remain secondary to the artwork dossier rather than defining the home experience.

---

## 12. Infrastructure boundary

The dedicated Antiqua PostgreSQL/Supabase contour and the existing governance work remain valid foundations.

This scope reset **does not claim** that live-production gates are complete. Before representing the product as production-ready for real transactions, independently verify:

- exact deployed commit;
- `persistence=POSTGRES`;
- restart durability;
- production identity/security settings;
- real provider/payment/settlement integrations where used;
- real counterparty acceptance and operational evidence.

Do not reuse another project's database.

---

## 13. MVP success metrics

Primary:
- artwork opens / session;
- artwork -> artist continuation;
- artwork -> related-work continuation;
- save rate;
- collection add/create rate;
- follow rate;
- research-depth engagement;
- D7 / D30 authenticated return;
- event save/plan rate;
- inquiry/viewing/offer/bid conversion only for eligible works.

Do not blend dealer-pilot operational KPIs into consumer engagement metrics.

---

## 14. v0.43 acceptance gate

v0.43 is complete only when:

- public positioning says paintings / works on paper rather than antiques / collectibles;
- visible shell no longer says “culture of things”;
- research replaces Books/Courses as the public knowledge pillar;
- Gallery seed content is art-only;
- non-art categories cannot surface through normal public Gallery/search;
- Artwork Dossier uses artwork-specific language;
- artist, collection, community and event links resolve correctly;
- commercial CTA is absent when no commercial state exists;
- iPhone, tablet and desktop smoke paths remain usable;
- existing v0.41 Art Network and v0.42 Cultural Calendar routes still work.

## 16. Protected institutional moat — after consumer v0.43

The following capabilities remain strategically valuable but are **not** active v0.43 surface work. They reopen only after the artwork-first public product and provenance/research authority are stable.

### Catalogue Raisonne / Canonical Work Registry — KEEP, DEFER UI EXPANSION

Maintain a scholarly work identity separate from listings:

- canonical work ID and revision;
- nuanced attribution state;
- medium/support/dimensions/marks;
- edition/state/variant for prints;
- provenance;
- exhibition history;
- bibliography;
- related works;
- expert/committee review history.

A listing can reference a canonical work but never becomes the scholarly authority.

### Institutional Research & Provenance API — KEEP, DEFER

Future controlled access may expose approved:

- canonical work records;
- provenance events with source/status;
- artist/authority mappings;
- exhibition and bibliography references;
- IIIF / Linked Art projections;
- reviewed attribution state.

Private owner, location, insurance and dealer facts remain excluded unless explicitly authorised.

### Provenance Evidence Passport / Scholarly Trust Graph — KEEP, DEFER

A future evidence package may project:

- canonical work revision;
- attribution state;
- provenance events and evidence classes;
- unresolved gaps and competing claims;
- exhibition/bibliography references;
- approved image/document evidence;
- contributor/committee activity.

This is a scholarly evidence package, **not** an authenticity certificate and not a blockchain ownership product.

### Reopening gate

These institutional capabilities may move from backlog into implementation only when:

1. Gallery and Artwork Dossier are stable;
2. public provenance/research UX is stable;
3. artwork identity is separate from sale/listing identity;
4. expert decisions have explicit authority and revision history;
5. privacy traversal tests pass;
6. a real museum, estate, foundation, scholar or insurer use case exists.

This keeps the defensibility upside without allowing enterprise infrastructure to dilute the collector-facing product.


## 17. Commercial architecture for investor MVP

ANTIQUA should not be presented as a single-revenue marketplace. The investor MVP must show a portfolio of revenue motions with explicit evidence gates.

### Revenue motion A — Professional SaaS

**Buyer:** galleries, estates and professional sellers.  
**Value:** artwork/artist records, private or partner editions, lead workflow, viewing/offer pipeline, analytics and professional workspace.

Formula:

`Professional SaaS revenue = active paid professional accounts × validated monthly price`

Do not publish a price as fact before at least one real paid pilot confirms willingness-to-pay.

Evidence required:
- signed paid pilot or contract;
- paid activation;
- month-2 / month-3 retention;
- cost-to-serve;
- support load;
- renewal intent.

### Revenue motion B — Partner Editions / Event infrastructure

**Buyer:** fairs, auctions, associations, cultural programmes and event owners.

Formula:

`Partner revenue = paid editions × edition fee + onboarding/support`

Value:
- digital artwork layer before/during/after the event;
- QR/deep-link continuation;
- measurable artwork engagement;
- D7/D30 after-event retention;
- qualified professional leads.

Evidence required:
- one real bounded event pilot;
- fee actually accepted;
- measurable post-event continuation;
- repeat or renewal intent.

### Revenue motion C — Eligible transaction revenue

This is conditional revenue, not the public product identity.

Formula:

`Transaction revenue = eligible completed GMV × validated take rate`

Gate:
- legal/jurisdiction review;
- KYC/KYB where required;
- real payment / settlement provider;
- cancellation/refund/dispute policy;
- title/ownership and payout rules;
- real completed transaction evidence.

Do not include research-only, exhibition-only or collection-only works in GMV.

### Revenue motion D — Cultural partnerships

**Buyer:** banks, insurers, brands, developers and other strategic partners.

Formula:

`Partnership revenue = approved activations × project / sponsorship fee`

The partner receives cultural integration and aggregated evidence, not private collector negotiation data.

### Revenue motion E — Institutional Research / Provenance

**Buyer:** museums, foundations, estates, insurers and research teams.

Potential structure:
- institutional licence;
- project fee;
- Research / Provenance API access;
- integration / mapping services.

This remains **LATER** until a real institutional design partner exists.

### Consumer monetization boundary

Core discovery, artwork understanding and basic collection/follow behavior should not be prematurely paywalled.

A later premium collector layer may include:
- advanced private collection tools;
- enhanced alerts;
- research workspace;
- export / insurance-ready documentation;
- private sharing / viewing packs.

It must be added only after retention and willingness-to-pay are demonstrated.

### Investor KPI hierarchy

Product engagement:
- artwork opens / session;
- artwork -> artist continuation;
- research depth;
- saves;
- collection adds;
- follows;
- D7/D30 return.

Professional value:
- qualified lead rate;
- response SLA;
- viewing rate;
- offer rate;
- conversion;
- D30 demand retention.

Commercial proof:
- paid pilot conversion;
- paid retention;
- recurring revenue share;
- cost-to-serve;
- partner CAC;
- CAC payback;
- eligible GMV;
- effective take rate;
- gross margin.

No CAC, LTV, ARR, GMV or payback metric may be shown as fact without source data.

### Participant value map

- **Collector:** better discovery, trust, continuity and optional commerce.
- **Artist / estate:** persistent reviewed history, works, exhibitions and representation.
- **Gallery:** recurring professional workflow and measurable demand.
- **Expert / historian / curator:** attributable reviewed contribution and citation trail.
- **Institution:** controlled canonical research/provenance infrastructure.
- **Fair / auction / event:** measurable digital continuation and partner acquisition.
- **Strategic partner:** privacy-safe cultural activation and measurable engagement.
- **Investor:** exposure to recurring B2B, partner-led acquisition, conditional transaction upside and a compounding scholarly/data moat.

### Compounding moat hypothesis

The moat is not “more listings”.

It is the compound graph:

`Artwork identity + Artist graph + Provenance evidence + Research revisions + Demand signals + Professional workflows + Event continuity`

The hypothesis to validate is that every new verified artwork and professional participant improves multiple surfaces at once:
- discovery;
- trust;
- research depth;
- partner value;
- retention;
- commercial conversion.

Only measured evidence should be used to claim that this flywheel is working.


## 18. Commercial validation artifacts

The following files are now part of the canonical commercialization path:

- `docs/ANTIQUA_PAID_PILOT_PACKAGE_v1.md` — bounded paid pilot design and evidence gate;
- `docs/ANTIQUA_PRICING_EVIDENCE_MODEL_v1.md` — willingness-to-pay evidence ladder and pricing confidence;
- `docs/ANTIQUA_INVESTOR_TRACTION_DASHBOARD_SPEC_v1.md` — source-labelled traction, pricing, retention and unit-economics dashboard specification.

These artifacts are intentionally evidence-first. They must not be populated with invented ARR, GMV, CAC, LTV, pricing or retention.

## 19. v0.44 — Shared Intelligence Authority

v0.44 introduces no new source of truth. It projects existing authorities into three role-safe decision layers:

- **Collector Intelligence** — explainable taste directions and adjacent discovery inside My ANTIQUA;
- **Professional Intelligence** — artwork/artist demand depth and response evidence inside the dealer workspace;
- **Market & Scholarly Intelligence** — research coverage, attribution links, revisions, open gaps and platform comparables inside Artwork Dossier.

Canonical specification:
- `docs/ANTIQUA_INTELLIGENCE_V44.md`

Non-negotiable boundaries:
- no opaque score;
- no purchase probability inferred from passive behavior;
- no seller access to personal collector taste;
- no authenticity score;
- no automated appraisal;
- no causal attribution where only temporal/object-level evidence exists;
- no private owner/location leakage.

### v0.44 investor value

This is the first layer where the same underlying artwork graph demonstrably serves three paying or value-creating constituencies without cloning data models.

The strategic asset is therefore not a recommendation widget. It is a shared decision graph:

`Artwork facts -> collector relevance / professional demand / scholarly-market context`

The economic hypothesis to validate is that this shared graph improves:
- collector retention;
- gallery conversion and selection;
- partner renewal;
- institutional reuse.

Only measured evidence may turn that hypothesis into a moat claim.

## 20. v0.45 — Decision Intelligence

v0.45 turns the shared intelligence layer into concrete decision support without introducing hidden scoring:

- Collection Strategy for collectors;
- Portfolio Intelligence for galleries;
- Evidence Coverage Map for Artwork Dossier.

Canonical specification:
- `docs/ANTIQUA_DECISION_INTELLIGENCE_V45.md`

The three outputs remain descriptive. They do not become investment advice, demand forecasting, authenticity scoring or appraisal.

## 21. v0.46 — Commercial Evidence Authority

v0.46 closes the first real business-model evidence loop:

`real pilot -> quote -> written acceptance -> invoice -> payment -> direct cost -> gross contribution -> renewal / expansion`

Canonical specification:
- `docs/ANTIQUA_COMMERCIAL_EVIDENCE_V46.md`

Core rules:

- commercial writes are operator-controlled;
- seller access is read-only for its own pilot;
- durable PostgreSQL is required for writes;
- events are append-only and signed;
- quote / LOI / written acceptance are not revenue;
- invoice is not cash;
- only `PAYMENT_RECEIVED` creates verified cash;
- refunds and direct pilot costs reduce gross contribution;
- renewal / expansion increase evidence maturity but are not automatically cash;
- idempotency replay with the same body returns the existing event;
- reuse of an idempotency key with a different body returns `409 IDEMPOTENCY_CONFLICT`;
- correction uses an explicit void event rather than rewriting history;
- investor aggregate never performs implicit cross-currency conversion.

Commercial Evidence is the authority that may populate the cash/pricing/gross-contribution cells of the Investor Traction Dashboard. No manual dashboard override is allowed.

## 22. Next implementation order

1. finish CI + Browser E2E on the current artwork-first/intelligence/commercial-evidence head and merge only on green;
2. expose an operator Commercial Evidence Console over v0.46 with CSRF, audit and evidence-reference requirements;
3. run one real Gallery Growth pilot through frozen scope -> launch -> commercial ledger -> final acceptance;
4. replace Investor Traction Dashboard MISSING cells only from v0.46 and pilot authorities;
5. instrument D7/D30 consumer retention and paid-partner renewal cohorts;
6. record direct onboarding/support/provider cost per paid pilot and validate gross contribution;
7. validate one Partner Edition end-to-end with actual accepted fee;
8. calculate pricing-confidence distribution across independent paid counterparties;
9. add canonical artwork identity / institutional research only after a real institutional design partner exists;
10. expose finance-ready ARR / CAC / payback / eligible GMV / gross-margin views only when their source authorities exist.

Anything outside this order must justify itself against the artwork-first product thesis.

## Institutional adoption wave — Federated Art Research and Provenance Infrastructure

This wave turns Antiqua's provenance passport, catalogue-raisonné structures and scholarly trust graph into infrastructure that museums, archives, artist estates, galleries, scholars and collections can contribute to and verify.

### Antiqua Research Interchange Profile — ADOPT

Define a versioned implementation-neutral profile for exchange of:

- canonical work identity;
- artist/attribution state;
- provenance event;
- source/evidence class;
- exhibition/bibliography reference;
- institutional identifier;
- media/IIIF reference;
- rights/publication state;
- revision/supersession state;
- unresolved conflict/gap.

The profile must preserve uncertainty rather than flattening scholarly disagreement.

### Synthetic Reference Catalogue — ADOPT

Publish a synthetic/public-domain reference implementation demonstrating:

`work -> artist -> provenance event -> source -> exhibition -> bibliography -> review -> revision -> provenance passport`

No private owner/dealer identity is included.

### Institutional Contributor Programme — ADOPT

Create explicit contribution roles for:

- museum;
- archive;
- artist estate/foundation;
- catalogue-raisonné committee;
- university/research institute;
- gallery/dealer;
- auction/archive source partner.

Each contribution keeps institution, contributor, source class, licence/rights and review state.

### Federated Publishing — ADOPT

Approved institutions may publish or synchronize scoped records:

- institutional object ID;
- exhibition;
- bibliography;
- public provenance event;
- archival document reference;
- image/IIIF manifest;
- attribution/review update.

External publication enters Antiqua as source-attributed evidence, not unquestioned canonical truth.

### Cross-institution Identity Resolution — ADOPT

Maintain reviewed mappings between:

- Antiqua work ID;
- museum/accession ID;
- artist authority ID;
- catalogue-raisonné ID;
- archive record;
- auction/dealer record.

Conflicts remain explicit and reversible.

### Research Consortium Workspace — CONDITIONAL

Support bounded consortium projects around:

- an artist;
- collection;
- provenance period;
- exhibition history;
- displaced/lost art research;
- catalogue-raisonné initiative.

Consortium membership does not grant unilateral authority over the canonical work record.

### Institutional API / Data Licensing — ADOPT

Potential products:

- Research API;
- Provenance Verification API;
- IIIF/Linked Art feed;
- change feed;
- catalogue-raisonné workspace;
- institution/private-collection research workspace;
- licensed evidence dataset.

### Legitimate Switching Cost — ADOPT

Compounding value:

- reviewed identity mappings;
- provenance-event graph;
- revision history;
- source/evidence lineage;
- institutional contributions;
- scholarly review decisions;
- image/document links;
- cross-collection relationships.

Export and citation remain first-class; lock-in comes from the compound research graph, not blocked data access.

### Additional acceptance

- institutional contribution never overwrites conflicting scholarship silently;
- every assertion preserves source and status;
- private owner/dealer data remains segregated;
- rights for metadata and media remain independent;
- identity mappings are reviewable and reversible;
- public APIs distinguish canonical, contested and unverified assertions.

**Sequencing:** Provenance Passport -> interchange profile -> reference catalogue -> institutional contributors -> federated publishing -> identity resolution -> consortium/API licensing.

**Moat:** Antiqua becomes shared provenance/research infrastructure whose value increases with every institutionally sourced and scholarly reviewed relationship.
