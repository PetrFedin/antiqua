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

**Decision:** Antiqua is now oriented first around paintings and works on paper: painting, drawing, graphics, engraving, printmaking and adjacent visual-art categories. The reset is product-level, not a technical rewrite.

### Public product promise
**Discover art → understand the work and artist → learn → save/collect → attend → bid/buy when relevant.**

Primary public journey:
`Home → Gallery → Artwork → Artist → Related Works → Save → Collection → Personalized Discovery`

Extended cultural journey:
`Artwork/Artist/Theme → Books → Courses → Events/Exhibitions → deeper discovery`

Commercial journey:
`Artwork → Auction lot → Watch → Bid → Result → Collection/ownership record`

### Public information architecture
1. **Gallery** — image-first discovery of paintings, drawings, graphics, engravings and prints.
2. **Artists** — creator pages, periods, works, exhibitions, editorial context and related artists.
3. **Artworks** — high-quality media, object facts, provenance/research depth, related works and auction state where applicable.
4. **Collections** — saved works, personal/private collections, curated/public collections and collection records.
5. **Learn** — books about painting/artists/movements, courses/lectures and editorial material.
6. **Events** — exhibitions, lectures, courses, viewings and cultural events linked to artists/works/themes.
7. **Auction** — Antiqua's existing auction authority surfaced as a native art-market action, not a separate product.
8. **For professionals** — dealer/pilot/evidence tools remain available only as a secondary/backstage professional surface.

### Scope boundary
Initial taxonomy prioritizes:
- painting;
- drawing;
- graphics;
- engraving;
- etching;
- lithography;
- woodcut/linocut;
- screenprint and other artist prints;
- watercolor/gouache/pastel and related works on paper.

Sculpture, decorative art, photography and other object categories may remain technically supported but do not define the initial public positioning.

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
2. painting/works-on-paper taxonomy;
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

Merged through Gallery-first PR #86 and Artist-depth PR #88 after independent CI + Browser E2E green gates.

- Artist profile projection now exposes research context only from explicit creator metadata: evidence status, biography sources and chronology.
- Public exhibition context is derived only from PUBLIC/SCHEDULED/LIVE/ARCHIVED exhibitions that actually contain a published work linked to the creator.
- Artist works retain the existing creator_object_links authority and are grouped in the UI by explicit technique, falling back to explicit period only when technique is absent.
- Related Works rendering is extracted into a reusable gallery component; ranking still comes exclusively from v18 explainable similarity.
- No free-text catalogue maker is promoted into creator identity, chronology or biography.
- No artist research field is inferred from browsing behavior or generated text.
- Dealer/pilot infrastructure remains preserved but absent from primary consumer navigation.

### Exit gate for this checkpoint — SATISFIED 2026-10-02

- Gallery-first PR #86 merged green to main as f85af36e8a55e7e819b8d799cb85f55e4f27b4fb.
- Artist-depth PR #88 merged green to main as 174bc58652cdba9c93c17eaa48fd7463fc596f4d.
- CI, PostgreSQL durability, object-storage, and desktop/mobile Browser E2E passed.
- Collections/Taste is now the active next product slice.

## 2026-10-02 implementation checkpoint — Collections + Taste

**Active issue:** #75.

This layer productizes existing authorities. It does not create a new collection store, recommendation database, or opaque ranking service.

### Authority reuse
- Saved works: existing account object flags.
- My Collections: existing Collection Graph and /api/collections/mine.
- Public collections: only explicitly public Collection Graph records.
- Personalized discovery: existing v28 /api/taste/recommendations.
- Negative feedback: existing immutable DISMISSED Taste events.
- Ownership, storage, insurance, and appraisal remain in private Collection Records.

### Consumer surface
The #collections route becomes the Gallery-first retention hub:

Saved Works → My Collections → Explainable For You → Public Collections.

Rules:
- new personal collections default to PRIVATE;
- PUBLIC is an explicit choice;
- saved/collected/purchased works are not presented as new discoveries;
- recommendation reasons are human-readable and raw affinity points are not shown as a quality or authenticity score;
- price is not a Taste matching input;
- private notes, storage, insurance, and owner identity are not exposed in public/taste cards;
- first-time “Add to collection” routes into Collections rather than professional operations UI.

### Current implementation
- consumer module public/modules/collections-taste.js;
- image-first Saved Works and collection cards;
- server-backed explainable recommendations;
- bounded “Not for me” using the existing Taste Graph;
- PRIVATE collection creation from the consumer surface;
- Browser E2E covers Save → Collections → PRIVATE collection → add artwork → recommendation exclusion → dismiss;
- dealer/pilot remains backstage.

### Exit gate
Books/Courses/Events (#76) may begin only after:
1. #75 CI is green;
2. PostgreSQL durability and object-storage gates remain green;
3. desktop and mobile Browser E2E pass the Collections/Taste Golden Path;
4. PRIVATE collection non-disclosure is verified;
5. saved/collected works are proven excluded from new-discovery recommendations.

Only then advance to the cultural-content graph.

