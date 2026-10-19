# Collection workspace reliability v83 — 19 October 2026

Baseline: PR #148, `b6513456678148d74de1a26bb1f5ae5c5f02a77a`.
All seven baseline Actions workflows were confirmed SUCCESS on 19 October,
including Browser E2E and Portfolio Media Capture. This is baseline evidence,
not an acceptance receipt for v83.

## Findings and corrections

- Reviewer decision and owner submission generated a new idempotency key for
  each click. If the server committed but its response was lost, a retry could
  be treated as a fresh off-stage request. Keys now stay in a WeakMap for the
  initiating form/button, request path and exact payload, until acknowledged
  success. Changed notes/action/evidence get a new key. No private notes are
  stored in localStorage or sessionStorage. Recovery across page reload is
  intentionally not claimed.
- Inbox/dossier responses previously selected the current output node after
  awaiting HTTP. A request begun in an old workspace could write into a new
  workspace after navigation or a persona change. Reads now capture their
  original output and use last-initiated-read tokens. Detached outputs and
  superseded reads cannot receive markup or error messages.
- History and mutation completion are bounded to their original connected
  cards/forms. Queue refresh after a decision uses the initiating output.
- Saved reviewer tabs now fall back to Discovery if absent for the current
  role, avoiding an account with all panels hidden.
- Operations loading discards data for a detached/replaced account host and
  retries mounting the currently connected account host when appropriate.

- Actual captured reviewer screenshot exposed an inaccurate Buyer header: the
  capture helper changed the HTTP session without refreshing the app shell.
  The helper now reloads after direct login. Demo OPERATOR includes ADMIN;
  header and persona cycling additionally recognize non-admin CATALOGUER and
  TRUST_REVIEWER accounts without granting new permissions. Browser regression
  checks the operator label and return to BUYER.

- Reviewing the refreshed capture exposed a real account hydration race:
  refresh assigned the authenticated account before awaiting client-state,
  allowing hash navigation to read null verification data. Refresh now commits
  account/client state together; early account rendering shows a loading state.
  Browser regression delays client-state explicitly; capture rejects technical
  TypeError/ReferenceError toasts instead of saving them as acceptable media.

## Validation

- `node tests/collection-workspace-reliability-v83.mjs`: PASS. Executes actual
  client handlers/core API against deferred transport replies, lost-response
  failures, reverse completion order and detached nodes. Covers key reuse,
  changed payload, key rotation after success, owner submit and CSRF headers.
- `node tests/frontend-consolidation-v16.mjs`: PASS.
- `npm test`: PASS locally, including existing HTTP/privacy/domain smoke tests.
- New browser scenarios: unavailable reviewer tab for BUYER and retrying an
  OPERATOR review after an aborted response. The latter explicitly uses
  transport fixtures and does not claim PostgreSQL authorization proof.
- New-head Actions, browser regression and refreshed capture remain pending
  until their actual completion; check the exact commit, not the baseline.

## Boundaries

No server policy, schema or migration edits. Server authority remains primary.
No merge to main, production deployment, managed database operations or paid
resources. Original Antiqua PostgreSQL admission, independent review and real
media-rights validation remain unresolved. Existing v82 portfolio media depicts
the isolated CI app, not production; v83 adds reliability rather than a new
visual design.
