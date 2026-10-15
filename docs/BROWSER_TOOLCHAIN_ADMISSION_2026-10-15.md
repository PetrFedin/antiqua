# Browser toolchain admission - 2026-10-15

## Evidence, not a clean-bill-of-health claim

PR #146 head `0733ffbe888865a442baff31202efdeb7f24cad8` completed
ANTIQUA CI run 38745535856 and Browser E2E run 38745535555 successfully.
Browser job 116458061701 reported `118 passed (3.8m)`, including 22 new
museum-resilience executions (11 scenarios x desktop/mobile projects).
Nine external museum image IDs reported `loaded` in each browser project.

However, that same browser job reported `2 high severity vulnerabilities`
after installing the inherited `@playwright/test@1.55.0`. The earlier production
`npm audit --omit=dev` gate does not certify this later-added toolchain. The
warning alone does not establish two distinct CVEs or exploitation on this Linux
runner. No such claims are made here.

The browser checkout was GitHub's synthetic merge
`43a2df5d478d47ce0396ed14c7eb7f957841a103`; its tree
`229cfc918bb139a40fcceac8c5a8bd9fc6b8319a` equals the branch head tree.
Visual artifact 11979985288 was downloaded; SHA-256 is
`bceda2f377bfa62da20f62f6ee92f6c400830a4fe364d9b847e1eebb8adfcc4a`.
All eight v61 RU/EN portrait/landscape PNGs are byte-identical to the preceding
successful browser run 38745020660. Portrait RU/EN, landscape RU and the iPhone
online museum gallery were directly inspected. Source and close are visible in
the offline views; online gallery images are present. This is developer visual
inspection, not independent design/security/rights approval.

## Toolchain correction

- Pin `@playwright/test`, Playwright and playwright-core to 1.63.0, with explicit
  runtime version assertions. This release was confirmed on the upstream official
  release list on the date above, not inferred from a package name.
- Install the runner as an exact dev dependency in the ephemeral CI checkout.
  Its temporary manifest and lock are intentionally generated so the subsequent
  audit includes the actual runner; no repository package manifest is changed.
- Audit production AND dev dependencies before browser installation or test
  execution. High/critical findings fail this gate. Save the JSON audit, resolved
  versions and temporary lock as a separate small evidence artifact.
- Invoke only the installed local Playwright executable; do not let npx resolve
  a replacement toolchain from the registry.
- Syntax-check every browser spec, including the new museum resilience suite,
  instead of relying on a stale manually enumerated subset.

Upstream references:
- https://github.com/microsoft/playwright/releases/tag/v1.63.0
- https://github.com/advisories/GHSA-7mvr-c777-76hp
- https://github.com/SocketDev/security-research/security/advisories/GHSA-qxm8-4v54-964r

The upstream advisory records differ on the earliest patched version
(1.55.1 versus 1.56.0); this change deliberately targets a later release and
requires the complete resolved-dependency audit and browser run to pass. It does
not claim that an upgrade alone proves absence of all vulnerabilities.

## Remaining release boundary

The same pre-upgrade browser log contains the inherited preview
`ReferenceError: lots is not defined` in `provenanceEvidenceOverview`.
The separate security integration #145 includes aggregate execution proof; do not
interpret a green museum branch as an integrated production/provenance admission.
Review and test the combined candidate before any release.

At authoring, the new 1.63.0 audit/browser execution is still pending; record its
exact head, synthetic merge, audit result and screenshots on the PR after it runs.
No main, Render deployment, real DB, migration, secrets, protected storage or
billing changes are made by this toolchain correction. PR #146 remains Draft.
