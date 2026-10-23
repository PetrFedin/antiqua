# ANTIQUA v90 — Collector Follow-up and Dealer Financial Integrity

**Status:** DRAFT / preview-only; not a managed-database admission or production deployment.
**Scope:** verified integration of existing v21 Inquiry, v23 Condition Report, v86/v87 public Decision Dossier and v17 dealer analytics. No speculative valuation or automated authenticity certification.
**Release stack:** #148 → #149 → #150 → #151 (v87) → #152 (v88/v89) → v90.

## Source of authority and two-sided customer journeys

### Collector: painting → evidence → real request → response status

- Public painting Decision Dossier is a **separate** server-side publication admission, never an identity/permission proof for a signed-in buyer.
- Read-only \`GET /api/listings/:listingId/diligence-progress\` resolves object and seller identity from the canonical ACTIVE listing, not user-supplied object parameters. Unauthenticated 401; no BUYER role 403; self-owned, inactive or missing listing 404; no methods other than GET and no URL query parameters. Responses are no-store and noindex.
- Existing authenticated conversations are re-read using the existing participant access logic. Only the caller's BUYER conversation, exact painting and exact listing can contribute. A source message carrying an \`INQUIRY_CONTEXT\` attachment with \`inquiryType=PROVENANCE\` establishes the provenance request. A later seller response establishes **SELLER_REPLIED** only relative to the latest buyer provenance request; unrelated shipping discussions never resolve it.
- Existing authorized Condition Report service read records supply \`REQUESTED\`, \`CANCELLED\` or **REPORT_PUBLISHED**. The latter requires \`FULFILLED\`, a positive \`currentReportVersion\` and that exact immutable version in the actual service history. It never claims that the report was professionally accepted or that linked private media was permission-granted.
- Response contains **only** two track/status records, source timestamps, transparent numerator counts and all-false non-certification boundaries. No private message body, seller/buyer identity, media ID, document URL, collection ownership or market valuation.
- The UI presents the two statuses directly in the painting's established typographic hierarchy. Buyer-specific follow-up is never put into the public evidence SHA or Public Dossier. A guest sees **sign in**, a seller sees **buyer-only**; a failed source shows *unavailable*, not a green zero.
- The screen refreshes only after the existing authorized v21/v23 POST succeeds (or user role changes and a buyer-only read is retried). Stale responses are discarded on switch/close. Opening the action sheet alone never sends, certifies or mutates data.

### Dealer: evidence-only demand and cash statuses

Original v17 \`settledByCurrency\` aggregated **all** auction settlement records, including \`PAYMENT_DUE\`, \`NONPAYMENT\`, \`VOID\` and \`DISPUTED\`; the per-artwork line could also add different currencies then display the last currency's symbol. This is **not** a paid amount.

v90 computes status-filtered **gross paid-by-record-state** only, in integer minor units:
- Included: \`PAID\`, \`FULFILLMENT\`, \`COMPLETED\`.
- Separate contested amount: \`DISPUTED\`. **Never** combined with ordinary paid amounts.
- Awaiting: \`PAYMENT_DUE\`, \`PAYMENT_PROCESSING\`.
- Other unpaid/final: \`NONPAYMENT\`, \`VOID\`, \`REOFFERED\`.
- Unknown status, non-positive/unsafe identifiers, bad currency or negative/unsafe amount are rejected from financial sums. Duplicate settlement ID is not double-counted. Overflow of a valid currency sum raises an exception rather than silently rounding.
- Currencies are never converted or added across each other. Per-work totals remain \`grossPaidByCurrency\` and \`contestedByCurrency\`; single-currency legacy fields are emitted only if exactly one currency is present.
- \`settledByCurrency\` remains a backward-compatible alias, now strictly filtered as above. \`settlements\` is count of records of **all** statuses, deliberately not an earnings proxy.
- Dealer UI labels gross paid *by system settlement status*, explicitly **not bank reconciliation, net proceeds, payout confirmation or seller profit**. This caveat holds even if the state says PAID.
- Analytical intensity formula: \`threads / deduplicated 30-minute passport view sessions × 100\`, one decimal. Returns \`null\` when no views, and can exceed 100 because threads and sessions have different grains. **It must never be labelled buyer conversion rate** or likelihood of sale.

## Precision and privacy acceptance

| Condition | Verifiable acceptance |
|---|---|
| User impersonation | GET without session 401; seller without BUYER role 403; own listing not a buyer data source |
| Cross-object IDOR | Exact listing & object read from server listing; source records filtered to buyer, listing, object |
| Newest request precedence | Seller reply to an old provenance question does not make a new unanswered question \`SELLER_REPLIED\` |
| Report claim integrity | No \`REPORT_PUBLISHED\` without a specific version already in authorized service response |
| Data minimization | No private messages, owner, seller, image media or signed URL in read model |
| Viewer UI race | Old object / closed dialog / changed listing / stale fetch cannot change the visible progress |
| Forged frontend response | Reject unknown tokens, extra certification, mismatched listing and inconsistent summary |
| Currency arithmetic | EUR and USD remain separate; disputed/unpaid amounts never inflate paid-by-state |
| Exchange rates & cashflow | No FX conversions, refund netting, tax deductions or actual payout approximated |
| Browser journeys | 320/1440 RU/EN, buyer/guest/seller, real test HTTP Inquiry/Condition POST followed by progress re-read |
| Delivery | Both isolated PostgreSQL and full Chromium CI, exact SHA and independent review; no Render or managed Supabase until P0 |

## Important remaining engineering work

- v90 buyer read currently reuses \`listConversations\` and \`listConditionReportRequests\` participant-scoped services. These are authoritative but may be expensive for high-volume buyers because \`listConversations\` internally hydrates each thread. Before commercial scale, implement and benchmark a single buyer/listing-targeted PostgreSQL read under a read-only transaction with the **same** authorization and integrity tests. Do not replace existing participant permission checks with a naked RLS-free query.
- Collect bank-confirmed and payout-disbursed financial events separately after payment provider admission. A settlement state on its own does not prove receipt or cash availability.
- Enhance the dealer UX with curated, time-windowed cohort analysis only after events include comparable stable time and attribution context. No dashboard ROAS, forecasts or LTV from the current thin event dataset.
- Production HOLD: the original Antiqua dedicated PostgreSQL isn't available under current Supabase organization; permissions, migrations 001–034+, secure storage, restart/restore, independent code/security/curatorial review and SHA-exact Render release remain unverified. Do not use other product databases as substitutes.

## Test sources
- Pure domain contracts: \`tests/buyer-diligence-v90.mjs\`, \`tests/seller-funds-v90.mjs\`.
- Browser integration with only publicly approved dossier deliberately MOCKED and canonical HTTP requests REAL in CI preview: \`tests/browser/buyer-diligence-v90.spec.mjs\`.
- Existing v87/v88 auth/revocation, all museum and gallery checks, server PostgreSQL v86 tests and complete browser suite remain required.
