# Antiqua DD-03 — Collector-to-dealer diligence workflow v88

Status: **PREVIEW-ONLY CANDIDATE, NOT PRODUCTION**.
Upstream chain: #148 → #149 → #150 → #151 (v87 passed 216/216 Chromium at exact head \`4627a5e7\`) → this v88 branch.
Scope: gallery-first **paintings only**. No new art categories or duplicate evidence/transaction authority.

## Purpose
Remove the buyer dead-end after seeing an honest, eight-domain Decision Readiness checklist. The buyer can pursue missing provenance documentation through the existing Artwork Inquiry workflow and request a specialist condition report through the existing **structured Condition Report** workflow.

This is deliberately not a Private Room, electronic certification of authenticity or one-click automatic purchase. The investor-facing value is a measurable decision journey. Its monetization is a **hypothesis**, requiring actual seller/collector usage: improved enquiry quality, verified conversion, professional paid services and eventually subscriptions/licensed market context. No unsupported revenue numbers.

## Canonical authority sequence and data scope

1. Painting ID is accepted from canonical Passport; no alternate artwork identity.
2. Public Decision Dossier is only available through the PostgreSQL-backed v86 route with a verified production database, canonical publication decision, **repeatable-read read-only transaction**, painting-only check and approved catalogue. The actual preview returns 503 until admitted. There is **no bypass** for commercial UX or private details.
3. v87 checklist is generated server-side from the redacted public projection. The client verifies object ID, SHA source lineage, non-certification boundaries and all eight schema statuses; it does not treat a claimed seller as an authority.
4. This v88 UI adds *links* to **existing** v21 \`/api/inquiries\` and v23 \`/api/listings/:id/condition-report-requests\` flows only when the already-instantiated listing and visible dealer service controls match the current artwork's listing. Buyer login, seller ownership and session authorization remain in those server controllers.
5. Request control availability updates on the existing docking area through a short-lived \`MutationObserver\`, including asynchronous inventory/auth checks. A disabled button cannot send; legacy DOM controls disappear on seller's own listing.
6. v21 buyer conversation is scoped to seller/listing and topic \`PROVENANCE\`; ordinary message remains an inquiry and **cannot** replace a condition report.
7. v23 condition report remains a versioned workflow. It is not assumed complete on request; any submitted report or protected document needs storage permissions, author identity and version evidence.
8. No private room, offer, payment, bid, document retrieval or provenance mutation is triggered by opening this checklist.

## Visual / interaction acceptance matrix

| State | What appears | Expected follow-through |
|---|---|---|
| Anonymous, approved publicly disclosed painting + listing | Eight checks and, once actual underlying CTAs exist, provenance and condition-request buttons | Clicking provenance opens existing sign-in-needed sheet; condition opens its own; nothing submitted |
| Buyer, same artwork | Two available actions | Provenance opens real v21 message sheet, optional manual POST; condition opens v23 form and manual POST with request version |
| Seller, own listing | Evidence checklist may display, but request shortcuts are disabled | No self-inquiry, no report-request POST |
| Missing or unapproved dossier / preview | No actionable checklist, no service shortcut | HTTP 503/404 fail-closed; generic buyer inquiry may remain independently available through existing commerce, not through v88 |
| Public painting without listing | Checklist only | No invented seller or contact |
| Switch gallery item, close dialog or seller service revoked | Pending reads ignored; old observers detached | No carry-over seller/listing shortcut |
| RU/EN & 320/390/1440 layouts | Localized actions, 44px tap areas, wrapping labels | No horizontal overflow, keyboard focus visible |

## Tests
\`tests/browser/collector-due-diligence-v88.spec.mjs\` uses an explicitly **MOCKED** approved public Decision Dossier because the original managed Antiqua PostgreSQL is unavailable. *All authenticated inquiry and condition-report POSTs are to the REAL CI-local Antiqua HTTP server*. It tests anonymous gating, buyer request form, persisted seller conversation with \`PROVENANCE\` attachment, versioned condition report, self-listing seller denial and non-admitted public read.

\`tests/browser/decision-readiness-v87.spec.mjs\` remains responsible for source/sha non-certification, tab rebuild and viewport regression. The full Chromium suite and the isolated PostgreSQL/public contract CI remain release gates.

Media output must never present the mocked authorized dossier as a live verified artwork. Test screenshots are named \`v88-*\` and retained as fixture visual evidence in GitHub Actions; investor-facing gallery/collection clips are captured from a genuine isolated app, receipt must state \`production:false\`, exact PR head and \`MEMORY_FALLBACK\` if applicable.

## P0 and future delivery
Original \`antiqua-postgres\` still not available in linked Supabase organization (do not reuse Marco/MFW). P0 admission must show source identity, manifest 001–034, role/RLS enforcement, immutable evidence grant checks, signed media downloads, restart and backup/restore proof on Antiqua-only PostgreSQL, actual Render exact-head deployment, rights and independent review. Until then **HOLD**.

After P0: private invite/expiration/revocation, NDA consent, per-document secure preview/download, reviewer Q&A, condition specialist workflow and commercially authoritative inquiry/offer linkage. No private facts should ever enter a public receipt; market comps require licensed source rights and financial normalization.
