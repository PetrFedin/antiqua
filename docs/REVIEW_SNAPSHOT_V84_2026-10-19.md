# v84 — reviewer decisions bind the viewed dossier

Baseline: 4860d633001ae08d01d4b0793dce5751fc01c719, PR #148.

## Confirmed gap
A reviewer could open submission A, another reviewer request changes, and the
owner submit B. An old browser could approve B because the server checked the
current stage/composition but not the version the reviewer actually studied.
Even an identical-composition resubmission is a new decision round.

## Contract
The authenticated, stage-scoped reviewer dossier now returns reviewToken, a
SHA-256 binding of the collection identity, full current content digest, current
publication state and latest decision journal hash. The repeatable-read dossier
transaction computes it from canonical collection and membership rows. Internal
owner/notes/storage data are used for binding but never returned as fields.
This is a concurrency token, not a signature, licence or authenticity claim.

APPROVE / PUBLISH / REQUEST_CHANGES / REVOKE require that token. Under the same
collection row lock as the write, authorized fresh requests return 428
REVIEW_TOKEN_REQUIRED for missing/malformed tokens, or 409 STALE_REVIEW for an
obsolete token. Rejections append no event. Stage/role isolation is checked
before token/evidence feedback. SUBMIT remains an owner action without a token.

Idempotent replays compare the original request token, preserving successful
replay after composition changes or revocation. A narrow legacy request-hash
compatibility path permits only replay of an existing pre-v84 event; it cannot
admit any fresh decision. No schema or historical migration edits are needed.

UI sends the rendered dossier token as part of the retry payload and provides a
localized instruction to reopen/review an obsolete dossier. Earlier mounted
clients without this new field must reload; fresh unversioned approval fails.

## Verification
- Existing lifecycle PostgreSQL tests explicitly obtain current dossier tokens.
- New isolated PostgreSQL regression: required token, identical-content new
  round, stale rights decision, no rejection events, current decision, replay
  after revocation, changed-token idempotency conflict, legacy replay fixture.
- Real cookie/CSRF HTTP lifecycle adds missing/stale token and post-revocation
  replay checks. It uses a disposable loopback _test database only.
- Browser transport fixtures check token forwarding and actionable stale-review
  error without fabricated successful approval. Real DB authorization remains
  covered by the PostgreSQL HTTP suite.
- New exact-head CI and portfolio capture must finish before acceptance.

## Release status
Draft preview candidate. No main merge, Render deployment, managed database,
new paid resources, actual rights clearance or independent review is claimed.
Original Antiqua PostgreSQL admission and production release remain HOLD.
