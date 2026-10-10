# Antiqua — Integration Master Plan

**Status:** ACTIVE · PHASE 0 / RUNTIME BRIDGE  
**Date:** 2026-10-01  
**Canonical file:** `docs/ANTIQUA_INTEGRATION_MASTER_PLAN_2026-10-01.md`

## Purpose
Strengthen Antiqua after the real dealer-pilot foundation without creating a second evidence authority or bypassing v0.37-v0.40 governance.

## Current verified state — 2026-10-01

Completed and verified:
- dedicated Supabase project `antiqua-postgres` exists as the Antiqua-only durable database contour;
- migrations through v0.40 are present in the dedicated database, including counterparty acceptance, governance/verification and real-pilot launch authorities;
- Supabase backend security boundary migration is present as contour hardening;
- PR #60 adds explicit `ANTIQUA_EXTERNAL_MANAGED_SCHEMA=true` runtime mode so production DML can use an externally managed schema without creating a second schema authority;
- PR #60 CI is green at exact head `1807833b5c9b9043624159d644143f357aadb102`; Browser E2E remains the final merge gate at the time of this update;
- integration work items are tracked as #61–#70 and remain gated behind INT-00.

Still required before Phase 1:
1. configure the Supabase Session pooler `DATABASE_URL` directly in the Antiqua Render service environment;
2. set `PREVIEW_MODE=false` and `ANTIQUA_EXTERNAL_MANAGED_SCHEMA=true`;
3. deploy the exact merged head and prove `persistence=POSTGRES`;
4. prove restart durability against the dedicated Antiqua database;
5. create the first real engagement;
6. freeze inventory/KPI/baseline;
7. establish representatives and send real invitations;
8. obtain bilateral acceptance;
9. start W1 operating cadence.

The database password must not be committed to GitHub or copied into this document. MFW PostgreSQL, MFW services and MFW data are explicitly outside this architecture.

## Mandatory prerequisite
Before new product waves:
1. merge only after CI + Browser E2E are green;
2. connect Render only to Antiqua's **own dedicated durable PostgreSQL** using the Session pooler secret;
3. deploy with `PREVIEW_MODE=false` and `ANTIQUA_EXTERNAL_MANAGED_SCHEMA=true`;
4. prove `persistence=POSTGRES` and restart durability;
5. create first real engagement;
6. freeze inventory/KPI/baseline;
7. establish representatives;
8. send real invitations;
9. obtain bilateral acceptance;
10. start W1 cadence.

Do not reuse another project's DB.

## Product reset — Gallery-first Art Platform

**Decision — superseded on 2026-10-07:** Antiqua is now a paintings-only platform in its public and professional product. Supported painterly media are oil, acrylic, tempera, watercolor, gouache and pastel. Standalone drawing, printmaking, engraving, etching, lithography, sculpture, decorative art, furniture, ceramics, jewelry, clocks, manuscripts and generic antiques are out of scope. The existing Object Authority remains only as the internal technical identity for Artwork records; it is not a public product category.

### Public product promise
**Discover art → understand the work and artist → learn → save/collect → attend → bid/buy when relevant.**

Primary public journey:
`Home → Gallery → Artwork → Artist → Related Works → Save → Collection → Personalized Discovery`

Extended cultural journey:
`Artwork/Artist/Theme → Books → Courses → Events/Exhibitions → deeper discovery`

Commercial journey:
`Artwork → Auction lot → Watch → Bid → Result → Collection/ownership record`

### Public information architecture
1. **Gallery** — image-first discovery of paintings and painterly works only.
2. **Artists** — creator pages, periods, works, exhibitions, editorial context and related artists.
3. **Artworks** — high-quality media, object facts, provenance/research depth, related works and auction state where applicable.
4. **Collections** — saved works, personal/private collections, curated/public collections and collection records.
5. **Learn** — books about painting/artists/movements, courses/lectures and editorial material.
6. **Events** — exhibitions, lectures, courses, viewings and cultural events linked to artists/works/themes.
7. **Auction** — Antiqua's existing auction authority surfaced as a native art-market action, not a separate product.
8. **For professionals** — dealer/pilot/evidence tools remain available only as a secondary/backstage professional surface.

### Scope boundary
Current authoritative taxonomy is paintings-only:
- oil painting;
- acrylic painting;
- tempera;
- watercolor;
- gouache;
- pastel painting.

Standalone drawing, printmaking/prints, sculpture, decorative art, photography, furniture, ceramics, jewelry, clocks, manuscripts and generic antiques are excluded from ingestion, publication and public discovery. Historical generic Object Authority code may remain internally for identifier compatibility, but it must not re-open those product categories.

### Authority reuse — no parallel systems
- existing object/passport remains artwork authority;
- existing creator/gallery graph remains artist/relationship authority;
- existing collection graph remains collection authority;
- existing Taste Graph remains personalization authority;
- existing exhibition/editorial systems are extended for cultural discovery;
- existing auction authority remains the only auction/bid/result authority;
- v0.22-v0.40 dealer/pilot/evidence code is retained, not deleted, but removed from primary consumer navigation.

### New content model required
Add a cultural-content layer linked to existing authorities rather than duplicating them:
- `Book` → authors/editors/publisher/ISBN/language/year/cover/description → artists/themes/periods/works;
- `Course` → provider/instructor/format/dates/level/language/enrollment URL or internal registration → artists/themes/periods;
- `Event` → venue/organizer/date/time/type/ticket URL or internal registration → artists/works/themes;
- `Theme/Movement` → editorial hub connecting works, artists, books, courses and events.

Books/courses/events are contextual discovery entities. They must never become alternate artwork, creator, auction or provenance authorities.

### UX rule
The consumer UI must remain visually quiet and image-first. Research depth, provenance and market state are progressive disclosure. Dealer pilot KPIs, bilateral acceptance, evidence governance and operational controls must not appear in the normal Gallery journey.

### Commerce rule
Commerce is optional at the artwork level. A work may be:
- discovery/research only;
- linked to an upcoming/live/closed Antiqua auction lot;
- linked to a historical auction result;
- part of a collection/exhibition with no sale state.

The Gallery must not imply that every artwork is for sale.

### Product metrics after reset
Primary consumer metrics:
- artwork opens per session;
- save/favorite rate;
- artwork → artist continuation;
- related-work continuation;
- collection creation/add rate;
- D7/D30 authenticated return;
- personalized discovery engagement;
- artwork/artist → book/course/event continuation;
- auction watch/bid conversion only for auction-eligible works.

Professional pilot metrics remain separate and must not be blended into consumer engagement metrics.

## Integration map

| Capability | Source | Decision |
|---|---|---|
| IIIF viewer | Mirador | ADOPT |
| Provenance graph | Wikibase patterns | ADAPT |
| Authority reconciliation | OpenRefine | ADOPT/EDITORIAL |
| Visual similarity | Qdrant | ADAPT |
| OCR marks/labels | Tesseract | ADAPT |
| RAW pipeline | LibRaw | ADOPT |
| Colour pipeline | OpenColorIO | ADOPT |
| Metadata extraction | ExifTool | ADOPT |
| Photogrammetry | Meshroom | DEFER |
| Media provenance | C2PA | ADAPT |
| Transferable passport | vc-js standards | DEFER/ADAPT |

## Phase 0 — Real pilot first
**Current state:** IN PROGRESS — database/schema side is ready; runtime bridge and live pilot evidence remain open.

No new integration may delay the first dealer engagement or create a competing pilot/evidence authority.

### Phase 0 exit gate
Phase 1 may start only when all of the following are evidenced from the live Antiqua contour:
- exact deployed commit is recorded;
- runtime reports PostgreSQL persistence, not memory fallback;
- a restart preserves a controlled write;
- engagement contract/inventory/KPI/baseline are frozen;
- required counterparties have accepted;
- W1 review is scheduled or active.

A green schema alone does not satisfy this gate.

## Phase 1 — Object Media Authority
Model immutable original, RAW master where available, processed derivative, thumbnail, checksum, capture/source, rights, technical metadata and object/condition-report relationship.

Original is never overwritten.

LibRaw decodes RAW; ExifTool extracts candidate technical metadata; OpenColorIO creates a versioned colour pipeline.

## Phase 2 — IIIF / Mirador
Expose IIIF manifests derived from Antiqua media authority. Use Mirador for zoom, comparison, condition review and scanned provenance sources. Mirador is a viewer only.

## Phase 3 — OCR candidate observations
Tesseract processes maker marks, labels, inscriptions and documents. OCR result stores source region/page, confidence, reviewer and accepted/rejected state.

Never assign maker/creator from OCR alone.

## Phase 4 — Authority reconciliation
OpenRefine supports editorial reconciliation of creators, auction houses, places, materials, periods and external authority IDs. Approved links are versioned back into Antiqua.

## Phase 5 — Provenance knowledge graph
Native graph:
`object -> ownership/holding event -> person/org -> place -> date/range -> evidence -> confidence/status`

Support competing/disputed claims. Wikibase is a modeling/editorial reference or future sidecar, not immediate production authority.

## Phase 6 — Visual similarity
Qdrant is a rebuildable index for visually similar works, duplicate listing detection and cross-auction reappearance. Similarity never equals attribution/authentication.

## Phase 7 — C2PA
Retain content credentials where present. C2PA strengthens media provenance claims, not artwork authenticity.

## Phase 8 — Photogrammetry gate
Meshroom only after pilot proves value and media capture/storage/compute are stable. 3D is a derivative linked to source captures.

## Phase 9 — Transferable passport
Verifiable credentials only after passport/ownership authority is stable. Credential is a signed projection with revocation/update rules; confidential owner/provenance data stays private by default.

## Prohibited
- delaying real pilot for speculative media features;
- creating another evidence authority in v0.40;
- sharing DB with another project;
- treating OCR/similarity as authentication;
- treating EXIF/C2PA as ownership proof;
- overwriting source imagery.

## Issue order
1. ANTIQUA-INT-00 Dedicated DB + real engagement — #61 — **IN PROGRESS**
2. ANTIQUA-INT-01 Object Media Authority — #62 — BLOCKED BY INT-00
3. ANTIQUA-INT-02 IIIF/Mirador — #63 — BLOCKED BY INT-01
4. ANTIQUA-INT-03 OCR — #64 — BLOCKED BY INT-01/02
5. ANTIQUA-INT-04 Reconciliation — #65 — BLOCKED BY INT-03
6. ANTIQUA-INT-05 Provenance graph — #66 — BLOCKED BY INT-04
7. ANTIQUA-INT-06 Similarity — #67 — BLOCKED BY MEDIA AUTHORITY
8. ANTIQUA-INT-07 C2PA — #68 — BLOCKED BY MEDIA AUTHORITY
9. ANTIQUA-INT-08 Photogrammetry gate — #69 — DEFERRED
10. ANTIQUA-INT-09 Credential/passport gate — #70 — DEFERRED

**Implementation instruction:** complete durable runtime/pilot proof without expanding dealer UX; then deepen the gallery-first artwork/research product. Consumer Gallery is primary; professional pilot/evidence stays backstage.


## Recommendation refresh protocol
This file is the canonical integration sequence and must be re-checked at every gate transition. Update recommendations when live evidence changes, a dependency becomes obsolete, or a safer/stronger integration path is demonstrated. Do not advance a phase merely because its code can be written; advance it only when the preceding authority and evidence gate is satisfied.

## Additional wave — IIIF delivery, signed-document evidence and 3D admission

### Cantaloupe IIIF image server — ADOPT/CONDITIONAL SIDECAR

Reference: https://github.com/cantaloupe-project/cantaloupe

Mirador is the viewer; Cantaloupe can become the bounded image-delivery service when object imagery volume/resolution makes static derivatives inefficient.

Architecture:

`Antiqua media authority -> approved source/derivative -> Cantaloupe IIIF Image API -> IIIF manifest -> Mirador`

Cantaloupe must have read-only access to admitted media and must not become the media metadata/provenance database.

Use only after Object Media Authority is stable.

### pyHanko signed provenance-document verification — ADOPT

Reference: https://github.com/MatthiasValvekens/pyHanko

For uploaded certificates, invoices, provenance records or institutional PDFs containing digital signatures:

`original signed PDF -> cryptographic verification -> certificate/timestamp/trust evidence -> Antiqua document-evidence record`

Persist source checksum, signature status, certificate/trust details and validator version.

A valid PDF signature can establish document integrity/signing identity under the configured trust policy; it does **not** authenticate the artwork, establish title or prove the factual truth of a provenance statement.

Never rewrite the original signed document before verification.

### glTF Validator 3D admission — ADOPT when photogrammetry opens

Reference: https://github.com/KhronosGroup/glTF-Validator

When Meshroom/other 3D derivatives are admitted, every glTF/GLB passes a deterministic validation gate.

Store:

- source capture set ID;
- Meshroom/processor version;
- model checksum;
- validation report;
- triangle/texture/size metrics;
- object relation;
- generated_at.

3D is always a derivative; the original photo set and condition evidence remain authoritative.

### Acceptance extension

- IIIF delivery can be rebuilt from admitted media;
- signed PDF validation never becomes artwork-authentication logic;
- invalid 3D cannot publish into the object viewer;
- every 3D model traces back to source captures and processor version.

**Sequencing:** Cantaloupe follows Object Media + IIIF manifest stability; pyHanko can follow document evidence admission; glTF validation activates only when the photogrammetry gate is opened.

## Additional wave — semantic provenance export, preservation packaging and high-resolution derivative pipeline

This wave strengthens museum/research interoperability after the dedicated DB, Object Media and Provenance Graph authorities are stable.

### RDF / CIDOC-CRM-oriented semantic projection — ADAPT

Library reference: https://github.com/RDFLib/rdflib

Build a derived semantic export of approved Antiqua facts using stable URIs and a documented mapping inspired by CIDOC CRM / cultural-heritage vocabularies.

Candidate mappings:

- object/work;
- creator/person/organisation;
- creation/production event;
- ownership/holding/provenance event;
- place;
- auction/sale event;
- document/source;
- material/technique;
- identifier/authority link.

Every exported statement traces back to an Antiqua record + version/evidence state.

The RDF graph is interoperability/read-model output. It must not become the writable provenance authority.

### Controlled Vocabulary / Authority Links — ADOPT

Add explicit external-authority link records for creators, places, materials, object types and techniques.

Store:

- authority/provider;
- external ID/URI;
- label at reconciliation time;
- relation type (same-as / broader/narrower/candidate);
- confidence/status;
- reviewer;
- source/version.

Examples may include Getty vocabularies, Wikidata, VIAF or institutional authorities where licensing/API terms permit.

Do not collapse two Antiqua entities solely because an external authority candidate matches approximately.

### OCFL-style Preservation Package — ADOPT/ADAPT

Specification reference: https://github.com/OCFL/spec

For high-value object/document/media records, create preservation packages with:

- logical object ID;
- version inventory;
- fixity/checksums;
- content paths;
- metadata/evidence manifest;
- creation/version timestamps.

The goal is reproducible long-term preservation and integrity, not replacing live PostgreSQL/object storage.

A package should be rebuildable/exportable from authoritative Antiqua state and admitted originals.

### libvips High-resolution Derivative Pipeline — ADOPT

Reference: https://github.com/libvips/libvips

Use libvips in the media worker for efficient:

- large TIFF/JPEG processing;
- thumbnails;
- tiled pyramids/derivatives where required;
- IIIF-ready image preparation;
- colour-managed derivative stages in conjunction with OpenColorIO.

Original/source masters remain immutable. Every derivative records processor/version/profile/source checksum.

### IIIF Change Discovery / incremental publication — ADAPT

Use IIIF change-discovery patterns so downstream research/catalogue consumers can detect newly published/updated/withdrawn manifests without crawling the full catalogue.

Publish change records only from approved Antiqua publication events.

A withdrawn public manifestation should remain historically auditable internally even when no longer publicly served.

### Additional acceptance

- semantic triples resolve to exact Antiqua source records/versions;
- authority links have reviewer/status and do not auto-merge entities;
- preservation package fixity validates;
- high-res derivatives can be regenerated from immutable source masters;
- downstream IIIF change feed reflects only approved publication changes.

**Sequencing:** Object Media + Provenance Graph -> controlled authority links -> RDF projection -> OCFL preservation export -> IIIF change discovery. libvips belongs inside the Object Media processing layer.

**Dependency hygiene:** check current external authority API/licensing terms before automated harvesting or redistribution.

## Additional wave — IIIF region annotation and Linked Art interchange

This wave deepens scholarly/condition research around already admitted images and provenance evidence.

### Annotorious image-region annotation — ADOPT

Reference: https://github.com/annotorious/annotorious

Embed a bounded region-annotation layer on approved object/document imagery.

Use cases:

- condition defect region;
- signature/mark/label;
- inscription;
- restoration/conservation area;
- provenance-document paragraph/stamp/seal;
- object-detail feature;
- OCR source-region review.

Each annotation stores:

- Antiqua object/media/document ID;
- source media version/checksum;
- selector/region geometry;
- annotation type;
- text/note;
- creator/reviewer;
- created/updated timestamps;
- review/publication status;
- related observation/provenance claim/condition item.

The annotation UI is not the evidence authority. It creates reviewed Antiqua annotation records linked to immutable media.

### IIIF Web Annotation projection — ADAPT

Where media is exposed through IIIF, publish approved annotations in a standards-compatible annotation-page/list model.

Flow:

Antiqua annotation -> publication filter -> IIIF annotation projection -> Mirador/other viewer

Private dealer/research notes must never appear in public IIIF output unless explicitly published.

A changed source-media version should trigger annotation integrity checks so stale pixel coordinates are not silently displayed on a different derivative.

### Linked Art JSON-LD public/research interchange — ADAPT

Reference: https://github.com/linked-art/linked.art

Refine the existing RDF/CIDOC-oriented export by supporting a documented Linked Art profile for selected public/research objects.

Candidate exports:

- object/work;
- actor/creator;
- production;
- ownership/provenance event;
- auction/sale;
- exhibition/viewing;
- identifier;
- image/digital object;
- bibliography/document reference.

Linked Art is a publication/interchange profile over approved Antiqua facts. It does not become a writable database.

### Annotation-to-Claim workflow — ADOPT

Support an explicit bridge:

image/document region -> candidate observation -> reviewed evidence -> provenance/condition claim

Examples:

- OCR finds a label;
- researcher selects the label region;
- annotation links the exact visual evidence;
- human confirms/transcribes;
- only then may a provenance claim reference it.

This prevents free-text provenance claims from losing their exact visual source.

### Additional acceptance

- every annotation resolves to exact media/document version;
- stale annotation geometry is detected after media replacement/reprocessing;
- public IIIF annotations exclude private notes;
- Linked Art export is reproducible from exact approved source records;
- annotation cannot directly authenticate an artwork or change provenance without the existing review flow.

**Sequencing:** Object Media + IIIF -> Annotorious region annotation -> annotation review -> IIIF annotation publication -> Linked Art interchange enrichment.

**Dependency note:** Annotorious is currently BSD-licensed upstream; re-check exact version/license before bundling. Linked Art is a modeling/publication reference, not a runtime authority.

## Additional wave — rights statements, controlled access and reproduction requests

This wave makes public/research image delivery clearer and safer once Object Media, IIIF and publication workflows are stable.

### RightsStatements.org vocabulary mapping — ADOPT/ADAPT

Reference:

https://github.com/rightsstatements/data-model

Add a controlled public-rights field to approved media/publication records.

Store:

- Antiqua media/object ID;
- rights statement URI/code;
- rights holder where known;
- copyright/license note;
- jurisdiction/territory note where relevant;
- source of rights assertion;
- effective/review date;
- reviewer;
- public-display text.

Use a controlled statement only when its meaning actually fits the known rights position.

Do not infer public-domain status merely from artwork age; image/reproduction rights may differ from underlying-work rights.

### Public / Research / Restricted Media Access — ADOPT

Create explicit access policies for derivatives:

- public;
- registered research;
- dealer/owner restricted;
- internal only;
- embargoed until date;
- rights-review required.

The access state belongs to Antiqua. IIIF/viewer services enforce a projection of it.

### IIIF access-control projection — ADAPT

Use IIIF authorization/access patterns from:

https://github.com/IIIF/api

Where restricted high-resolution media is served, the viewer/image service should receive a bounded token/access decision from Antiqua rather than exposing original storage URLs.

Rules:

- thumbnail may be public while full resolution is restricted;
- public manifest may omit private canvases/annotations;
- revoked access must stop future retrieval;
- cached/public derivatives follow their own publication state.

### Reproduction / Image Request Workflow — ADOPT

Create:

request -> object/image -> intended use -> territory/channel -> resolution -> rights review -> fee/permission where applicable -> approved derivative -> delivery -> expiry/usage note

Track:

- requester;
- requested asset;
- purpose/publication;
- rights holder/contact;
- reviewer;
- status;
- approved file/derivative;
- terms;
- expiry;
- delivery evidence.

This is not a full rights-management business unless real demand justifies it; it is a controlled permission trail.

### Public Attribution Block — ADOPT

Generate consistent attribution/credit text from authoritative media metadata:

- object title/creator;
- collection/dealer/institution where publishable;
- photographer;
- rights statement;
- image credit;
- canonical object URL.

Never generate a credit line from missing/uncertain data without marking the uncertainty.

### Additional acceptance

- every public media derivative has explicit rights/access state;
- rights statement choice is reviewable/versioned;
- IIIF authorization cannot expose original/private storage URLs;
- reproduction request resolves to the exact derivative/terms delivered;
- access revocation does not delete historical rights/audit evidence;
- public credit text derives from canonical metadata.

**Sequencing:** Object Media + IIIF + rights metadata -> controlled public/research access -> reproduction workflow -> public attribution generation.

**Dependency note:** RightsStatements data model is CC0 upstream; IIIF remains a standard/API reference. Institutional/provider rights terms still govern each underlying asset.



## Gallery-first delivery sequence
After INT-00 runtime durability is proven, prioritize:
1. consumer navigation and Home/Gallery hierarchy;
2. paintings-only taxonomy and publication guard;
3. Artwork → Artist → Related Works continuity;
4. Collections + Taste Graph personalized discovery;
5. Books/Courses/Events cultural-content graph;
6. Auction surfacing from the existing auction authority;
7. Media Authority + IIIF/Mirador/Cantaloupe as image quality scales;
8. OCR/reconciliation/provenance/similarity/C2PA according to their gates.

Do not delete v0.22-v0.40. Remove professional surfaces only from primary consumer navigation; preserve their routes/data until an explicit retirement decision.

## 2026-10-01 implementation checkpoint — Artwork → Artist → Related Works

The first post-reset content graph is now implemented on the gallery-first mainline without creating a parallel object authority.

- Artwork remains the existing authoritative object/passport (objects + passport/revision authority).
- Artist remains the existing v30 creator graph (creators + creator_object_links); free-text maker is never promoted into a biography automatically.
- GET /api/objects/:id/creators exposes only published creator profiles explicitly linked to the artwork, with creator role and attribution status.
- Artwork dossier links directly to the verified Artist profile when that relationship exists; otherwise it states that no verified creator profile is linked.
- Related Works reuse v18 explainable similarity (CATALOGUE_RULES_V1) and surface human-readable reason codes instead of introducing an opaque recommendation score.
- Shareable artwork URLs canonicalize to #gallery; legacy #shop remains a compatibility route.
- Desktop/mobile Browser E2E now owns the Gallery-first contract and the Artwork → Artist → Related Works journey.

### Next implementation gate

After this checkpoint is green, continue in this order:

1. deepen Artist pages: biography evidence, chronology/exhibitions where sourced, works grouping;
2. make Related Works a reusable gallery surface, preserving explainable reasons;
3. Collections/Taste on top of existing collection + taste authorities;
4. Books/Courses/Events;
5. Auction integration into artwork context;
6. Media Authority;
7. IIIF/Mirador;
8. Cantaloupe only after Media Authority + IIIF image-service requirements are explicit and operationally justified.

Do not re-promote dealer/pilot surfaces into the primary consumer navigation. Dealer/pilot capabilities remain preserved professional infrastructure behind role-appropriate surfaces.

## 2026-10-01 implementation checkpoint — Artist depth + reusable Related Works

Prepared as stacked PR #81 on top of Gallery-first PR #80.

- Artist profile projection now exposes research context only from explicit creator metadata: evidence status, biography sources and chronology.
- Public exhibition context is derived only from PUBLIC/SCHEDULED/LIVE/ARCHIVED exhibitions that actually contain a published work linked to the creator.
- Artist works retain the existing creator_object_links authority and are grouped in the UI by explicit technique, falling back to explicit period only when technique is absent.
- Related Works rendering is extracted into a reusable gallery component; ranking still comes exclusively from v18 explainable similarity.
- No free-text catalogue maker is promoted into creator identity, chronology or biography.
- No artist research field is inferred from browsing behavior or generated text.
- Dealer/pilot infrastructure remains preserved but absent from primary consumer navigation.

### Exit gate for this checkpoint

Before Collections/Taste work is allowed to merge:
1. PR #80 must be fully green and merged;
2. PR #81 must be rebased onto the resulting main;
3. CI + Browser E2E must be green for the rebased Artist-depth head;
4. Artwork → Artist → Related Works must remain functional on desktop and mobile.

Only then open the Collections/Taste implementation slice.


## Product expansion — Antiqua Art Network

**Direction — superseded on 2026-10-07:** Antiqua is a focused digital ecosystem for paintings and painterly media only. It brings together people and institutions around authoritative Artwork/Artist records instead of building a generic social network.

### Network graph

`Account / Public Art Profile ↔ Artist ↔ Artwork ↔ Collection ↔ Gallery/Institution ↔ Exhibition/Event ↔ Book/Course ↔ Auction`

The public network is a projection over existing authorities. It does not replace authentication, creator identity, organization authority, collections, exhibitions or auction records.

### Participant types

Public participation may describe one or several cultural roles:

- ARTIST;
- GALLERY_REPRESENTATIVE;
- CURATOR;
- EXPERT;
- ART_HISTORIAN;
- RESEARCHER;
- COLLECTOR;
- ENTHUSIAST;
- INSTITUTION_REPRESENTATIVE.

These are **public profile descriptors**, not security permissions. Authorization continues to use the existing account/organization role system.

### Identity and authority rules

1. One account identity per user. Do not create a second community login.
2. An Artist public identity continues to use the existing Creator Graph.
3. A gallery continues to use existing Organizations; use organizationType=GALLERY or an approved cultural organization type rather than a parallel gallery table.
4. A person may claim/link a creator profile only through an explicit reviewed relationship.
5. Expert / historian / curator status is never inferred from biography text.
6. Expertise claims are scoped and reviewable, for example:
   - Russian avant-garde;
   - nineteenth-century European painting;
   - prints/engraving;
   - paper conservation;
   - provenance research;
   - specific artist/catalogue raisonné domain.
7. Platform review of a profile or expertise claim does not mean Antiqua guarantees every opinion supplied by that person.
8. Collector identity and collection contents remain private/pseudonymous by default.

### Public Art Profile

A shared profile shell may include:

- display name;
- portrait/avatar;
- city/country;
- languages;
- participant roles;
- biography/about;
- areas of interest;
- expertise claims + evidence state where applicable;
- linked Creator profile if the account represents an artist;
- linked Organizations/Galleries;
- selected PUBLIC Collections;
- selected exhibitions/events;
- published editorial/book/course contributions;
- contact/collaboration preferences;
- website/social references where permitted.

Sensitive fields, legal identity, private ownership and private contact data are never copied into the public profile.

### Gallery / institution surface

Extend existing Organization authority rather than creating a new commercial seller identity.

Gallery pages may show:

- public identity and locations;
- represented artists from creator_representations;
- current/upcoming exhibitions;
- selected artworks;
- published collections/editorial;
- events/talks/courses;
- historical auction/market context where relevant;
- collaboration/contact entry;
- professional consignment/sales tools only to authorized members.

Representation is displayed only from explicit creator_representations evidence.

### Expert / historian / curator surface

Profiles should emphasize research quality rather than popularity:

- areas of expertise;
- bibliography/publications;
- lectures/courses;
- exhibition participation;
- reviewed annotations or research contributions;
- provenance/document contributions;
- institutional affiliations where documented;
- languages;
- collaboration availability.

Expertise is a scoped claim with statuses such as:
`SELF_DECLARED → EVIDENCE_SUBMITTED → REVIEWED → VERIFIED / REJECTED / EXPIRED`.

Never create a single universal “expert score”.

### Collector / enthusiast surface

Collector participation must support different privacy levels:

- PRIVATE — account-only;
- PSEUDONYMOUS — public cultural profile without legal identity;
- PUBLIC — explicit public identity.

Possible public activity:
- curated PUBLIC collections;
- saved public exhibitions/events;
- following artists/galleries/topics;
- editorial comments/contributions only if moderation opens;
- event participation only when user explicitly chooses to display it.

Private collection records, value, storage, insurance, offers/bids and acquisition history must never leak into community surfaces.

### Connections

Prefer bounded cultural relationships over generic social mechanics:

- follow Artist;
- follow Gallery;
- follow Expert/Curator;
- follow Theme/Movement;
- save Artwork;
- save Collection;
- save Event;
- collaboration request;
- exhibition participation invitation;
- expert/research request;
- lecture/course invitation;
- consignment inquiry;
- reproduction/image request.

Do not make follower count a research/authority ranking factor.

### Collaboration requests

Use structured requests rather than unrestricted anonymous messaging as the first release.

Request types:
- ARTIST_GALLERY_COLLABORATION;
- EXHIBITION_PROPOSAL;
- CURATORIAL_INVITATION;
- EXPERT_REVIEW_REQUEST;
- PROVENANCE_RESEARCH_REQUEST;
- EVENT_SPEAKER_INVITATION;
- COURSE_LECTURE_INVITATION;
- CONSIGNMENT_INQUIRY;
- PRESS_EDITORIAL_REQUEST.

Workflow:
`draft → sent → viewed → accepted / declined → in_progress → completed / cancelled`.

Each request has sender, recipient/profile/org, subject entity IDs, purpose, optional schedule, visibility boundary and immutable event history.

### Events and exhibitions as community glue

Events should connect people to actual Art Graph entities.

Examples:
- exhibition opening;
- gallery viewing;
- artist talk;
- curator tour;
- expert lecture;
- printmaking workshop;
- collection discussion;
- auction preview;
- live auction;
- book presentation;
- course session.

Event pages link to participating Artists, Galleries, Experts, Artworks, Books/Courses and relevant Auction lots.

### Promotion and discovery

Promotion is allowed, but must be separated from research/editorial authority.

Supported future promotion:
- Featured Artist;
- Featured Gallery;
- Featured Exhibition/Event;
- sponsored editorial placement;
- auction promotion;
- course/book promotion.

Rules:
- sponsored/paid placement is explicitly labeled;
- promotion does not modify creator evidence status;
- promotion does not affect provenance/authentication;
- promotion does not silently alter Related Works or Taste affinity scores;
- paid reach analytics is separate from organic discovery metrics.

### Community discovery surfaces

After the existing Gallery/Artist/Collections gates are green:

1. **For You** — explainable artwork discovery from Taste Graph.
2. **Artists** — published Artist profiles.
3. **Galleries** — organizations with cultural profiles.
4. **Experts & Historians** — scoped research profiles.
5. **Collections** — public curated collections with privacy-safe attribution.
6. **Exhibitions & Events** — calendar + discovery.
7. **Learn** — books, courses, editorial.
8. **Auction** — authoritative auction surface.
9. **Network** — collaboration/people discovery, not a generic engagement feed.

### Activity feed rule

If a feed is introduced, it is a **derived cultural activity projection** from authoritative events:

- new published work;
- new public collection;
- exhibition announced/opened;
- artist/gallery followed;
- article/book/course published;
- event scheduled;
- auction opened/closed.

No feed item becomes an authority record by itself.

### Trust, safety and moderation

Before open community contribution:
- impersonation reporting;
- profile/report moderation;
- block/mute;
- spam/rate limits;
- collaboration-request abuse controls;
- evidence review for expert/representation claims;
- audit trail for moderation decisions;
- clear separation of platform review from artwork authentication.

### Product metrics

Prefer meaningful cultural outcomes:
- Artwork → Artist continuation;
- Artist → Gallery/Exhibition continuation;
- Save → Collection rate;
- Collection → personalized discovery return;
- D7/D30 return;
- Artist/Gallery follow retention;
- Event save/registration;
- collaboration request acceptance/completion;
- Expert profile → research request;
- Learn → Artwork/Artist continuation;
- Auction watch/bid only for eligible works.

Do not optimize the core product around raw likes, follower races or time-on-screen.

### Commercial paths

Commercialization may later include:
- gallery/professional subscriptions;
- artist/gallery promotion packages;
- exhibition/event packages;
- auction seller commissions;
- premium research/expert requests;
- courses/lectures;
- image/reproduction licensing workflows;
- institutional data/research services.

Commercial services must remain visibly distinct from editorial, provenance and expert evidence status.

### Sequencing update

The gallery-first delivery sequence is refined as:

1. Gallery + Artwork + Artist + Related Works — **landed**;
2. Collections + Taste — **landed in #90; CI + Browser E2E green**;
3. participant/galleries/expertise identity design and trust model;
4. Books/Courses/Events cultural graph;
5. collaboration requests + Network discovery;
6. Auction integration into Artwork/Artist/Gallery journey;
7. Media Authority;
8. IIIF/Mirador/Cantaloupe;
9. OCR/reconciliation/provenance/similarity/C2PA;
10. scholarly annotations/Linked Art/rights/preservation layers according to existing gates.

The Art Network must never delay core Artwork/Artist quality or create competing authorities.

## 2026-10-02 implementation checkpoint — Collections + Taste

**Status: LANDED** — PR #90 merged as `af34547f267e06ca721be53560b0375da1726bec`; exact PR head `8aa6a5de98084e4c4fc70c284056fa98aaf3cc41` passed ANTIQUA CI and Browser E2E.

- Gallery discovery is being refocused from legacy “Culture of Objects” wording to painting / works on paper / printmaking.
- `#gallery` is the canonical personalized discovery surface; legacy `#shop` remains compatibility only.
- existing v28 Taste Graph remains the recommendation authority;
- adding an artwork to a user's curated Collection now records the existing `COLLECTED` object flag so Taste receives the same durable fact;
- after Collection add, Gallery personalized discovery refreshes;
- collected/saved/owned/purchased works remain excluded from “new discovery” recommendations according to v28 rules;
- PRIVATE collections remain absent from the public Collections API;
- Browser E2E covers PRIVATE Collection → COLLECTED signal → explainable recommendation exclusion → personalized Gallery.

### Exit gate — PASSED

Evidence from merged #90:
1. Collection/Taste CI — PASS;
2. Browser E2E — PASS;
3. PRIVATE collection non-leak contract remains covered;
4. v28 explainability/no-AI/no-price-matching assertions remain green;
5. Gallery routing/copy is painting/graphics/engraving-first.

### Next active product gate

Proceed with:
1. complete and merge v0.41 Art Network identity/trust foundations: unified Art Profiles, Gallery/Institution cultural profiles, scoped expertise claims and collector privacy;
2. Books/Courses/Events cultural graph + Art Calendar;
3. structured collaboration requests, Artist↔Gallery connection/consignment handshake and Network discovery;
4. bounded artist/gallery/event/auction alerts on existing follow/watch authorities;
5. benchmark additions #103–#105 only after their owning authorities are ready.

Do not begin Art Lens image recognition before Media Authority / approved image identity rules are defined.
Do not begin Private Rooms by copying Artwork metadata into a new mutable store.
Do not begin Art Week routing before Event/Exhibition/Auction schedule authority is stable.


## 2026-10-02 benchmark refresh — art platforms, gallery tools and museum apps

This benchmark is a product-pattern source only. Antiqua must adapt useful mechanics to its existing Artwork / Artist / Organization / Collection / Exhibition / Auction / Evidence authorities instead of copying another product's information architecture or visual language.

### Artsy — discovery, follows, alerts and market continuity

Official references:
- https://www.artsy.net/about
- https://www.artsy.net/find-the-art-you-love
- https://www.artsy.net/auctions

Observed product patterns:
- save artworks;
- follow artists;
- alerts for matching/new works;
- personalized recommendations;
- expert/editorial context;
- auction discovery in the same consumer journey;
- pricing/auction-result context where available.

**ADOPT/ADAPT for Antiqua**
- strengthen Artist/Gallery/Theme follow as a durable explicit signal;
- add bounded alerts for new published works, exhibitions/events and auction lots;
- preserve explainable Taste recommendations rather than an opaque engagement score;
- keep historical auction result context adjacent to Artwork without turning every Artwork into a sale object;
- use Artwork → Artist → Collection → Auction continuity rather than separate marketplace silos.

**DO NOT COPY**
- do not optimize Gallery ranking primarily for transaction likelihood;
- do not let market activity become artwork quality/authenticity evidence;
- do not use raw popularity/follower count as expertise or scholarly authority.

### Ocula — vetted gallery layer, exhibitions, editorial and advisory context

Official references:
- https://ocula.com/about/
- https://ocula.com/art-galleries/
- https://ocula.com/membership/
- https://ocula.com/faqs/

Observed product patterns:
- curated/vetted gallery participation;
- gallery → represented artists → artworks → exhibitions continuity;
- follow artists/galleries for updates;
- strong exhibition and fair discovery;
- editorial/research content adjacent to commercial discovery;
- enquiry/advisory entry instead of forcing checkout for every work.

**ADOPT/ADAPT for Antiqua**
- Gallery/Institution cultural profiles must derive from existing Organization authority;
- introduce reviewed cultural-profile status distinct from legal account/KYB and distinct from artwork authentication;
- show represented Artists only from explicit creator_representations;
- Gallery pages surface exhibitions/events, selected artworks, Learn content, private rooms and collaboration entry;
- support "enquire / collaboration / consignment / expert request" when direct purchase is inappropriate.

**DO NOT COPY**
- no universal "approved gallery = approved artwork" implication;
- no hidden pay-to-rank treatment;
- no gallery membership state may alter provenance/authentication.

### Art Basel app — art-week planning, artwork lens and event continuity

Official reference:
- https://www.artbasel.com/artbaselapp

Observed product patterns:
- events, galleries and recommendations in one fair experience;
- personal schedule/calendar;
- artwork scan/lens to reach artist/story/gallery context;
- RSVP and event access;
- shareable discoveries;
- trip/fair planning around culture, not just objects.

**ADOPT/ADAPT for Antiqua**
- build Art Week / Art Day Planner from authoritative Event + Exhibition + Auction schedules;
- saved events become a private personal itinerary;
- allow export/sync to external calendar later;
- create Art Lens only as a discovery resolver to existing Artwork records;
- Lens match is never attribution/authentication;
- every recognized Artwork continues into Artist, Gallery, exhibition, Learn and Auction context.

### Smartify — scan-to-context, visitor mode, audio and accessibility

Official references:
- https://smartify.org/partners/products/web-and-mobile-apps
- https://smartify.org/partners/features/personalisation

Observed product patterns:
- artwork/object recognition;
- rich curatorial context after a scan;
- audio guides and transcripts;
- multilingual delivery;
- self-directed personalized tours based on interests/time;
- accessibility-first presentation;
- pre-visit → in-visit → post-visit continuity.

**ADOPT/ADAPT for Antiqua**
- introduce Visit Mode for exhibitions/galleries/events;
- optional scan/QR opens the canonical Artwork, never a duplicate scan record;
- route suggestions use explicit interests + available time + saved must-sees;
- audio/transcript layer links to reviewed Artwork/Artist/Event content;
- accessibility requirements belong to core UI contracts, not a separate "accessibility mode";
- allow post-visit save to Collection/Taste while keeping location/visit disclosure private by default.

**DO NOT COPY**
- recognition confidence cannot become authorship/authenticity evidence;
- AI-generated narration cannot silently replace curator/expert authored content.

### Artlogic — Private Views, dynamic presentations and gallery sales collaboration

Official references:
- https://support.artlogic.net/hc/en-gb/articles/360009948219-An-introduction-to-Private-Views
- https://support.artlogic.net/hc/en-gb/articles/17337147499036-How-to-create-Private-Views
- https://support.artlogic.net/hc/en-gb/articles/18702268525596-How-to-enable-and-display-the-Enquiry-button-on-your-Private-Views
- https://support.artlogic.net/hc/en-gb/articles/360021545340--View-on-a-wall-for-Private-Views-Beta
- https://support.artlogic.net/hc/en-gb/articles/21575664444700-NEW-How-to-set-up-Dynamic-Private-Views-Beta

Observed product patterns:
- shareable private artwork presentations;
- static snapshot versus dynamically updated view;
- direct enquiry on individual works;
- "view on a wall" scale visualization;
- gallery/team use on phone/tablet, including fair scenarios;
- enquiry continuity into a sales pipeline.

**ADOPT/ADAPT for Antiqua**
- create **Private Rooms** as permissioned presentations of authoritative Artwork records;
- support SNAPSHOT and LIVE modes;
- every room stores exact included Artwork IDs and publication/access policy;
- enquiry creates an existing structured collaboration/consignment/commercial request rather than email-only state;
- add optional "View on wall" after dimensions/media quality are present;
- tablet/desktop curation plus phone viewing must be first-class;
- room expiry/revocation and access audit are mandatory.

**DO NOT COPY**
- Private Room must never duplicate Artwork metadata as a new authority;
- private collector identity, collection records, valuation and ownership data remain outside shared rooms unless explicitly published.

### Sotheby's and Christie's — watch, live auction, alerts and account continuity

Official references:
- https://www.sothebys.com/en/about/sothebys-apps
- https://www.christies.com/about-us/get-the-christies-app

Observed product patterns:
- browse upcoming/sold lots;
- favorites/watch;
- alerts/notifications;
- live auction viewing and bidding;
- result/history context;
- account continuity for bids, purchases and registered sales.

**ADOPT/ADAPT for Antiqua**
- keep one Auction authority;
- Artwork shows auction state only when an authoritative lot relation exists;
- Watch/alert belongs to explicit user action;
- live state uses authoritative server clock;
- closed result becomes historical market context on Artwork/Artist;
- account area keeps watch/bid/result continuity without exposing private behavior to the Art Network.

### Product synthesis — what makes Antiqua distinct

Antiqua should not become a clone of Artsy, Ocula, Smartify, Art Basel, Artlogic, Sotheby's or Christie's.

The unique combined proposition is:

**museum-grade Artwork depth + verified Artist/Gallery/Expert relationships + privacy-safe collecting + cultural learning/events + structured collaboration + private gallery rooms + in-person Art Lens/Visit Mode + authoritative auction continuity.**

The differentiating graph is:

`Artwork ↔ Artist ↔ Gallery ↔ Expert/Art Historian/Curator ↔ Collection ↔ Exhibition/Event ↔ Book/Course/Editorial ↔ Auction`

Around this graph Antiqua adds:
- explainable Taste;
- scoped expertise/evidence;
- provenance/research depth;
- private/public collection boundaries;
- Private Rooms;
- Exhibition Studio/Open Calls;
- Expert Desk;
- Art Week Planner;
- Art Lens / Visit Mode;
- professional collaboration without a generic social-DM-first model.

### New implementation candidates from benchmark

These are gated additions and must not bypass current Gallery/Collections/Taste gates:

1. **ANTIQUA-NET-12 — Private Rooms / Collector Presentations**
   - Gallery/Artist/Curator creates permissioned Artwork presentation;
   - SNAPSHOT / LIVE mode;
   - expiry/revocation;
   - individual Artwork enquiry;
   - optional View-on-Wall;
   - exact audit/access boundary.

2. **ANTIQUA-NET-13 — Art Lens + Visit Mode**
   - QR/image-recognition candidate resolver;
   - canonical Artwork open;
   - audio/text context;
   - exhibition/gallery route;
   - save to Collection/Taste;
   - recognition is discovery only, never attribution/authentication.

3. **ANTIQUA-NET-14 — Art Week / Art Day Planner**
   - saved Exhibitions, Events, talks, previews, auctions;
   - personal schedule conflict detection;
   - travel/time-aware sequence later;
   - iCal/export later;
   - private itinerary by default.

### Benchmark implementation rule

Before adopting an external product pattern, record:
- authoritative Antiqua entity that owns the state;
- whether the feature is a read model, workflow or new authority;
- privacy/publication boundary;
- evidence/security consequence;
- mobile/tablet/desktop behavior;
- rebuildability/idempotency expectations;
- explicit non-goals.

A benchmark feature may improve user experience but must never silently weaken Antiqua's Artwork, provenance, expertise, rights, auction or privacy authorities.

## Premium innovation wave — condition change intelligence and conservation timeline

This wave makes Antiqua stronger for collectors, dealers, conservators and insurers by showing how an object's documented condition changes over time.

### Standardised Condition Capture — ADOPT

For comparison-eligible media store:

- object;
- date;
- camera/device;
- lens/settings where available;
- lighting/reference setup;
- colour target/reference where used;
- orientation/view;
- distance/scale reference;
- source checksum;
- operator.

Ordinary catalogue images remain useful context but are not automatically calibrated condition evidence.

### Image Registration Worker — ADOPT/ADAPT

Reference:

https://github.com/opencv/opencv

Use CV to align comparable captures:

capture T1 -> registration -> capture T2 -> aligned pair -> reviewed change map

Operations may include perspective correction, feature matching, scale/crop alignment and region correspondence.

Record registration quality/error.

### Colour Change Evidence — ADAPT

Reference:

https://github.com/colour-science/colour

Where capture is calibrated/controlled, calculate bounded Delta-E-like colour-change metrics for selected regions.

Store reference/measurement regions, colour space/illuminant/observer, calibration profile, metric/method, value, processor/version and reviewer.

Never present uncontrolled web-image colour differences as measured conservation truth.

### Condition Change Candidate Map — ADOPT

Machine-detected candidates may include:

- crack/tear change;
- paint/loss/restoration area change;
- stain/discolouration candidate;
- frame/surface change;
- edge/corner damage change.

All remain machine-detected until reviewed by an authorised expert/conservator.

### Conservation Timeline — ADOPT

condition capture -> observed issue -> treatment/conservation event -> post-treatment capture -> reviewed outcome

Link condition report, image regions/annotations, treatment docs, conservator, dates and visibility.

### Collector / Insurance Dossier — ADOPT

Generate a versioned dossier with:

- passport/identity reference;
- condition timeline;
- major reviewed changes;
- conservation events;
- image evidence;
- provenance/rights state;
- export checksum.

It is evidence packaging, not appraisal/authenticity certification.

### Additional acceptance

- comparisons use exact source checksums;
- registration/calibration quality is visible;
- uncontrolled imagery cannot produce calibrated colour claims;
- machine candidates require expert review;
- treatment never overwrites pre-treatment evidence;
- public/private condition details obey ACL.

**Sequencing:** Object Media + Condition Reports + annotations -> standardized capture -> registration -> reviewed change detection -> conservation timeline -> dossier.



## Premium commercial wave — Expert Attribution Board and consensus evidence

This wave creates a distinctive expert/research product for works where attribution, dating, authorship or provenance is uncertain.

### Attribution Review Case — ADOPT

Create a case linked to an Antiqua object with one or more specific questions:

- creator/authorship;
- workshop/school;
- date/period;
- material/technique;
- provenance link;
- inscription/mark interpretation.

The review case references the existing object, evidence, annotations, provenance graph and media. It does not duplicate them.

### Independent Expert Opinion — ADOPT

Each invited expert can submit a structured opinion:

- conclusion category;
- confidence band;
- reasoning;
- supporting evidence IDs;
- contradicting/uncertain evidence;
- requested further examination;
- disclosure/conflict statement;
- visibility;
- signed/submitted time.

An expert opinion is immutable after submission except by explicit superseding revision.

### Blinded Review Mode — ADOPT

Where appropriate, allow experts to submit before seeing other opinions to reduce anchoring/group influence.

After the blind phase closes, authorised participants may see the comparison.

### Consensus / Disagreement Matrix — ADOPT

Show:

expert -> conclusion -> confidence -> evidence -> disagreements

Do not average opinions into false certainty.

Possible board outcome:

- consensus;
- majority with dissent;
- unresolved;
- insufficient evidence;
- additional examination required.

The final curatorial/market-facing attribution remains an explicit authorised decision separate from the matrix.

### Examination Request — ADOPT

An expert may request:

- higher-resolution image;
- UV/IR/X-ray or other examination evidence where available;
- inscription detail;
- provenance document;
- material analysis;
- physical viewing.

The request creates a tracked evidence need rather than a free-text note.

### Expert Credential / Conflict Boundary — ADOPT

Link to existing expert identity/authority records.

Store relevant disclosure/conflict facts, but never infer bias merely from a relationship.

### Attribution Dossier — ADOPT

Generate a controlled dossier:

- question;
- object identity;
- evidence set/version;
- expert opinions;
- disagreement matrix;
- board/final decision;
- unresolved issues;
- checksum/version.

This is not an authenticity certificate unless the responsible authority explicitly issues one.

### Additional acceptance

- experts cannot overwrite another opinion;
- blind mode hides peer conclusions until configured reveal;
- every reasoning claim links to evidence where possible;
- disagreement remains visible;
- final attribution is a separate authorised decision;
- private opinions/disclosures obey ACL;
- dossier preserves historical states.

**Sequencing:** Expert identity + Provenance/Media/Annotation -> review case -> independent opinions -> blind reveal -> consensus matrix -> final decision/dossier.

**Commercial framing:** Antiqua becomes a collaboration platform for serious attribution/research, not only a marketplace/catalogue.

## 2026-10-03 implementation checkpoint — Art Network v0.41

Implementation branch:

- `feature/art-network-trust-v41`

The branch implements the first Art Network authority layer rather than a generic social feed.

### Implemented in v0.41

1. **One-account cultural profile projection**
   - Account remains the identity authority.
   - `art_profiles` is only a reviewed public projection.
   - visibility is explicit: `PRIVATE | PSEUDONYMOUS | PUBLIC`.
   - public APIs never expose internal `account_id`.
   - a substantive profile edit resets publication state to `DRAFT`.

2. **Scoped expertise claims**
   - expertise is claimed by a concrete scope such as artist, movement, period, medium, printmaking, conservation, provenance, region or catalogue raisonné;
   - evidence and review state are stored independently;
   - only `VERIFIED` claims can appear publicly;
   - no universal expert score exists;
   - follower/popularity metrics never change expertise status.

3. **Creator relationship claims**
   - public-person identity does not duplicate Creator Graph;
   - a person may claim `SELF | ESTATE_REPRESENTATIVE | STUDIO_REPRESENTATIVE | AUTHORIZED_REPRESENTATIVE`;
   - a public relationship appears only after review;
   - Artist publication and primary-market authority remain owned by Creator Graph v30.

4. **Gallery / Institution cultural profiles**
   - existing `organizations` remains the Organization authority;
   - non-selling cultural organizations may exist without `seller_id`;
   - cultural-profile review is explicitly separate from commercial/KYB verification;
   - represented artists are read from existing `creator_representations` only.

5. **Collector privacy**
   - collector defaults remain privacy-first;
   - a collector can publish under a pseudonymous profile;
   - public profile detail can surface only Collections already public under Collection authority;
   - PRIVATE Collections are never copied into Network.

6. **Consumer surfaces**
   - new `#network` desktop/mobile destination;
   - reviewed people grouped by cultural role;
   - reviewed Gallery/Institution cards;
   - public Art Profile and Cultural Organization pages;
   - `#network-me` self-service profile editor with privacy choice and scoped-expertise submission;
   - iPhone navigation expanded intentionally rather than hiding Network behind a generic “More” menu.

7. **Release gates**
   - migration authority extends from 001 through 027;
   - memory contract test covers reviewed identity, pseudonymity, creator claim and scoped expertise;
   - PostgreSQL contract test covers durable profile/expertise and a non-selling Gallery organization;
   - Browser E2E covers pseudonymous collector → review → verified expertise → public Network profile.

### Explicit non-goals for v0.41

- no generic engagement feed;
- no likes as an authority signal;
- no follower-derived expertise ranking;
- no public collector holdings by default;
- no private messaging rewrite;
- no duplicate Artist or Gallery master data;
- no inference that a reviewed Gallery validates an Artwork;
- no inference that a verified expert claim authenticates an Artwork.

---

## 2026-10-03 benchmark delta — community, gallery operations, art discovery and spatial viewing

This delta adds patterns not fully covered by the 2026-10-02 Artsy / Ocula / Art Basel / Smartify / Artlogic benchmark. Sources are used as product-pattern references only.

### ArtRabbit — city art companion, art weeks and visited history

Official references:

- https://www.artrabbit.com/about/app
- https://www.artrabbit.com/support/suggested-and-upcoming-events

Observed product patterns:

- city dashboards around what is new, open now and closing soon;
- exhibitions, openings, festivals and art-week programmes in one interface;
- save/follow;
- “I’ve seen this” / visit history;
- curated neighbourhood routes and self-guided art walks;
- directions between stops;
- upcoming events from followed artists/venues;
- explainable suggested events.

**ADOPT/ADAPT for Antiqua — ANTIQUA-NET-15 Art City / Art Week Companion**

- authoritative entities: Event + Exhibition + Organization + Creator + Auction;
- add `saved / planned / visited` participation states instead of a generic check-in feed;
- build “Today / This week / Closing soon / Open now” read models;
- add Art Week programme and personal day plan after schedule authority is stable;
- allow curated routes built by verified curators/galleries/institutions;
- preserve an explainable “why suggested” link back to Taste/follows;
- later: conflict detection, travel-time sequence and calendar export;
- visit history is private by default.

**DO NOT COPY**

- public visit history by default;
- popularity as artistic-quality ranking;
- location tracking without explicit user action;
- user-submitted events becoming trusted without Organization/Event review.

### ArtPlacer — real-scale room preview, virtual exhibitions and collector presentation

Official references:

- https://www.artplacer.com/virtual-exhibitions/
- https://help.artplacer.com/support/solutions/articles/65000190820-how-to-use-the-augmented-reality-widget

Observed product patterns:

- artwork placement at real scale in a collector’s own room;
- browser/mobile AR handoff;
- 3D virtual exhibitions;
- room mock-ups;
- inquiry/buy actions from a virtual show;
- reusable gallery spaces and exhibition analytics.

**ADOPT/ADAPT for Antiqua — ANTIQUA-NET-16 View on Wall / Private Viewing Space**

- source image, dimensions, frame/border and rights come from Artwork/Media authority;
- room preview is a derived visualization, never a copied Artwork record;
- enforce “real scale” only when physical dimensions are verified enough for display;
- mobile opens camera/AR directly; desktop can hand off to mobile via QR/deep link;
- allow a collector to save a private room composition without publishing collection ownership;
- virtual Exhibition references canonical Artwork IDs and existing Exhibition narrative;
- inquiry/offer routes reuse existing Inquiry/Offer authority;
- interaction analytics may inform UX but never provenance, attribution or expertise.

**GATE**

Do not implement production AR until Media Authority defines approved source image identity, image rights, object dimensions confidence and generated-preview retention policy.

### Google Arts & Culture — Art Projector and Pocket Gallery

Official references:

- https://artsandculture.google.com/play
- https://artsandculture.google.com/project/ar?hl=en-GB

Observed product patterns:

- place artworks at scale in a home;
- augmented-reality gallery spaces;
- use spatial presentation as education/discovery, not only commerce.

**ADOPT/ADAPT**

- keep Antiqua View on Wall useful even for NOT_FOR_SALE works;
- add educational context, technique, artist and provenance entry from the spatial view;
- later allow curated “Pocket Exhibition” experiences built from canonical Exhibition/Collection entities.

### KUNSTMATRIX — reusable 3D spaces and exhibition archive

Official reference:

- https://www.kunstmatrix.com/en

Observed product patterns:

- predefined/custom 3D rooms;
- artwork, sculpture, video and audio in one virtual show;
- share/embed;
- real-scale preview;
- virtual exhibition as an archive/presentation layer.

**ADOPT/ADAPT**

- a 3D room is presentation metadata attached to an Antiqua Exhibition;
- never fork Artwork metadata into the room engine;
- add optional audio-guide nodes from Editorial/Learn authority;
- Exhibition remains useful after closing as a versioned cultural archive;
- support private/unlisted rooms for collector/gallery previews only through ACL.

### ArtCloud — Artist↔Gallery connection, consignment and interest memory

Official references:

- https://help.artcloud.com/knowledge/invite-artists-to-artcloud
- https://help.artcloud.com/knowledge/receive-and-manage-artist-consignments
- https://help.artcloud.com/knowledge/tracking-your-contacts-artwork-and-artist-interests

Observed product patterns:

- gallery invites an artist to connect accounts;
- artist and gallery can share a bounded inventory relationship;
- consignment is an explicit accept/deny workflow;
- galleries retain artwork/artist interests for collector relationship management.

**ADOPT/ADAPT for Antiqua — ANTIQUA-NET-17 Artist↔Gallery Collaboration & Consignment**

- do not create duplicate Artist records when a Gallery connects to an Artist;
- use Creator Graph relationship claim + explicit acceptance;
- add collaboration request types `REPRESENTATION | EXHIBITION | CONSIGNMENT | RESEARCH | EXPERT_REVIEW | LOAN`;
- consignment must have scope, objects, term, territory, sale authority, commission, logistics/condition handoff and immutable acceptance history;
- accepted consignment references canonical Artwork/Object IDs;
- Gallery relationship memory may use explicit Taste/Inquiry/Offer events, but no private collector data is exposed to another Gallery by default.

**DO NOT COPY**

- automatic transfer/copying of inventory masters between Artist and Gallery stores;
- silent CRM interest creation from sensitive/private activity;
- mutable duplicate object records owned separately by each participant.

### MutualArt — cross-context followed-artist alerts

Official reference:

- https://www.mutualart.com/plans

Observed product pattern:

- followed artists can drive alerts spanning auctions, exhibitions, events and market activity.

**ADOPT/ADAPT for Antiqua — ANTIQUA-NET-18 Cultural Watch**

One explicit follow can fan out into bounded notification categories:

- new reviewed Artwork;
- Exhibition/Event;
- Auction lot/result;
- Editorial/Research;
- representation change.

Users choose categories and frequency. Notification relevance is explainable. Watch state never changes authenticity, provenance or expert authority.

### Artsy My Collection — private collection record plus artist/market context

Official reference:

- https://www.artsy.net/collector-profile/insights

Observed product patterns:

- private artwork record;
- collection-level market/artist context;
- artist career/auction context around works already owned.

**ADOPT/ADAPT for Antiqua — ANTIQUA-NET-19 Collection Intelligence**

- extend existing PRIVATE Collection / Collection Records instead of creating “My Collection 2”;
- connect owned works to Artist updates, exhibitions, auction results and conservation/condition timeline;
- keep valuation/market intelligence visibly separate from cultural or authentication evidence;
- support “what changed around my collection?” without making holdings public.

### Resulting unique Antiqua loop

The target loop is not “post → like → follow”. It is:

`Artwork → Artist → Evidence/Research → Gallery/Institution → Exhibition/Event → Save/Visit → Collection → Taste → Alert → Collaboration/Inquiry/Auction → Ownership/Condition → back to cultural context`

This joins discovery, scholarship, professional collaboration, collection memory and commerce while keeping their authorities separate.

### Sequencing after v0.41

1. merge Art Network identity/trust;
2. Event/Exhibition schedule authority + Art Calendar;
3. structured Collaboration Request authority;
4. Artist↔Gallery connection + consignment handshake;
5. bounded Cultural Watch alerts;
6. Collection Intelligence read model;
7. View on Wall after Media/dimensions/rights gate;
8. 3D/AR exhibition presentation only after canonical media reuse is proven.


## Premium enterprise wave — museum-grade loans, exhibitions and movement chain

This wave extends Antiqua from ownership/provenance/condition into serious exhibition and institutional object movement.

### Domain reference — REFERENCE ONLY

Reference implementation/domain inspiration:

https://github.com/collectionspace/services

Use museum collection-management concepts as reference only. Do not copy/integrate code until the exact license and deployment implications are separately reviewed.

### Loan Authority — ADOPT

Create:

- loan ID/type: outgoing / incoming;
- lender/borrower;
- object(s);
- exhibition/event;
- loan period;
- conditions;
- insurance requirements;
- transport requirements;
- rights/reproduction terms;
- approval state;
- documents.

Loan does not change ownership/provenance automatically.

### Object Movement Record — ADOPT

Every physical movement can record:

- object;
- from/to location;
- date/time;
- reason;
- handler/courier;
- crate/package;
- transport provider;
- condition checkpoint;
- evidence;
- custody status.

This creates a chain of custody over physical movement.

### Facility / Venue Assessment — ADOPT

For an exhibition/loan venue store reviewed:

- location/contact;
- environmental/security notes;
- display requirements;
- handling restrictions;
- insurance requirements;
- facility-report reference;
- reviewer/date.

Do not pretend a form result is a formal institutional accreditation unless such authority exists.

### Condition-at-Movement Gate — ADOPT

Before dispatch and after arrival/return:

- exact condition-report version;
- image set;
- damage/change observations;
- crate/seal state;
- reviewer;
- acceptance/sign-off.

Reuse the existing Condition Change Intelligence and image-region annotations.

### Insurance / Valuation Reference — ADOPT

Store only the necessary loan-specific reference:

- insurer/broker reference;
- insured value/date/currency;
- policy/certificate reference;
- coverage period;
- private/public visibility.

Antiqua does not become an insurer or appraisal authority.

### Exhibition Timeline — ADOPT

Flow:

loan request -> approval -> packing -> dispatch -> arrival -> installation -> exhibition -> deinstallation -> return -> condition closeout

Every stage has owner/evidence.

### Additional acceptance

- loan/movement never silently changes provenance/ownership;
- every custody handoff is timestamped/evidenced;
- dispatch/return condition uses exact report/image versions;
- private insured values are ACL-controlled;
- exhibition history can be published separately from private logistics;
- movement chain remains auditable after return.

**Sequencing:** Object/Condition/Media/Provenance -> Loan -> Movement -> Condition checkpoints -> Exhibition -> Return/closeout.

**Commercial framing:** this makes Antiqua credible for galleries, institutions, collectors and insurers managing real-world loans/exhibitions, not only digital records.

## Moat wave — Catalogue Raisonné and artist-estate platform

This wave opens a premium institutional market for artist estates, foundations, scholars, galleries and catalogue-raisonné committees.

### Canonical Work Registry — ADOPT

Create a scholarly work record distinct from marketplace listing:

- canonical work ID;
- title(s);
- creator/attribution state;
- date/date range;
- medium/support;
- dimensions;
- inscriptions/marks;
- edition/state where applicable;
- provenance;
- exhibition history;
- bibliography;
- related works;
- images;
- current catalogue status;
- committee/reviewer state.

A marketplace/dealer listing may reference the canonical work but never becomes the scholarly authority.

### Attribution State — ADOPT

Support controlled states such as:

- accepted;
- attributed to;
- workshop/studio;
- circle/follower;
- formerly attributed;
- rejected/not accepted;
- under review;
- insufficient evidence.

Every state has:

- decision authority;
- effective date;
- supporting evidence;
- prior state;
- public/private note.

Do not collapse nuanced scholarly attribution into one authenticity boolean.

### Edition / State / Variant Authority — ADOPT

For prints, multiples and editioned works, support:

- edition;
- state;
- plate/block/version;
- proof type;
- impression;
- numbering;
- known copies;
- relationship to canonical work.

This is separate from ownership/provenance.

### Submission Portal — ADOPT

Owners/dealers/institutions can submit a candidate work:

submission -> identity/contact -> object facts -> images/docs -> provenance -> requested question -> fee/admin state if applicable -> triage -> expert review -> additional evidence request -> decision

Submission never automatically becomes a public catalogue record.

### Committee / Expert Review — REUSE

Reuse Expert Attribution Board:

- independent opinions;
- blind phase where appropriate;
- evidence requests;
- disagreement matrix;
- final authorised decision.

### Scholarly Publication Layer — ADOPT

Publish approved catalogue records through:

- public web record;
- IIIF media;
- Linked Art JSON-LD projection;
- stable canonical URL/identifier;
- citation block;
- revision/publication date.

Private owner/location/insurance data remains excluded.

### Revision / Supersession History — ADOPT

Catalogue records are living scholarship.

Every material change creates:

- new revision;
- reason;
- evidence;
- reviewer/committee;
- public change note where appropriate;
- superseded version preserved.

### Research Corpus Moat — ADOPT

The defensible asset grows from:

canonical works + provenance + exhibition + bibliography + expert decisions + image regions + condition + related works

This corpus can support later research tools while keeping scholarly decisions human-authorised.

### Additional acceptance

- scholarly work identity is separate from sales/listing identity;
- attribution changes preserve full history;
- submissions remain private until publication;
- public record exposes only approved fields;
- Linked Art/IIIF outputs rebuild from canonical data;
- committee decision cannot be replaced by similarity/AI score.

**Sequencing:** Object/Provenance/Expert/IIIF/Linked Art -> Work Registry -> Submission Portal -> committee workflow -> scholarly publication -> revision history.

**Commercial framing:** Antiqua can be sold as infrastructure for artist estates, foundations and serious catalogue-raisonné projects, creating a unique long-term research dataset.

## 2026-10-05 implementation checkpoint — Cultural Calendar v0.42

Implementation branch:

- `feature/cultural-calendar-v42`

### Product boundary

v0.42 turns the former “Events = Exhibitions” navigation alias into a real cultural-programme authority.

It does **not** create a second Exhibition master.

Canonical model:

`Organization / Art Profile → Exhibition → Cultural Event → personal Saved / Planned / Visited → ICS`

### Implemented

1. **Cultural Event authority**
   - event types include opening, artist talk, curator tour, lecture, workshop, auction preview, auction, fair day, private view, book launch, research session, screening and performance;
   - title/summary/description are bilingual;
   - physical / online / hybrid venue modes;
   - explicit IANA timezone;
   - optional canonical Organization, Organization Location and Exhibition links;
   - optional Creator/Object relationships;
   - source URL, booking URL, admission note, accessibility and capacity fields;
   - substantive edits return the event to `DRAFT`.

2. **Reviewed publication**
   - `DRAFT → REVIEW_PENDING → PUBLISHED`;
   - Organization members can author within their authority;
   - independent authors require a reviewed Art Profile;
   - public events may not expose a private Organization Location;
   - cancelled events leave the active public schedule.

3. **Exhibition schedule hardening**
   - existing `exhibitions` table remains canonical;
   - adds Organization / public location / timezone / official source / booking URL;
   - adds separate `publication_status` so lifecycle status and review status are no longer conflated;
   - open-ended LIVE exhibitions remain open when `ends_at IS NULL`.

4. **Private personal calendar state**
   - `SAVED | PLANNED | VISITED`;
   - history belongs to the account;
   - no public check-in feed;
   - no background location tracking;
   - database trigger prevents orphan participation records.

5. **Conflict detection**
   - overlaps are computed only for exact-time `PLANNED` entries;
   - Antiqua reports the collision but never auto-removes a user choice.

6. **ICS**
   - individual public event export;
   - personal plan export;
   - direct `text/calendar` response, not JSON-wrapped calendar text.

7. **Consumer surface**
   - `#events` becomes Art Calendar;
   - Today / next seven days / exhibitions / later programme;
   - My Plan rail;
   - plan-conflict panel;
   - event detail;
   - responsive iPhone/tablet/desktop layout.

### Explicit non-goals

- no public live-location history;
- no “who is here now” mechanic;
- no engagement-ranking of cultural importance;
- no duplicate Exhibition or Gallery records;
- no automatic import of unreviewed third-party events;
- no inferred attendance;
- no ticketing/payment authority duplication.

---

## 2026-10-05 benchmark delta — private presentation and collector intent

### Artlogic — Wishlist → grouped enquiry

Official reference:

- https://support.artlogic.net/hc/en-gb/articles/30125406010908-31st-August-2026-Release-Notes

Observed 2026 pattern:

- visitors save multiple artworks;
- one enquiry can include the complete saved set;
- the enquiry can feed the gallery’s existing contact workflow rather than generating isolated one-work messages.

**ADOPT/ADAPT — ANTIQUA-NET-20 Interest Set → Structured Inquiry**

Use existing authorities:

`Saved Artwork IDs → temporary Interest Set → one Inquiry with line items → Gallery/Dealer Inbox`

Rules:

- never create duplicate Artwork records;
- preserve item-level commercial availability at send time;
- snapshot price/availability context into the inquiry while retaining canonical Artwork IDs;
- gallery sees why each item is present;
- collector can remove individual works before submit;
- no silent CRM profile enrichment from private browsing.

### Artlogic — Private Views / Dynamic Private Views

Official references:

- https://support.artlogic.net/hc/en-gb/articles/17337147499036-How-to-create-Private-Views
- https://support.artlogic.net/hc/en-gb/articles/21575664444700-NEW-How-to-set-up-Dynamic-Private-Views-Beta
- https://support.artlogic.net/hc/en-gb/articles/14248526908188-An-introduction-to-Private-Views-and-the-Artlogic-app

Observed patterns:

- unique unguessable presentation links;
- artwork selections can remain linked to current database information;
- private presentations are shareable from gallery workflows;
- iPhone/iPad presentation mode is useful at fairs and can operate offline.

**ADOPT/ADAPT — ANTIQUA-NET-21 Private Viewing Pack**

A Private Viewing Pack is an ACL presentation over canonical records:

- Artwork IDs;
- optional Exhibition/Collection narrative;
- recipient/access policy;
- expiration;
- selected price visibility;
- selected provenance/condition visibility;
- enquiry/offer CTA;
- immutable send snapshot + live-current-data indicator.

Do not copy the Artwork master into the pack.

Offline mode, when added, must cache only explicitly allowed fields and must support expiry/revocation semantics.

### Artlogic — View on a Wall

Official reference:

- https://support.artlogic.net/hc/en-gb/articles/360021545340--View-on-a-wall-for-Private-Views-Beta

Confirmed prerequisite pattern:

- source image;
- physical artwork width/dimensions;
- optional alternate framed/matted image.

This reinforces the existing Antiqua gate:

`Media rights + verified dimensions → derived room preview`

No production View on Wall should be enabled for an object whose display dimensions are unresolved.

### Vortic — virtual exhibition as reusable presentation layer

Official reference:

- https://vortic.art/

Observed pattern:

- galleries/institutions curate and publish exhibitions across web/mobile;
- AR is a presentation surface;
- exhibitions can be revisited after the physical moment.

**ADOPT/ADAPT**

- keep the canonical Antiqua Exhibition useful before, during and after the physical show;
- presentation/AR layers reference the Exhibition and Artwork authorities;
- archived Exhibition remains a cultural record rather than becoming a dead campaign page.

### Sequencing after v0.42

1. Cultural Calendar merge;
2. Art Week / Fair Programme grouping + personal day plan;
3. Collaboration Request authority;
4. Artist↔Gallery representation / consignment handshake;
5. Interest Set → Structured Inquiry;
6. Private Viewing Pack;
7. Cultural Watch;
8. Collection Intelligence;
9. View on Wall only after Media/dimensions/rights gate.

## Platform economics wave — Institutional Research and Provenance API

This wave turns Antiqua's provenance, attribution, IIIF, Linked Art and catalogue-raisonné corpus into controlled research infrastructure for museums, foundations, estates, scholars and insurers.

### Research API — ADOPT

Expose only public or explicitly shared resources:

- canonical work record;
- creator/authority links;
- provenance events;
- exhibition history;
- bibliography;
- published attribution state;
- approved condition/public media;
- IIIF manifests;
- Linked Art projection;
- rights/access state.

Private owner/location/insurance/dealer information remains excluded unless explicitly authorised.

### Provenance Query API — ADOPT

Support questions such as:

- works connected to a person/institution;
- provenance gaps;
- auction/sale events;
- date/place ranges;
- source-backed event chains;
- related works/versions;
- disputed provenance events.

Every result exposes evidence/provenance status rather than a flattened unqualified assertion.

### Institutional Federation — ADOPT

Allow partner institutions to map identifiers:

external institution ID -> Antiqua canonical object/person/place -> reviewed mapping

No automatic merge based only on name similarity.

### Institutional Submission API — ADOPT

Approved partner systems can submit candidate:

- identifier mappings;
- provenance source;
- exhibition reference;
- bibliography;
- IIIF manifest;
- correction proposal.

All submissions enter staging/review. They never directly rewrite canonical scholarly state.

### Change / Publication Feed — ADOPT

Provide signed/versioned events for:

- work revision;
- attribution change;
- provenance event correction/addition;
- IIIF update;
- rights/access change;
- catalogue record superseded.

This allows museums/estates to keep local systems synchronized incrementally.

### Research Access Tiers — ADOPT

Scopes:

- Public API;
- Registered Research;
- Institutional Partner;
- Estate/Foundation;
- Private Shared Collection.

Each maps to explicit fields/resources.

### Citation / Data License Contract — ADOPT

Define:

- permitted use;
- attribution/citation;
- redistribution;
- media-right constraints;
- quota;
- correction/withdrawal handling;
- version citation.

Antiqua never licenses rights it does not own.

### Institution Connector SDK — ADOPT

Provide contract-first helpers for:

- IIIF ingestion;
- Linked Art exchange;
- CSV/JSON identifier mapping;
- change-feed consumption;
- source/citation upload.

The SDK cannot bypass staging/review.

### Additional acceptance

- every assertion carries source/status where applicable;
- private facts cannot leak through graph traversal;
- identifier mapping is reviewed;
- change feed preserves revision identity;
- media rights remain separate from metadata access;
- partner access can be revoked without corrupting public history.

**Sequencing:** Catalogue Raisonné + Linked Art/IIIF + Rights -> Research API -> federation -> submissions -> change feed -> SDK/licensing.

**Commercial framing:** Antiqua becomes reusable cultural-heritage research infrastructure and a licensable provenance knowledge layer.

## Defensibility wave — Provenance Evidence Passport and scholarly trust graph

This wave creates a durable scholarly trust layer over provenance, catalogue-raisonné, expert review and institutional federation.

### Provenance Evidence Passport — ADOPT

For a canonical work, create a machine-readable provenance package with:

- canonical work ID/revision;
- attribution state;
- provenance events;
- event source/evidence;
- confidence/review state;
- exhibition/bibliography references;
- image/document evidence;
- unresolved gaps;
- rights/publication state;
- passport version/hash.

The passport is a scholarly evidence package, not an authenticity certificate.

### Provenance Evidence Classes — ADOPT

Every provenance assertion is explicitly classified, for example:

- primary document;
- institutional record;
- auction/dealer record;
- scholarly publication;
- owner/dealer statement;
- expert interpretation;
- machine/OCR candidate;
- unresolved/unverified.

No source class silently upgrades to verified fact.

### Scholarly Contributor Trust Graph — ADOPT

Graph:

expert/scholar/institution -> reviewed work/event/source -> opinion/decision -> publication/revision

Useful factual dimensions:

- verified identity/affiliation;
- reviewed submissions;
- catalogue committee role;
- field/topic expertise;
- completed institutional contributions;
- disclosure status;
- recency.

No popularity score or "best expert" ranking.

### Scoped Scholarly Credential — ADAPT

Use verifiable-credential-compatible attestations for narrow roles such as:

- Catalogue Committee Member for project X;
- Institutional Contributor;
- Provenance Review Participant;
- IIIF/Linked Art Integration Partner.

Credential proves role/scope, not correctness of scholarly conclusions.

### Evidence Gap Index — ADOPT

For each work show explicit unresolved gaps:

- missing ownership period;
- unsupported exhibition claim;
- uncertain attribution event;
- missing source image/document;
- conflicting literature.

The system can prioritize research but cannot fabricate the missing event.

### Independent Verification Surface — ADOPT

A museum/estate/researcher can verify a passport/version and inspect public source references without receiving private owner/dealer data.

### Additional acceptance

- passport preserves unresolved/conflicting evidence;
- source class remains visible;
- contributor graph contains factual activity only;
- no AI similarity score is treated as provenance proof;
- credentials have explicit project/role scope;
- private provenance evidence is excluded from public verification.

**Sequencing:** Catalogue Raisonné + Provenance API + Expert Board -> evidence classes -> passport -> contributor graph -> credentials -> verification.

**Moat:** the compound scholarly corpus becomes more valuable with every reviewed provenance event, expert decision and institutional contribution.



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


## 2026-10-07 — Scholarly Attestation Trust Runtime

The attestation layer must preserve scholarly disagreement. External signatures authenticate who made an assertion and against which revision; they do not make the assertion true.

### Standards baseline

- W3C Verifiable Credentials Data Model 2.0: https://www.w3.org/TR/vc-data-model-2.0/
- W3C Bitstring Status List v1.0: https://www.w3.org/TR/vc-bitstring-status-list/
- OpenID4VCI / OpenID4VP for scoped contributor credentials;
- OpenID Federation 1.0 for bounded institutional trust networks.

### Institution / Expert Key Lifecycle — P0

Persistent issuer metadata:

`PROVISIONED -> ACTIVE -> VERIFY_ONLY -> RETIRED / COMPROMISED`.

Every attestation binds to:

- issuer;
- key;
- immutable passport revision;
- assertion type/scope;
- evidence reference;
- issued_at;
- credential hash.

Normal key rotation must not destroy historical scholarly verification.

### Signed Attestation Status — P0

Expose machine-readable current status:

- ACTIVE;
- REVOKED;
- HISTORICAL;
- ISSUER_SUSPENDED;
- KEY_COMPROMISED.

The status surface must not expose private owner/dealer evidence.

### Scholarly Presentation Protocol — P1

A museum/estate/researcher should be able to present the minimum required proof:

- institutional affiliation;
- committee role;
- scoped review participation;
- exact attestation.

OpenID4VP-compatible presentation can be supported where useful, without requiring a consumer wallet for normal web verification.

### Institutional Federation — P1

For consortium research, define which institutions may issue which role credentials.

Federation trust never means:

- automatic canonical overwrite;
- universal authenticity authority;
- access to private collection data.

### Attestation Transparency Log — P1

Create an append-only public-safe log containing hashes/metadata of:

- received attestation;
- revoke;
- key rotation;
- revision supersession.

Purpose: prove chronology and detect silent historical rewriting. Private evidence content stays outside the public log.

### Research Agent Verification API — P1

AI/research agents may query:

`work -> current revision -> assertions -> conflicts -> source classes -> attestations -> gaps`.

Every machine answer must preserve:

- canonical vs contested vs unverified;
- source class;
- revision;
- evidence gap;
- current/historical attestation state.

Agent output can propose research tasks but never fabricate missing provenance.

### Institutional Due-Diligence Room — P1

For a museum, insurer, lender, collector or estate, produce a scoped dossier:

- public passport;
- permitted private evidence;
- active/historical attestations;
- conflicts/gaps;
- rights state;
- revision chain;
- verification receipt.

Access is purpose/role scoped and fully audited.

### Commercial products

- institutional verification API;
- catalogue-raisonné trust workspace;
- museum/estate federation gateway;
- private due-diligence room;
- insurer/lender provenance package;
- scholarly contributor credential service;
- licensed research-agent API.

### Acceptance gate

- SUPPORT and CONTRADICT coexist without winner mutation;
- key rotation preserves old signature verification;
- revoked attestation remains in historical graph;
- new passport revision makes prior scoped assertions historical, not deleted;
- public log contains no private owner/dealer evidence;
- research-agent responses preserve uncertainty and evidence gaps.

**Economic effect:** Antiqua can monetize institutional research, due diligence, verification and federation while its defensibility compounds through signed scholarly history rather than opaque authenticity scoring.


## 2026-10-07 implementation checkpoint — Paintings-only product contract

**Status: ACTIVE IMPLEMENTATION**

This checkpoint supersedes every earlier recommendation in this document that treated standalone drawing, graphics, engraving, printmaking or generic works on paper as public ANTIQUA product categories.

Authoritative product scope:
`PAINTINGS_ONLY`

Allowed public categories:
- painting;
- watercolor;
- gouache;
- tempera;
- pastel;
- acrylic painting.

Explicitly excluded from ingestion/publication/public discovery:
- standalone drawing;
- etching/engraving/lithography/printmaking;
- sculpture;
- decorative art;
- furniture;
- ceramics/porcelain;
- jewelry/silver;
- clocks/watches;
- manuscripts;
- generic antiques.

Architecture rule:
`legacy Object Authority -> internal artwork identifier compatibility only`.
It must not be used to justify reopening a generic antiques/object marketplace.

Required enforcement:
`seller ingestion -> draft editing -> submit -> catalogue review -> publish -> public catalogue -> seller inventory -> Artwork Passport -> Taste Graph`.

Research/institutional layers remain valid, but their subject domain is now paintings:
`Artwork Passport -> Provenance -> Evidence -> Scholarly Contributions -> Scoped Credentials -> Independent Verification -> Research Interchange -> Institutional Contributors`.

Commercial and cultural layers remain:
`Gallery -> Artist -> Collection -> Exhibition/Event -> Research -> Private Sale/Auction`,
but only for artworks inside the paintings-only domain.

Acceptance:
1. no legacy antique seed cards remain in public/demo catalogues;
2. non-painting drafts fail with `PAINTING_CATEGORY_REQUIRED`;
3. public catalogue and recommendations cannot expose excluded categories;
4. auctions may only surface lots whose artwork is in scope;
5. master plan, UI copy and onboarding taxonomy use the same scope;
6. research uncertainty/provenance rules are unchanged: narrowing the product domain must never imply stronger authenticity claims.


## 2026-10-07 implementation checkpoint — v0.51 Artwork Experience Cleanup

**Scope:** paintings-only product language + unified Artwork Dossier read-model.

### Decisions

- Public UX uses **Artwork / Painting / Gallery / Fine Art Dealer** terminology. Internal `objectId` and Object Authority remain technical compatibility identifiers only.
- Artwork Dossier is a **derived public read-model** over existing authorities. It is not a new writable authority and introduces no migration.
- Dossier composes:
  - Artwork Passport / revision history;
  - Provenance Evidence Passport, including conflicts and evidence gaps;
  - published Scholarly Contributions;
  - scoped Scholarly Credentials valid at the time of review;
  - authoritative closed-auction Market History;
  - current sale/auction state from existing Product/Auction authorities;
  - Related Works, IIIF and Research Interchange links.
- Scoped credential proves role/scope only. It never certifies correctness of a scholarly conclusion, attribution or artwork authenticity.
- Published scholarly contribution records factual participation/opinion. It does not become an authenticity certificate.
- Market History includes only authoritative closed-auction outcomes. Current asking price/live bid state and comparables remain separate concepts.
- Consumer UI remains image-first. Research depth is progressive disclosure and must remain usable on monitor, tablet and phone.
- No universal expert score, popularity score or hidden trust ranking is introduced.

### v0.51 acceptance

1. public terminology is Artwork-first across Gallery, Inquiry, Collection, Related Works, Viewing and professional analytics;
2. `GET /api/lots/:id/dossier` returns the derived research projection without creating a new authority;
3. provenance conflicts/gaps remain explicit;
4. credentials-at-review are time-bounded and carry explicit non-certification assertions;
5. market history does not reuse current asking price;
6. responsive browser journey passes on desktop and mobile Chromium;
7. CI + Browser E2E must be green before merge.

### Post-v0.51 sequence

After v0.51 is green and merged, return to the production-admission chain:

`PostgreSQL admission -> /api/ready=READY -> Synthetic Reference Catalogue smoke -> Independent Verification smoke -> Research Interchange smoke -> Institutional Contributors`.

Institutional Contributors must extend Organization / Scholarly Contribution / Credential authorities rather than creating a second institutional identity system.


## 2026-10-08 implementation checkpoint — v0.52 Production Admission Startup Bootstrap

**Status:** merged to main and live on Render.

### What v0.52 changes

- Render web startup is routed through `scripts/start-v52.mjs`.
- Default startup behavior is unchanged when `ANTIQUA_MIGRATE_ON_START` is not enabled.
- `ANTIQUA_MIGRATE_ON_START=true` is an explicit operator-controlled bootstrap for production admission only.
- When enabled, startup requires `DATABASE_URL`, applies the canonical migration manifest before importing server/runtime, and aborts startup on migration failure.
- Runtime remains externally managed: `ANTIQUA_EXTERNAL_MANAGED_SCHEMA=true` still prevents normal runtime auto-migration.
- This removes the dependency on an interactive Render shell for the production migration pass.

### Current production state

- Canonical code state after merge: `main=e509caf7ea70274913a57f5b47766aba960a290a`.
- Render live deploy is running the same v0.52 code.
- Last verified runtime persistence is `MEMORY_FALLBACK`.
- Dedicated `antiqua-postgres` is still the only acceptable production database.
- Do not bind `mfw-postgres`, Marco Pescarolo Postgres, or any other project database to Antiqua.
- Do not set `PREVIEW_MODE=false` before the dedicated `DATABASE_URL` is bound and migrations are proven exact.
- Render auto-deploy must not be trusted implicitly; verify the exact deployed Git SHA after every production-changing merge.

### Production admission sequence

The next operation is strict and must not be bypassed:

`dedicated antiqua-postgres DATABASE_URL`
→ `ANTIQUA_MIGRATE_ON_START=true`
→ deploy exact current `main`
→ migration manifest `001–033`
→ verify exact `schema_migrations` with no missing/unexpected versions
→ `ANTIQUA_MIGRATE_ON_START=false`
→ `PREVIEW_MODE=false`
→ final deploy exact current `main`
→ runtime `persistence=POSTGRES`
→ `GET /api/ready = 200 / READY`
→ restart durability proof
→ Synthetic Reference Catalogue smoke
→ Independent Passport Verification smoke
→ Research Interchange smoke
→ Institutional Contributors.

### Production admission acceptance

Production admission is complete only when all of the following are simultaneously true:

1. runtime persistence is `POSTGRES`;
2. `DATABASE_URL` points to the dedicated Antiqua database;
3. preview mode is disabled;
4. external managed schema mode remains enabled;
5. applied migrations are exactly the canonical `001–033` manifest;
6. `/api/ready` reports `READY` with no blockers;
7. restart does not lose authoritative state;
8. Reference Catalogue, Independent Verification and Research Interchange smoke checks pass on the admitted deployment.

Until this gate is complete, do not start Institutional Contributors implementation. Read-only design review and master-plan maintenance are allowed, but no new institutional authority may be introduced.


## 2026-10-08 production admission evidence refresh

**Status: BLOCKED BY DEDICATED DATABASE CREDENTIAL / ACCOUNT ACCESS**

This checkpoint records observed production evidence and does not change product scope or authority boundaries.

### Verified code and live runtime

- GitHub canonical `main`: `39ca58e94490ceb058c67dc1e1625bb5ea616c68`.
- Current Render service: `antiqua-preview` / `srv-dakjr0ad0e5s73e7ijp0` in workspace `ME`.
- Current Render live deploy still runs `e509caf7ea70274913a57f5b47766aba960a290a` (v0.52 startup bootstrap).
- The difference between current GitHub `main` and the live deploy is documentation-only PR #126; production admission must nevertheless use the exact current `main` when the database binding is available.
- Live startup executes `node scripts/start-v52.mjs`.

### Machine-readable readiness evidence

Observed from `GET https://antiqua-preview.onrender.com/api/ready`:

- admission status: `BLOCKED`;
- `productionReady=false`;
- runtime persistence: `MEMORY_FALLBACK`;
- `databaseConfigured=false`;
- `previewMode=true`;
- `externalManagedSchema=true`;
- expected migration count: `33`;
- expected migration head: `033_v46_independent_passport_verification`;
- applied migration count/head: unavailable until PostgreSQL is configured;
- blockers:
  - `DATABASE_URL_MISSING`;
  - `PERSISTENCE_NOT_POSTGRES`;
  - `PREVIEW_MODE_ENABLED`.

This is the expected safe failure state. It must not be bypassed or reclassified as production-ready.

### Dedicated database identity evidence

**Correction recorded 2026-10-09:** the previously recorded Supabase ref `yutrntnncubcssqbohco` is not an approved Antiqua identifier and must not be used for Antiqua. Independent project evidence associates that ref with another project's database authority. The earlier Antiqua association was not backed by a primary Supabase project response, database host, pooler identity, or creation receipt.

The durable database requirement remains unchanged:

- Antiqua must use its own dedicated PostgreSQL project;
- historical labels such as `antiqua-postgres` and `mercury-moda` are discovery hints only until returned by fresh Supabase metadata;
- the actual Antiqua project ref is currently **UNCONFIRMED**;
- no DDL, migration, test query, runtime binding, backup, or restore may target `yutrntnncubcssqbohco` on behalf of Antiqua.

Current connected Supabase tooling still exposes only the currently authenticated organization/projects and does not expose a verified dedicated Antiqua project. Those visible projects must not be reused.

The connected Render workspace contains `mfw-postgres` as a Render-managed PostgreSQL instance. It is explicitly prohibited for Antiqua and must not be bound to this service.

Canonical database identity rules are now maintained in `docs/ANTIQUA_DATABASE_IDENTITY_GATE_2026-10-09.md`.

### Network / connection-mode decision

For Render application traffic to Supabase, use the dedicated Antiqua **Shared Pooler / Supavisor session-mode** connection string on port `5432` when obtaining the production `DATABASE_URL`. This is the appropriate Supabase mode for a persistent backend on an IPv4-only network such as Render.

Do not commit the connection string or database password to GitHub, this plan, logs or test fixtures.

### Strict recovery and admission sequence

No product or institutional expansion is allowed before this exact chain completes:

`restore Supabase access and rediscover the dedicated Antiqua project from fresh primary metadata`
→ `prove project identity and schema lineage read-only`
→ `copy the confirmed project's dedicated Session pooler DATABASE_URL`
→ `bind DATABASE_URL to Render antiqua-preview`
→ `ANTIQUA_MIGRATE_ON_START=true`
→ capture exact current `main` SHA at binding time
→ deploy that exact SHA
→ prove canonical migrations `001–033 exact`
→ verify `schema_migrations` has no missing/unexpected versions
→ `ANTIQUA_MIGRATE_ON_START=false`
→ `PREVIEW_MODE=false`
→ final deploy the same captured SHA
→ `persistence=POSTGRES`
→ `/api/ready = 200 / READY`
→ restart durability proof
→ Synthetic Reference Catalogue smoke
→ Independent Passport Verification smoke
→ Research Interchange smoke
→ only then Institutional Contributors.

### Stop rules

- Do not create a replacement Render Postgres for convenience.
- Do not bind `mfw-postgres`, Marco Pescarolo PostgreSQL, or any other project's database.
- Do not enable migration-on-start before the correct dedicated project identity is proven and its `DATABASE_URL` is present.
- Do not disable preview mode before migrations are proven exact.
- Do not start Institutional Contributors implementation while `/api/ready` is blocked.
- Do not broaden product scope: authoritative public scope remains `PAINTINGS_ONLY`.
