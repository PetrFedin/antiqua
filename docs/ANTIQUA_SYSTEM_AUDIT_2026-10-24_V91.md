# ANTIQUA — Independent Whole-Product Audit and Recovery Register
**Assessment date:** 24 October 2026
**Audit ref:** v90 head c20097da490491eeb44c63ba75bd74802f3da0d5, v91 QA branch audit/account-security-and-readiness-v91.
**Authority boundary:** Main is 4f3e396ce6052ae8924235eab3ed4ad11cac470c. The latest Render live deploy is the same older main SHA. These are different products in release status.
**Scope:** GitHub code and docs, PR queue, CI proof, real Render service configuration/deploy history, Supabase projects reachable in the currently connected organization; no production database writes, no automatic merge, no assertion of real revenue.

## 1. Executive assessment
ANTIQUA is a paintings-only, artwork-centric discovery, research, collecting and permissioned-commerce platform, not yet a production marketplace. Its strongest existing foundation is the permanent artwork identity and evidence-first catalogue; the largest operational risk is separation between extensive unmerged code, lack of verified managed PostgreSQL, preview-memory catalogues and external payment/media/identity dependencies. Testing is necessary but insufficient to certify a production environment.

Four *different* completion levels are used below:
- **CODE + CI:** implementation exists on a named review SHA and automated scenario passed in disposable preview or isolated test PostgreSQL.
- **PARTIAL:** real working subjourney, with incomplete integration, hardcoded demo data or absent release evidence.
- **ROADMAP:** specified in master plan or feature register only; no complete user-to-user working path established.
- **BLOCKED:** cannot pass a responsible production acceptance without independently verified external rights, account access or infrastructure.
No item is PRODUCTION unless a named exact deploy SHA, durable database, role rights and live counterparty/provenance proof exist.

## 2. Verified repo and infrastructure reality
| Control | Observation | Consequence / action |
|---|---|---|
| Published source | main = 4f3e396ce6052ae8924235eab3ed4ad11cac470c | New v87-v90 UX and commerce are **not** what current public Render serves |
| Current candidate | stacked Draft #148 → #149 → #150 → #151 → #152 → #153, v90 head c20097da49 | Each draft needs independent review and ordered integration; a green stacked PR is not merged to main |
| Review queue | 21 open pull requests in this audit snapshot; multiple older security and UX branches | Resolve overlap/duplicate branch intent, formally close superseded proposals only after preserving evidence |
| Preview CI | v90 exact-head full browser 252/252; focused Chromium 34/34; isolated PostgreSQL and source contracts PASS | Strong evidence for the disposable test environment, **not** actual customers or hosted persistent service |
| Media archive | 12 screenshots and 3 H.264 20–30 s clips at v90 exact SHA | Useful to show preview mechanics; label mock source dossier and real CI-local HTTP accurately |
| Supabase access | Connected organization lists only Marco Pescarolo and MFW | Antiqua dedicated project is not in current scope. Do **not** reuse unrelated DB or infer owner/ref |
| PostgreSQL | Migration manifest 001–034 tested on isolated PostgreSQL | Original managed schema/rights, restart durability, restore, production RLS and file permissions remain unverified |
| Render | Service antiqua-preview: main/commit auto-deploy configured, last live deploy 4f3e396c | Configured auto-deploy is not proof of v90 release. Deployment rollback/restart and READY must be proven on exact new main |
| Object storage | Media/storage admission is explicitly open P0 #140 | Private images and docs must fail closed. No signed document access from general catalogue |
| Commercial providers | Real PSP, actual escrow, KYB/KYC providers and insured shipping not admitted | Preview payment or KYB states cannot be represented as genuine transfers or verification |

**Important inconsistency:** The master plan's dated 2026-10-01 checkpoint says an Antiqua-only project and migrations existed. That historical note does not establish current accessible identity. The 2026-10-13 recovery gate and current connected-project query take precedence. Do not treat past prose as new operational evidence.

## 3. Audited feature inventory
The historical 2026-10-11 source register contains exactly **103 items**. Its recorded classification (not an independent production sign-off) is **39 CODE, 2 PR, 42 GATED, 19 NEW, 1 DEFER**. Statuses must be reconciled against PR #148–#153 individually; recent v90 implementation moves selected older GATED entries into CODE+CI without satisfying production.

| Domain | Historical items | Implemented/tested core | Partially joined / not completed | Major blocking acceptance |
|---|---:|---|---|---|
| Painting gallery and catalogue | 12 | Public gallery, filters, artist pages, passport, similar works, museum story | IIIF high-res, source rights, real versus preview listings, image-failure fallback | Canonical PG publication and approved real media |
| Collector and discovery | 12 | Save/watch, owner-scoped collection records, collection creation/publication review, Taste Graph | Personal art vault, insurance dossier, collector interest memory, private group access | Durable identity, grants, confidential storage |
| Dealer, gallery, creator | 14 | Draft→media→review flow, listings, enquiry, offer negotiation, dealer lead stages, seller analytics, pilot control | Real onboarding/import, consignments, invoices, recurring billing, gallery-to-artist contracts | Real KYB, rights and signed dealer agreements |
| Community and cultural experiences | 13 | Art Network profiles, cultural calendar, events, editorial materials, scoped expertise claims | Expert Desk, audio/transcripts, ticket QR check-in, collaborative curation | Moderation, rights, validated event partners |
| Auction and transactions | 12 | Auction/bid rule engine, offer→order, condition requests, viewing calendar, shipping/settlement/dispute state machines | Payment connector, physical delivery confirmation, fiscal receipt, provider reconciliations | PSP/KYC/AML/settlement/consumer-law admission |
| Evidence and scholarship | 15 | Provenance evidence passport, redacted Decision Dossier, scholarly claims, revisioned condition reports | Real original-doc media authority, IIIF, OCR review, research co-pilot, catalogue raisonné | Verified expert credentials, redaction, lineage, rights |
| Sponsorship and investors | 13 | Public role-oriented preview, pilot-governance structures | 12 NEW items at historical audit; real sponsor packages, investor room, signed partner case studies | Partner contracts, data ownership, verified revenue |
| Core platform, data, privacy, economics | 12 | Password/CSRF/session building blocks, role permissions, finance ledger and assertions, audit workflow and exact-currency calculations | SaaS billing, accounting reconciliation, analytical KPI dictionary, canonical PG catalog service | Original Antiqua DB, backups, full RLS ACL and payer evidence |

### Journey adjacency and where handoffs still break
**Visitor:** Gallery → Artwork → Artist → Related → Save → Collection → Cultural event works as test flows; museum rights and commercial eligibility remain source-conditional.
**Collector:** Dossier → 8-domain evidence readiness → Provenance Inquiry → seller conversation → Condition Report request → report version → buyer follow-up is tested at v90 including genuine isolated PG HTTP.
**Dealer:** Draft → media → publication review → listing → inbound lead → offer → order is mostly implemented in domain code/CI; actual real catalogue ingestion and partner agreement are missing.
**Auction:** register → watch/bid → result → settlement → shipment/dispute states can run in preview. Real payment authorization, tax treatment, transport/insurance and net dealer payout are NOT admitted.
**Institution:** Org/profile/exhibition/editorial features have code but true production identity, scholarly access, archive exchange, consent and licensing are incomplete.
**Private Rooms:** explicitly P1 ROADMAP and BLOCKED until P0; not safe to call delivered merely because Dossier and enquiry exist.

## 4. Role and cabinet acceptance matrix
| Persona | Authorized role / current surface | Verified or reviewed actions | Missing, uncertainty or required QA |
|---|---|---|---|
| Guest | public Gallery, Artist, Learn, Events, Auction overview | Browsing, image-first catalogue, public navigation and shareable passport | Must never inherit buyer histories; missing source rights should suppress misleading sales controls |
| Collector / BUYER | Account, saved/watch, collection, inquiries, reports, offers | Buyer/other-buyer access isolation, actual request HTTP, logout and 2FA need current v91 re-acceptance | PDF vault, purchase documents, account recovery and identity-aware previews |
| Dealer / SELLER | Seller drafting, listings, analytics, leads/pilot | Seller listing state, genuine counterpart enquiries, gross paid-status grouping with currency | Genuine KYB, billing, consignment, shipping invoices, payouts and organization staff RBAC |
| Operator / ADMIN / TRUST_REVIEWER | Review, trust, commercial cockpit | Operator-only cockpit endpoint, publication versioning and refusal to disclose private collector trail | Separate duties, dual approval, admin event retention, production incident/playbooks |
| Cataloguer | Product / publication revision authority | Catalogue workflow and versioned review exist | Full role-specific exploratory E2E, bibliography/rights completeness, approval segregation |
| Expert / art historian / curator | Art Network expertise claim and verified research concept | Scoped claim and credential domain code present | Independent reviewer identity, conflict-of-interest declarations, contractual permissions, direct user onboarding |
| Gallery / institution staff | Organization and cultural profiles; private/pilot concept | Profile and claim workflows exist | Multi-user tenant isolation, institutional consent and paid seats, documentation controls |
| Sponsor / investor | Public showroom, role-targeted narrative | Investor preview pages exist | Authenticated data room, verified B2B pilots/LOI, signed IP agreements and real unit economics |

**Non-equivalence rule:** Public "artist", "expert" or "institution" profile claims are not automatically privileged login roles. Review Art Network credential and business permissions separately.

## 5. Confirmed functional defects / corrective work
### v91 fixes prepared in a separate review branch
1. No explicit Sign Out in main account/header despite existing revocable server session route; added both controls and controlled refresh.
2. After legitimate password for an account with TOTP enabled, the login UI did not request its second factor; added conditional code or one-use recovery prompt.
3. 2FA confirmation generated recovery codes but the UI immediately closed, effectively withholding the backup path; now one-time user-visible recovery codes with copy/acknowledgement and post-close clearing.
4. Ordinary 2FA setup could regenerate an already enabled factor; now rejects with 409 and an explicit machine code.
5. Inactive accounts were not excluded before password-based session issuance; now rejects inactive identity login.
6. Unexpected 5xx exception text from the top-level HTTP dispatcher could leak database/provider detail; a generic error envelope blocks that text while preserving expected bounded 4xx.
7. Header previously labelled everyone "Buyer" even when logged out and used a demo persona button as account affordance; v91 distinguishes explicit login/out and marks preview role switching as DEMO.

**Current v91 edits are a candidate until CI finishes; no production deployment.**

### Additional current P0 engineering debt
- **Canonical data split:** Public /api/catalog and /api/lots/:id/passport use seeded in-memory artefacts in routes-auth-v09.mjs; transactional and evidence systems increasingly use PostgreSQL. Publishing one view while settling another is an authority and misrepresentation risk. Build a publication-admitted PG read model, with atomic lookup by artwork identity and rights status, or fail closed when no data.
- **Performance debt:** Buyer v90 progress loads all participant conversations and condition requests, then filters for the current artwork. Introduce indexed buyer+object+listing read with the exact same authorization and version gate; verify EXPLAIN plans and limits.
- **Preview account spoofing:** Demo role switching belongs to preview only. Assert it remains strictly unreachable in managed production, not just invisible in UI.
- **Payment truth:** Status PAID/COMPLETED is not a bank reconciliation. Provider settlement references, refunds, chargebacks, disputes and seller payouts require independent immutable facts and currency exponents.
- **Identity and onboarding:** Real KYB adapter, verified contact ownership, email/password reset, session inventory/revocation, 2FA backup re-issue and brute-force controls require dedicated QA before invite to real collectors.
- **Storage and downloads:** Object Media Authority, immutable originals, media provenance, rights, grants, expiry and revocation are separate from simple file metadata. Must test private storage with unrelated users and revoked membership.
- **Delivery:** Do not display guaranteed delivery, insurance value, tax estimate or ownership transfer unless the corresponding evidence is in its authoritative lifecycle.

## 6. Visual design audit: actual source risks and acceptance
The code uses one huge public/styles.css plus modular editorial styles. This is good for broad coverage, but its many layers, inline form templates and historic '!important' rules are a maintainability and drift risk. Passing Chromium functional paths does not prove all breakpoints and pixel coordinates are harmonious.

**Required single design-token contract:**
| Token family | Standard to establish and verify |
|---|---|
| Brand palette | Gallery ivory, warm parchment, charcoal text, restrained deep-forest-green primary CTA; one semantic danger/error color |
| Typography | Two intentional families (editorial serif and readable UI sans), fixed type scale, no sub-12px essential labels |
| Spacing | Shared 4/8px-based increments; consistent rhythm for title, metadata, controls and section dividers |
| Strokes, radius, surfaces | 1px semantic borders, consistent form shapes, limited shadows; no synthetic AI-style glowing feature tiles |
| Icons | One icon set, consistent stroke width and optical size, accessible names and meaningful status icons |
| Controls | Action labels are explicit; hover/focus/active/disabled/loading/error/success tested independently; minimum 44px touch targets |
| Media | Aspect ratios per artwork, preserve all painting edges (object-fit:contain when appropriate), load failure, alt/credit and rights |
| Layout | 320/375/390/768/1024/1440 px and 200% zoom; no hidden navigation, modal clipping, horizontal scroll or sticky CTA overlap |
| Dialogs | Consistent scroll lock, Escape semantics, focus return, close, unsent changes and mobile keyboard resize |
| Navigation | Breadcrumbs, back, active section, login/out, role switch only as clearly labelled DEMO, deep links and invalid-ID recovery |
| Errors | Human copy with remediation, never raw stack, SQL, storage key or unverifiable trust badge |
| Localization | Source-accounting terms equally accurate in RU/EN; no mixed English demo microcopy in the final consumer-facing flows |

v90 included a visually verified provenance inquiry redesign. The v91 login/MFA + account buttons follow the same editorial tokens. Full app-wide screenshot diff and accessibility audit remain required.

## 7. Analytics and financial integrity
Do not report product success using unsegmented demo statistics.

**Event dictionary to implement:** EVENT_ID, event_time (UTC), actor pseudonym/consent, organization, artwork_id, listing_id, event source, authorization revision, channel, session_id, event_type, idempotency key and lifecycle evidence link. Separate anonymous analytics from private collectors' records.

**Minimum funnels:**
1. Artwork views (deduplicated 30-minute view sessions) → enquiries → qualified replies → meeting/report → accepted offer → bank-confirmed payment.
2. Dealer activation (approved inventory) → active listings → responses inside SLA → verified transactions → revenue and renewal.
3. Cultural visit → work saved → next session → exhibition attendance → opted-in continuation.
4. Research evidence requests → response/version → resolved gap → re-open rate; no AI-authenticity claims.

**Financial formulas:**
- Monetary amounts: exact integer minor units + currency-specific exponent; never sum JPY+EUR.
- Gross paid-by-system-status: sum only PAID/FULFILLMENT/COMPLETED settlement records; exclude disputed and unpaid. NOT bank cash.
- Bank-confirmed gross = amount matched to independent payment-provider evidence, currency by currency.
- Net platform revenue = contracted platform fees earned less refunds, incentives and direct taxes as governed by accounting policy.
- Dealer proceeds = received amount less buyer tax, applicable fees, insurance/shipping/returns and payouts; must be separately reconciled.
- Repeat rate = paying dealer cohort retained in a defined month window / eligible opening paying dealer cohort; show cohort size.
- CAC = attributable sales/marketing acquisition cost / newly acquired paying customer; do not use visitors as paying customers.
- Contribution margin = revenue - variable provider, payment, storage, moderation and service fulfilment costs, with source table.

The v90 threads per 100 view sessions is intensity, NOT unique-person conversion; it may exceed 100.

## 8. Investor readiness and competitive product moat
**Main thesis:** ANTIQUA can connect artwork identity, public research, professional verification and commercial outcomes without inventing authenticity. That is a credible differentiated strategy, not yet a proven competitive advantage.

**Required first paying segment:** founding dealer/gallery with genuine paintings and explicit representation rights. An investor should see the following reproducible live chain:
Onboard dealer → rights/admission → approve 20–50 real paintings → publish qualified listings → legitimate collectors enquire → dealer replies → condition/version → accepted offer or documented non-conversion → settlement evidence → retained dealer dashboard.

**Revenue hypotheses, keep separate:** dealer subscriptions/seats, paid professional research and condition coordination, verified transaction fees only after permissioned PSP, institutional media/research license, selected non-intrusive sponsorship. No revenue number without executed contract or invoice.

**Investor data room (currently not complete):** company structure and equity table, IP ownership/contributor assignments, registered marks, contracts/LOIs, privacy/rights and licensing, source ownership, risk register, technology architecture, disaster recovery, 24-month driver-based model, real gross margin, 3 scenarios, competitor positioning, unit economics, funding ask/use-of-funds, milestones and independent pilot evidence.

**Highest ROI defensible assets:** unique high-quality artwork provenance data with citations and rights, repeat collector/dealer workflows, trustworthy versioned media/evidence, dealer retention and referral network. A collection of unverified features does not establish network effects.

## 9. Prioritized delivery gates and exact acceptance
| Priority | Work package | Completion evidence, not just code |
|---|---|---|
| P0.A | Independent security review and resolve PR #143/#145/#147 and v90/v91 dependency order | Security and engineering reviewers sign off exact branch diff; no skipped checks |
| P0.B | Connect original Antiqua-only Supabase identity | Fresh metadata identifying owner/ref; read-only schema fingerprint; forbidden other-project refs rejected |
| P0.C | Migrations, RBAC, RLS, READY, restart and restore | 001–034 verified; /api/ready=200 under exact SHA; controlled write survives restart; restored backup matches checksum |
| P0.D | Replace demo catalogue with rights-admitted PostgreSQL public projection | Artwork, media, listing, auction and publication state all resolve same ID; no demo inventory falsely saleable |
| P0.E | Security and session UX | BUYER/SELLER/ADMIN tests for email/password, login, logout, TOTP, recovery, CSRF, revoked session, forbidden self/cross-user access |
| P0.F | Media, credits, storage and mobile visual QA | Rights ledger and immutable original/derivative, grants/revocation, images visible 320–1440 and failure modes |
| P0.G | Real partner / transaction admissibility | At least one signed dealer relationship, genuine eligible inventory, independent KYB/PSP provider contracts, actual transaction only when legally permitted |
| P0.H | Proper SHA-exact hosted deploy with rollback | New main built on Render; actual public preview audited in browser; health/ready/storage/db distinct; rollback rehearsed |
| P1.A | Private Rooms MVP | Host/invite/expiry/revocation/NDA/versioned read, downloader reauth, invitation leakage negative tests, immutable audit |
| P1.B | Targeted buyer-diligence SQL | Latency benchmark, exact-grain query with buyer/listing scope, explain plan and unchanged data minimization |
| P1.C | Dealer revenue and commercial intelligence | Real deal terms, externally matched bank events, accurate FX/taxes, reconciled per dealer margin |
| P1.D | Investor/partner proof | Founding-dealer agreement, actual funnel baseline, LOI/first invoice, signed KPI definitions and funded roadmap |
| P2 | IIIF/Mirador, catalogued institutional integrations, research co-pilot, audio, accessibility and exhibitions | Launch only with real source rights, measurable adoption and verified operator workload |
| P3 | Federated research, transfer credentials, 3D/photogrammetry, advanced market predictions | Explicit demand/cost gate, independent research and legal rights |

## 10. Acceptance matrix of critical user journeys
Each path must run with anonymous, owner, counterparty, unrelated account and authorized operator where applicable:
- Guest opens real catalogued painting, artist, source/credit and next artwork without missing media.
- User registration → session → saved item → collection → logout → inaccessible private API.
- TOTP enrollment → recovery codes shown once → logged-out reauthentication → one-use code rejected on replay.
- Dealer creates painting, uploads rights-approved media, gets independent catalogue approval and releases one listing.
- Buyer sends provenance enquiry; seller replies; only that buyer sees the follow-up.
- Buyer requests condition version; seller publishes rights-approved report; unrelated buyer cannot retrieve document.
- Buyer negotiates offer; price currency and terms survive both cabinets and version conflicts are rejected.
- Auction bidder registration, authoritative bid with concurrency/idempotency, auction close and external payment distinction.
- Transaction → escrow/provider → shipping proof → dispute decision → ownership transfer, never implied before evidence.
- Operator audit/approval, conflict of interest and no self-approval rights.
- Sponsor/investor cannot browse personal collector, owner or expert private records.
- Live HTTPS dark-network or unavailable-media failure, restart, restore, service disconnection and healthy 503 contract.

## 11. Strategic no-go rules
No unverified authenticity badge or algorithmic investment recommendation. No invented painting for sale. No mixing customer data with investor metrics. No production demo-login. No new direct link to files outside ACL. No silent updates to source evidence. No foreign project DB reuse. No production claims based only on CI/README. No merging dozens of stale PRs by blind bulk automation; always review dependency, supersession, regression and security gate separately.

## 12. Sources for this audit
- GitHub: https://github.com/PetrFedin/antiqua/pull/153 — v90 head and structured review candidate.
- CI: https://github.com/PetrFedin/antiqua/actions/runs/40002890248 — 252 passing browser tests.
- CI: https://github.com/PetrFedin/antiqua/actions/runs/40002890267 — 34 focused browser tests.
- Isolated PostgreSQL: https://github.com/PetrFedin/antiqua/actions/runs/40002890045.
- Portfolio proof: https://github.com/PetrFedin/antiqua/actions/runs/40002890053.
- Issues: https://github.com/PetrFedin/antiqua/issues/135, https://github.com/PetrFedin/antiqua/issues/137, https://github.com/PetrFedin/antiqua/issues/140, https://github.com/PetrFedin/antiqua/issues/141.
- Project sources: docs/ANTIQUA_INTEGRATION_MASTER_PLAN_2026-10-01.md; docs/ANTIQUA_INVESTOR_SPONSOR_FEATURE_REGISTER_2026-10-11.md; docs/PRODUCT_STANDARD.md; docs/ANTIQUA_COLLECTOR_AND_FINANCIAL_INTEGRITY_V90.md.
- Service evidence: Connected Render service antiqua-preview, deployed commit 4f3e396c; connected Supabase list_projects showing only two unrelated projects.
- The independent live browser exploration was NOT conducted because the chosen metered browser agent reported insufficient balance. Existing CI Chromium evidence remains separate from a new external live walkthrough.
