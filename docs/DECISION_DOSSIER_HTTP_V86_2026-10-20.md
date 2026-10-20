# ANTIQUA — DD-02 public Decision Dossier HTTP authority (v86)

Date: 2026-10-20. Source: stacked PR #149 (v85); parent PR #148 (v84).

## Architecture and purpose

A new optional GET `/api/lots/:objectId/decision-dossier` route serves **only** a public, already-redacted, read-only scholarly decision projection. It does not create another source of truth, collection, grant, provenance journal, auction ledger, payment, or private document store.

Authority chain:

1. Explicit environment admission: `ANTIQUA_DECISION_DOSSIER_HTTP=true` **and** an allowed PostgreSQL runtime. A disposable loopback `antiqua_test` can use the route **only** under NODE_ENV=test and PREVIEW_MODE=true. Managed PostgreSQL additionally requires PREVIEW_MODE=false and the existing production admission report to be READY.
2. `verifyDatabaseTarget` rejects the wrong Supabase organization/ref, foreign database or unauthorised connection. No fallback to seeded preview data is permitted.
3. One PostgreSQL `REPEATABLE READ READ ONLY` transaction checks the canonical `objects` row: `publication_status='PUBLIC'` **and** `catalogue_status='APPROVED'`, plus a painting-only category gate using the canonical passport department (no sculptures, graphics, furniture or unsupported media). A guessed object ID, browser field, public collection preference or authentication role cannot grant publication.
4. The same transaction reads canonical provenance events and passport revision, and invokes the existing public-only artwork research projection. The normalized Decision Dossier contract demands all v58 public source boundaries and rejects raw v51 information.
5. Public output is a publication-scoped projection. Private owner, storage, original provenance event/revision IDs, scholar credentials, media evidence references, settlement/buyer details, live asking prices and unpublished research are not returned.
6. Errors for missing/nonpublic/nonapproved work share one generic 404 response. Disabled/unadmitted mode is HTTP 503. A committed revocation is enforced on the next independent snapshot. Header `Cache-Control: no-store` and `X-Robots-Tag: noindex` avoids accidental retention/indexing.

## Testing and sign-off

- `tests/postgres-decision-dossier-http-v86.mjs` connects **only** to isolated loopback `antiqua_test`, creates disposable test artwork/provenance, starts a real Node HTTP server and checks both feature-flag states, unknown/PRIVATE/uncatalogued/approved visibility, privacy field omission, scope forgery, release/revocation, hash stability and GET-only behavior.
- `.github/workflows/decision-dossier-contract-v56.yml` adds its own ephemeral PostgreSQL service plus the existing pure projection and repository regression tests. Core durability CI also includes the real HTTP regression after the main PostgreSQL test suite.
- CI evidence must be read from the final exact commit SHA, not from a parent; this document is an implementation contract until all jobs finish.

## Boundaries / unresolved dependencies

**DO NOT DEPLOY** merely because isolated tests pass. Original Antiqua managed PostgreSQL identity is still unavailable; 001–033 admission (and the candidate 034), restart/restore, protected media/documents, rights due diligence, independent security and curatorial review, exact live SHA and roll-back proof remain HOLD.

This route is read-only with **no image or signed document delivery** and no anonymous Private Rooms access. Marketing must not describe source hashes as digital signatures, original document authenticity certificates or valuations. Demo media remains labeled isolated CI preview and not production.
