# ANTIQUA — Decision Dossier + Private Rooms

**Product priority:** P1; **execution:** BLOCKED by dedicated PostgreSQL production-admission P0 (001–033, restart durability and restore).
**Decision date:** 2026-10-13. **Competitive inspiration:** ARCOO study, adapted to Antiqua rather than copied.

## Positioning and boundary

Antiqua is a painting-first gallery and professional research platform. This epic covers existing painterly works only (oil, acrylic, tempera, watercolor, gouache and pastel painting). Do not add generic antiques, furniture, sculpture, real estate, or a competing visual marketplace.

An Artwork remains the canonical object/passport authority. The Dossier and Room are authorized, versioned projections of existing research and commercial authorities — never a parallel passport, provenance system, auction record or media database.

## Why this first after P0

A buyer/collector considering a substantial purchase needs defensible attribution, provenance, condition, valuation context and a confidential decision path. A professional seller needs selective disclosure, accountable counterparties and proof of engagement. Existing Artwork Dossier, Independent Passport Verification, scholarly trust, collection, media, inquiry/offer and audit modules already cover much of the authority. This epic composes them into a single high-trust journey.

These are product hypotheses until measured; do not claim a conversion uplift without production cohort evidence.

## Decision Dossier — public/private projection

One dossier per Artwork and material revision; versions are immutable snapshots with references to canonical authority revisions. Required sections:

1. Visual identity: approved original/derivative image, artist/school attribution, title, medium, date, dimensions, accession/identifiers. Source: existing artwork passport and Media Authority.
2. Attribution: current classification, contributing scholars and signed/reviewed findings. Never imply an unverified attribution is authenticated.
3. Provenance: events in chronological order, attributed sources, disputed claims, gaps, conflicts and evidence-quality labels. Unknown owner/location details remain private.
4. Condition: documented inspections, observations, restorations, media links, assessment date and reviewer scope. Display "not assessed" rather than a fabricated condition score.
5. Scholarship: exhibitions, bibliography, links to verified source documents, independent-verification revisions and methodological notes.
6. Market decision support: correctly labeled historical results and estimates (if sourced), current sale/auction eligibility and clearly isolated inquiry/offer action. Do not present an algorithmic fair value as a verified appraisal.
7. Decision readiness: evidence available/missing/disputed, permitted next steps and human review required. Readiness is a deterministic checklist of evidence, not a claim of authenticity or investment return.
8. Source/audit ribbon: document identity, current version, publication/revision date, provenance of data and export rights.

**Never disclose** confidential owner identities, exact storage location, restricted insurance values or private provenance documents on the public dossier. Mask them or omit them according to existing policy.

## Private Rooms — minimum viable secure journey

**Users:** Artwork owner/seller, gallery manager/curator, invited collector, authorized expert and independent reviewer; exact permissions resolved through existing authenticated account/organization roles.

1. An authorized host creates a room referencing one or more *existing* Artwork IDs and an immutable dossier revision.
2. Host invites an identity-bound recipient with expiry, scope and revocation; no anonymous durable share URL.
3. Recipient authenticates; optional confidentiality terms/NDA are accepted with version and timestamp where legally reviewed.
4. Recipient receives only specifically approved dossier sections/documents. Sensitive media is delivered via short-lived authorization-bound links.
5. Participants request clarifications; expert responses refer to the canonical claim/evidence version. Discussion does not silently amend the passport.
6. Interest becomes an existing inquiry/offer workflow; the room does not become a second payment, auction or ownership ledger.
7. Host can revoke access. A permissions check happens on every read and download, not only when issuing invitations.
8. Event log records invite, acceptance, read, inquiry, revision, grant and revocation, without exposing the contents of private documents in telemetry.

### Authority reuse / data relationships

- `room`: id, host organization/account, title, purpose, status, expiry, timestamps.
- `room_membership`: room, participant account/org, scope, expiry, invitation/accepted/revoked timestamps.
- `room_artwork`: room, canonical object_id, immutable approved dossier revision, ordering/visibility.
- `room_grant`: room, canonical media/evidence reference, permissible view/download, expiry and masking scope.
- `room_event`: event type, subject, actor, timestamp, immutable audit reference and associated request id.

All five entities are authorization/workflow projections. They never duplicate artwork/passport/provenance authority. The eventual schema migration must be **034 or later** and only after 001–033 production admission; never insert a new migration into the existing 001–033 chain.

## UX contract

- Gallery remains image-first; public Artwork has an unobtrusive "Request private dossier" action only when host has enabled access.
- Collector room: artwork cover, evidence overview, gaps/risks, source panel, permitted documents, concise activity and one primary next step.
- Host room: invite/permissions, document approval, open questions, activity and access revocation.
- Phone / tablet / desktop: visible roles and navigation; no overflowing modals, no giant tables in customer view.
- Restricted room IDs and document IDs must not leak their existence through 403/404 differences, counts, search, metadata or preview thumbnails.

## Acceptance / Golden Paths

1. Invite correct account -> authenticate -> signed-in permitted dossier opens.
2. Non-member probes route and document -> no existence/metadata leakage.
3. Invitation expired/revoked -> blocked for all endpoints, previously issued signed URLs constrained to short TTL.
4. Seller grants one document only -> another document cannot be accessed.
5. Dossier source revision changes -> the shared revision remains auditable; new version requires review/publish.
6. Disputed provenance -> buyer UI visibly retains conflict and source; no unsupported "verified" badge.
7. Expert note -> source authority remains unchanged until explicit authorized scholarly review.
8. Inquiry/offer -> canonical commercial workflow, no duplicate pricing or settlement.
9. Mobile browsers -> media zoom, files, invite/accept, question flow and close/scroll accessible.
10. Restart -> room, grants, revisions and audit events persist in the confirmed PostgreSQL.
11. Backup/restore -> accepted records and revocations reappear accurately.
12. Operational security -> RLS/authorization negative tests and production trace are green at exact deployed SHA.

## Metrics and falsification

Capture baseline after launch, then monitor: qualified dossier requests, invitation acceptance rate, permissioned dossier open rate, complete evidence review, room-to-qualified-inquiry, room-to-offer, time-to-first-response, median days to qualified decision, withdrawal/revocation, data-leak incidents. Segment professional/retail, category, source, invite cohort and user type; never claim causal conversion change without a credible comparison.

## Ordered, gated PRs

- **P0:** finish dedicated database identity, read-only lineage, 001–033 exact, authoritative runtime `READY`, restart/restore. No P1 schema or production writes before this.
- **DD-01:** UX prototype + projection schema and source contract, review claims/redaction (no new authority).
- **DD-02:** read-only dossier projection server + source-citation matrix + revision/hash handling.
- **PR-01:** room/membership/grant audit schema `034+` with tenant isolation, authorization and negative SQL tests.
- **PR-02:** invite, expiry, revoke, signed read/download flows; API and abuse controls.
- **PR-03:** mobile-first collector/host rooms and existing inquiry/offer integration.
- **PR-04:** cross-role leakage E2E, restart/restore, audit/evidence bundle and investor demo qualification.

Merge only after exact-head CI, security review and mobile/tablet/desktop browser evidence. Customer/investor demonstration must separately label simulated versus operational counterparties.

## Explicit non-goals

Do not copy ARCOO branding, code, images or editorial copy. Do not design an ARCOO-like homepage or expand filters as the lead epic. No blockchain/NFT credential, new valuation authority, public owner graph, generic antique catalogue or investment-yield promises in this phase.
