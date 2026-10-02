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

**Implementation instruction:** real pilot evidence first; integrations deepen the object/provenance product afterwards.


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

