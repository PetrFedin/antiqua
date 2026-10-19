# ANTIQUA v78 / Reviewed collection dossier and queue

16 October 2026; preliminary draft, not production. All public collection and review eligibility uses art-domain-v50 isPaintingCategory. The previous publication model had accepted engraving/drawing, inconsistent with the project's paintings-only mandate.

GET /api/collection-publication/queue excludes owner/self-review and catalogue-reviewer rights-review conflicts in SQL before LIMIT. It supports a controlled POST_PUBLICATION stage for rights reviewers to revoke.

GET /api/collections/:id/publication/review returns a consistent read-only reviewer study of eligible submitted/approved/published cases, containing only work identifiers, painting category, permitted thumbnail data and privacy-readiness booleans. It excludes identities, storage, insurance, personal notes, confidential documents and rights evidence. All mutations still validate fresh locked data in PostgreSQL. Owners may read their own decision history; unrelated reviewers and users get a non-enumerating 404 for cases outside their permitted stage.

Real media-rights license verification remains independent and blocked; applicant-provided references alone are not a legal proof. Source DB, Render and main untouched.