# ANTIQUA v80 — Direct API publication authority

18 October 2026. An HTTP POST must obey the exact reviewer stage, not merely the role: SUBMITTED is a catalogue-review stage; CATALOGUE_APPROVED is a distinct rights-review stage; PUBLISHED can be revoked only by an eligible rights reviewer who did not approve its catalogue. Owners cannot review their own collections. Attempts outside the permitted stage receive a non-enumerating 404 and never append events.

Authorized idempotency-key replays are examined before the current-stage gate: a duplicate prior decision never creates a second event even if another reviewer has subsequently advanced the case. The existing owner, role, snapshot and transaction guards remain in force.

PostgreSQL regression tests explicitly deny rights-stage intervention on SUBMITTED, catalogue-stage intervention on CATALOGUE_APPROVED and same-reviewer revocation after publication. No main/Render/restricted managed database changes.