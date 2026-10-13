# ANTIQUA — PostgreSQL Data API and recovery admission v0.57

Status: DRAFT / NOT AN AUTHORIZATION. Verified on 2026-10-13.
Only the existing dedicated Antiqua Supabase project may be admitted. This runbook
does not authorize creation of new databases or changes to other projects.

## Strict sequence

1. Restore membership in the original Supabase account and organization
   containing the historical antiqua-postgres. Confirm ownership via fresh
   project metadata: project ref, organization, region, creation date and
   database host. The project name alone does not establish identity.
2. Confirm an independent reviewer, valid backup and an isolated restore plan
   before any write or privilege adjustment.
3. Use the protected DSN for the proven project only. Never place DSNs,
   account secrets or API keys in source, PR comments or CI artifacts.
4. Run scripts/audit-db-readonly-v55.mjs with the approved identity flags.
   This is an inspection, not a migration. Check migration prefix 001-033,
   schema fingerprint, existing API grants, policies, sequences, callable
   functions, schema USAGE/CREATE and default privileges for future objects.
5. Antiqua's customer access runs through its Node backend, not browser
   Supabase Data API tokens. Review effective object privileges for anon
   and authenticated, including privileges inherited through other roles
   and PUBLIC. USAGE on public schema is recorded for review but is not
   by itself evidence of object access. CREATE on public is disallowed;
   actual table/view/function/sequence grants are evaluated separately.
   Unsafe privileges prevent admission.
6. In an independent DBA-reviewed change only, correct conflicting grants,
   defaults and schema exposure, with rollback proof. Do not automatically
   execute blanket REVOKE statements without assessing Supabase dependencies.
7. Run only the canonical migrations 001-033 against the proven dedicated
   database after schema and privilege preflight; verify exact 33 migrations
   and repeatability. Re-audit after execution; do not declare a partially
   qualified schema READY.
8. Bind protected settings to the existing Render service. Verify exact
   deployed SHA, HTTP readiness, persistent controlled write/read/restart,
   least-privilege negative tests, backup restore, and authorized media access.
   READY=200 is necessary but not sufficient for business admission.
9. Only after P0 admission implement Decision Dossier and authenticated
   Private Rooms using existing Artwork, provenance, evidence, Media and
   Inquiry/Offer authorities.

## Why current grants matter

Supabase distinguishes object GRANT privileges from row-level RLS, and
documents how older public schemas may auto-grant new tables and functions
to API roles. PostgreSQL functions also have default PUBLIC execution.
A policy or RLS badge alone is not proof of least privilege.

Source: https://supabase.com/docs/guides/api/securing-your-api

## Code and test boundary

Draft PR #143 now includes read-only catalog checks for existing relations,
all public routines, sequences, API role schema access and default ACL entries.
Its test suite includes targeted negative cases and tests against a PostgreSQL
16 service isolated to loopback. The real-catalog test creates temporary
roles and objects in a transaction, reads the catalog, then rolls back.
It refuses managed database targets.

This is a conservative gate, NOT a solver for arbitrary RLS expressions.
Identity proof and role-specific denied-access tests in the actual, authorized
Antiqua context remain necessary. PR #143 and parent PR #136 need an
independent review and exact-head CI before merge. Production and secret
bindings must remain unchanged until the release gates are fulfilled.

Tracking:
- P0 identity: https://github.com/PetrFedin/antiqua/issues/135
- Parent gate: https://github.com/PetrFedin/antiqua/pull/136
- Data API gate: https://github.com/PetrFedin/antiqua/pull/143
- Private media: https://github.com/PetrFedin/antiqua/issues/140
- P1 Dossier / Rooms: https://github.com/PetrFedin/antiqua/issues/137
- ARCOO adoption: https://github.com/PetrFedin/antiqua/pull/138
