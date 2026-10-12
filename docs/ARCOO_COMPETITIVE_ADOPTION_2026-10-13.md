# Antiqua × ARCOO — Competitive capabilities and adoption map

Date: 2026-10-13. Source confidence: PUBLIC PAGE OBSERVATION (not an account audit). Every claim below is separated from recommendation. This document is a build specification, not evidence that planned Antiqua features are already live.

## 0. Decision / boundary

**P0 = real dedicated Antiqua PostgreSQL admission on canonical 001–033 with /api/ready=200, durable restart and restore proof.** **P1 immediately after P0 = Decision Dossier + authenticated Private Rooms.** Additional marketplace filters, a clone of ARCOO's homepage or expansion beyond paintings do not displace these.

Antiqua scope remains **painting-first** (oil, acrylic, tempera, watercolor, gouache, pastel painting); historical internal generic Object identifiers are not permission to expose antiques, sculpture, furniture, photography or heritage property.

**Implementation constraints:** reuse current Artwork/Passport, scholarly/provenance claim, Media, Collection, Gallery/Creator, Inquiry/Offer, Event and Audit authorities. Do not create competing artwork facts, prices, transaction/auction histories or user roles. Respect copyright and licensed images. No new paid services.

## 1. Observed ARCOO facts, with URLs and limits

| Public evidence / link | What is actually observed | What is NOT verified |
|---|---|---|
| https://arcoo.ru/ | Editorial Digest + closed Club + dossier-led Platform proposition | Club membership workflows and real closed transactions |
| https://arcoo.ru/art | Art landing pages show sale/price, artists, dimensions, and describe editorial submission and assisted inquiry | Whether moderation is as described, SLA achievement, actual conversion |
| https://arcoo.ru/art/catalog | Public artwork grid and sort, published prices and sizes | Inventory completeness and real-time availability |
| https://arcoo.ru/art/works/real-razgovor-po-dusham-396 | Sample painting: author, title, year, canvas/acrylic, measurements, price, availability | Authenticated attribution, condition reports, provenance documents, settlement |
| https://arcoo.ru/art/artists | Public artist profiles, work counts | Methodology of displayed scores (such as "10,0") |
| https://arcoo.ru/heritage | Public description of property dossier, feasibility checks, financial scenarios, investor club and legal services | Whether the entire dossier is available to public, verified actual ROI |
| https://arcoo.ru/catalog and https://arcoo.ru/object/demo-11 | Heritage listings marked DEMO, with allowed/conditional/forbidden adaptations and risk explanations | Actual properties transacted or model performance |
| https://arcoo.ru/news and https://arcoo.ru/spb | Editorial articles, salon pages, future/past events, speakers and registration marketing | Venue attendance, commercial leads, event-driven GMV |
| https://arcoo.ru/login | Visible Telegram/Yandex/MAX/email sign-in controls | OAuth/session correctness, security/RBAC |
| https://arcoo.ru/submit and https://arcoo.ru/me/art | Unauthenticated visitors encounter login requirement | Internal gallery/artist onboarding and moderation |
| https://arcoo.ru/legal/offer | Site publishes terms for an **event ticket purchase** | Finished artwork escrow/settlement capabilities |

On 2026-10-13, the art landing page publicly displayed counts "535 works, 24 artists, 1 gallery"; those are marketing/UI numbers only, not a verified stock/audit count. The ARCOO catalogue intentionally includes non-painting media (sculpture, carpets, objects); no Antiqua taxonomy expansion is authorized.

## 2. Product comparison and decisions

| Pattern | ARCOO | Antiqua today (source or limitation) | Action |
|---|---|---|---|
| Clear public artwork title/author/size/availability/price | Shown in public art-card example | Gallery and Artwork Dossier in repository; current live preview runs MEMORY_FALLBACK | ADAPT to explicit "not for sale" / "price on request" / authorized asking price, gated by verified commerce |
| Dossier instead of shallow listing | Strong property proposition and DEMO structure | Existing scholarly passport, provenance, evidence, independent review code | **P1 FIRST:** source-anchored buyer Decision Dossier and explicit confidence/gaps |
| Authenticated collectors / private presentations | Investor club claimed, not black-box tested | Private Rooms Issue #103 planned | **P1 FIRST:** permissioned Private Rooms, signed grants, revoke, audit |
| One qualified next action | Art page enquiry + staff follow-up described | Canonical inquiry/offer workflows in source, production not qualified | P1: enquiry → review → canonical offer, no parallel transaction engine |
| Dealer/gallery onboarding | Landing-page workflow described | Dealer / publisher authority in code | P2: simple approved intake with media rights / rejection reasons |
| Artist discovery | Public artist directory | Creator graph and gallery metadata | P2: factual profiles, verified sources, no invented reputation score |
| Editorial/events/community | Public events, articles and club | Cultural calendar/editorial modules exist | P2: exhibition link/QR → Artwork → consented private invitation |
| Automatic projected ROI for art | Heritage-specific property financial examples | Provenance and market history, not guaranteed investment return | REJECT automatic paintings ROI/payback promises |
| Universal antiques, sculpture, property marketplace | Publicly represented | Outside Antiqua product reset | REJECT |
| Automated authenticity/blockchain claims | External promotional statements | Scholarly verification must be evidence-scoped | REJECT unsupported authenticity certainty |
| Social sign-in and ticket payment | Visible entry points and event ticket offer | Live secure user persistence not qualified | DEFER until identity, jurisdiction, billing, revocation verified |

Difference in value proposition: ARCOO's observable art surface is commercially understandable. Antiqua should preserve its richer **scholarly evidence authority** and make it useful to a real collecting decision without concealing uncertainty. Source-code existence does not imply operational capability.

## 3. P0 architecture and negative acceptance

1. Recover original **dedicated Antiqua** Supabase organization/project from fresh authenticated management metadata; prior names (e.g. "antiqua-postgres") are only search hints. Foreign MFW/Marco/Fintech refs are forbidden.
2. PR #136 identity admission guard: verify project-ref/host/role/TLS; obtain read-only table inventory and migration prefix; compare owner-reviewed fingerprint before any DDL.
3. Apply only canonical **001–033**; prove exact 33 versions, head 033, no unexpected/missing versions, rerunnable migrations, role limits, table/index constraints.
4. Block demo seeds in managed DB, never downgrade configured DB to memory; demonstrate disconnected/incorrect ref, missing reviewer attestation and foreign lineage all fail before writes.
5. Bind verified DSN only to existing Render service using protected secret, keep preview until proven, then release exact SHA after approved backup/recovery plan.
6. Verify /api/ready 200 with persistence=POSTGRES, restart integrity, controlled write and restoration from known backup, plus authorized reviewer sign-off.

Do not merge or deploy critical runtime changes merely on synthetic CI. Dedicated base identity and real backup/restore are external unresolved gates (Issue #135).

## 4. P1 Decision Dossier (read-only authority projection)

**Buyer view:** cover with permitted source image; facts (artist, school/attribution grade, title, medium, date, dimensions); provenance chronology with source links, disputes/gaps; dated condition and conservation review; bibliography/exhibitions; scoped expert assessment; labelled market-history examples only when verifiable; sales status and permitted next step. Every material claim references version, issuer/reviewer, evidence link, classification and access restriction.

**Risk/decision matrix:** sourced / pending / disputed / inaccessible. No single opaque authenticity score, guaranteed resale estimate or investment-yield badge. When evidence is absent say "Не проверено" rather than infer from formatting.

**Version contract:** immutable approval snapshot (revision ID, source authority hashes, redaction scope, issued_by, issued_at, intended recipient policy); changes require explicit re-review rather than mutating an already shared decision artifact.

**Paths:** Artwork → "Изучить досье" (public cleared section) → "Запросить документы" → authenticated invitation → consultation → canonical inquiry/offer.

## 5. P1 Private Rooms (existing Issue #103; no duplicate app)

Roles: host/professional, invited authenticated collector, expressly appointed expert/reviewer. Scope per room, object, source revision, evidence document; unique non-guessable IDs do not replace authentication or authorization.

Room events: create → invite → recipient accepts documented terms where applicable → evidence grants → Q&A → request consultation → canonical inquiry/offer → close/revoke, with immutable bounded audit.

Per-request policy check: deny cross-room and cross-organization access to metadata, existence, downloads, images and count endpoints. Revocation and expiry block future accesses. Use short-lived signed read URLs; avoid anonymous bearer-only secret-link MVP. Sales/auctions still owned by current canonical workflows.

**First quality gate:** 5 negative actor types (anonymous, unrelated authenticated user, other tenant host, expired invitee, revoked invitee) cannot determine room existence or read its documents. Cross-role QA must also cover phone, iPad and desktop.

New persistent room/membership/grant/audit SQL must be **migration 034 or later**, after actual P0 admission of 001–033.

## 6. Product waves without breaking P0

| Priority / window after P0 | Deliverable | Dependencies | Acceptance | Primary KPI |
|---|---|---|---|---|
| P1 / weeks 1–2 | Permission-aware Decision Dossier, source confidence and immutable revision | Passport/Provenance/Condition/Scholarship authorities | Golden paths for public/restricted/contested claims; no invented data | dossier_open / artwork_open |
| P1 / weeks 3–4 | Authenticated Private Room, grant/revoke, confidential documents | Migration 034+, object media rights, RBAC | negative role/tenant tests and revocation | qualified_invites_accepted / sent |
| P1 / weeks 5–8 | mobile-first collector + host, consultant Q&A, canonical inquiry/offer | Dossier and room admission | 390/834/1440 browser tests; persisted audit/restart | qualified_inquiries / approved room opens |
| P2 / weeks 9–12 | Gallery/dealer intake, editorial event follow-up and pilot metrics | real authorized partners, baseline | signed consent and publication rights; real process receipts | qualified_accepted_works and time to decision |
| P3 / evidence-dependent | optional sourced comps, rights-aware recommendations, institutional integration | production cohort and governance | audited sourcing and confidence / cost-benefit | repeat qualified collector engagements |

**Measurement rule:** no fabricated expected conversion uplift or ROI. Measure baselines first, segment pilots, distinguish demo/simulated data from real contracts and payment records.

## 7. Work items and immutable links

- P0 infra Issue #135: https://github.com/PetrFedin/antiqua/issues/135
- P0 hardening Draft PR #136: https://github.com/PetrFedin/antiqua/pull/136
- P1 Epic #137: https://github.com/PetrFedin/antiqua/issues/137
- Existing Rooms #103: https://github.com/PetrFedin/antiqua/issues/103
- Technical dossier/room spec in #136: docs/ANTIQUA_DECISION_DOSSIER_PRIVATE_ROOMS_EPIC_2026-10-13.md
- Product reset: docs/ANTIQUA_INTEGRATION_MASTER_PLAN_2026-10-01.md

Final rule: **P0 PostgreSQL admission must be GREEN before product schema, live collector rooms, investor claims or production onboarding.** ARCOO is a reference for decision clarity, not a design/code/content source.
