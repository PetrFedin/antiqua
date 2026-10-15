# Museum resilience v61 — PR #146 continuation

## Verified starting point

Base head: `f08d53a92e3782f1e11f27fb79387ec31dde0ee3` (PR #146).
Existing CI and Chromium completed successfully for that head (Actions runs
38660523352 and 38660523464). Downloaded visual artifact 11937858963 was inspected:
`offline-dialog-320.png` shows the failure canvas consuming roughly 43% of the
small portrait viewport, with the canonical source link below the visible region.
Existing `toBeVisible()` assertions were not a viewport-intersection proof.

## Implementation

- Reuse and move the existing canonical museum source link into the compact modal
  failure panel. No duplicate sources, changed source URLs, or nested anchors in
  gallery/hero buttons. Decoded-image geometry remains unchanged.
- Dedicated static same-origin CSS, without inline styles, external assets or new
  dependencies. Close and source remain independently keyboard-accessible.
- Incremental keyed card reconciliation keeps existing DOM nodes connected during
  optional metadata hydration, preserving focused controls and decoded images.
- Announce count updates with a polite atomic status region.
- Native modal closure releases hash-navigation listeners and the scroll lock,
  restores the initiating control on the same route or the main page after route
  changes, and never intentionally steals focus from a replacement dialog.
- Isolate malformed optional records; withhold duplicated IDs rather than choose
  among potentially conflicting rights claims. Keep Painting/public-domain/IIIF
  admission conditions intact.
- Restrict reviewed medium translations to own dictionary keys. Do not infer a
  specific support from an unreviewed value; unknown medium stays source-qualified
  in RU and unaltered in EN.

## Frontend asset-contract change requiring review

The first continuation commit `a1cb67a` failed Smoke on the pre-existing assertion
that index.html loads exactly one stylesheet. It intentionally introduces a small
component-scoped companion rather than another historical version of the base
cascade. This follow-up retains an exact ordered stylesheet allowlist, now
`/styles.css`, `/museum-resilience.css`, and the unchanged `/main.js` entrypoint.
It adds checks that the companion stays below 8 KiB, contains only museum-scoped
selectors (plus the exact hero keyboard-focus selector), only width media queries,
and no external asset imports, URLs or `!important`. Unknown/remote/additional
stylesheets still fail. Existing canonical base CSS size/markers and module-graph
checks remain in force. This is an explicit asset architecture adjustment, not a
claim that the original failed check passed. Independent review must cover it.

## New executable acceptance

`tests/browser/museum-resilience-v61.spec.mjs` defines 11 scenarios, run by the
existing Chromium desktop and mobile projects (22 planned executions): RU/EN at
320x568 and 568x320; actual source/close viewport intersection; keyboard order and
focus restoration; delayed metadata hydration; malformed/duplicate/denied source
records; three unknown/prototype dictionary inputs; route cleanup; and exact
source popup with noopener. All external source responses in these new tests are
synthetic or aborted; they do not certify museum rights. Existing live-image
visual tests remain.

Full exact-head CI and screenshot review must be recorded on the PR after the
latest commit runs; they are not asserted by this document. Screenshots are
emitted under `artifacts/visual-proof/v61-*`.

## Boundaries and next gates

No main/Render/deploy, database, migration, credentials, billing, storage, source
image inventory, or artwork authority changes. No new paid resources. PR #146
remains Draft pending exact-head CI, screenshot inspection and independent review.

A read-only Supabase project listing during this continuation exposed Marco and
MFW, not the original Antiqua project. Original DB recovery, protected storage,
001–033 migration/restore proof and the integrated security candidate #145 remain
separate P0 gates. Decision Dossier/Private Rooms remain gated P1, not shipped here.
