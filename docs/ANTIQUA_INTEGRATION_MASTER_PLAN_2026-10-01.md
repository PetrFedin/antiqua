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
