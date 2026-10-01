# Antiqua — Integration Master Plan

**Status:** PLANNED  
**Date:** 2026-10-01  
**Canonical file:** `docs/ANTIQUA_INTEGRATION_MASTER_PLAN_2026-10-01.md`

## Purpose
Strengthen Antiqua after the real dealer-pilot foundation without creating a second evidence authority or bypassing v0.37-v0.40 governance.

## Mandatory prerequisite
Before new product waves:
1. deploy current exact head;
2. connect Antiqua's **own dedicated durable PostgreSQL**;
3. apply and prove current migrations;
4. prove persistence=POSTGRES;
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
No new integration may delay the first dealer engagement or create a competing pilot/evidence authority.

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
1. ANTIQUA-INT-00 Dedicated DB + real engagement
2. ANTIQUA-INT-01 Object Media Authority
3. ANTIQUA-INT-02 IIIF/Mirador
4. ANTIQUA-INT-03 OCR
5. ANTIQUA-INT-04 Reconciliation
6. ANTIQUA-INT-05 Provenance graph
7. ANTIQUA-INT-06 Similarity
8. ANTIQUA-INT-07 C2PA
9. ANTIQUA-INT-08 Photogrammetry gate
10. ANTIQUA-INT-09 Credential/passport gate

**Implementation instruction:** real pilot evidence first; integrations deepen the object/provenance product afterwards.
