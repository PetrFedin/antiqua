# ANTIQUA v64 — art direction and painting-first public proof

15 October 2026 · Draft stacked on PR #148 / P0 PR #147 · No production release.

## Failures repaired from v63
- Test static regex in `tests/frontend-consolidation-v16.mjs` was accidentally double escaped and produced a Node SyntaxError.
- Four Chrome tests expected the retired copy `Мир искусства / World of Art`; update the tests to assert the deliberate new accessible heading without weakening deep gallery/taste interactions.
- The first `#museumOpenAccess` waypoint link changed the application's hash router to an undefined route; replace the link with a button that scrolls and focuses the existing museum heading, without changing `#gallery`.
- Split visual headings now expose one readable localized accessible name.

## Public curation / no unauthorized evidence
- Homepage does not promote legacy decorative-object preview articles/exhibitions/collections as painting journalism.
- Editorial stories require explicit `metadata.discipline=PAINTING`, `reviewedForPublicHomepage=true`, `mediaRightsReviewed=true`, `status=PUBLISHED`. Undeclared records stay out of the gallery homepage and are not deleted.
- Exhibition and collection promotions require explicit painting-only public review and painting classification. Nothing is reclassified, deleted, or published by this step. Review flags are a presentation filter, not a server authorization mechanism.
- A new in-house typographic study interlude references the previously verified public-domain Georges Seurat record through the existing museum dialog. It makes no authenticity, sale, owner or rights assertions about Antiqua lots.

## Acceptance
- Static asset contract exact allowlist and full PR smoke CI.
- Browser: 320×568, 390×844, 834×1112 and 1440×900, RU/EN on desktop/mobile Chromium; zero horizontal overflow, image `object-fit:contain`, functional first waypoint and study CTA, no antiquities promo content, tested authority catalogue/taste unchanged.
- Screenshot artifacts inspected before design approval; real-device Safari and rights approval remain independent release gates.

## Holds
P0 PostgreSQL identity and 001–033 restore, private media grants, reviewer signoff, protected main and exact Render deploy remain blocked; PR #148 is preview-only. No paid infrastructure or new identity authority.
