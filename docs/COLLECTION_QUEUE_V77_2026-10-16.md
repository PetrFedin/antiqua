# ANTIQUA v77 — Publication queue and painting classification consistency

Preview-only, not a production approval.

Server publication eligibility, collection listing and front-end view now align with the authoritative PAINTINGS_ONLY contract in art-domain-v50.mjs. Drawing/engraving/prints cannot silently receive a curated painting publication permission; watercolours remain valid.

GET /api/collection-publication/queue is PostgreSQL-only and requires catalogue.review or trust.review, returning only IDs, titles, stage, visibility and update date, not account identities, ownership details, provenance notes, storage or evidence. Excludes a reviewer's own collection and prevents the catalogue reviewer from taking the rights review slot. An independent review is still necessary.

No changes to main/Render/source Antiqua DB, no grant of media rights. Keep PR draft and verify new-head CI.
