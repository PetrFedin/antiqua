# ANTIQUA v71 / collection integrity and authority

Audit of collection-graph-v10 after visual v70 uncovered: public database collections were returned without hydrated object details; direct collection queries could fall back to memory seeding when PostgreSQL missed; memory demo collections could appear as public paintings; and public collection payload included owner identifiers / privacy controls / notes. The server now strictly requires explicit reviewed painting+media approvals and supported artwork media, and returns a projection omitting owner IDs, owner notes and internal access settings. Collection owners continue to access their private records. Database mappers retain metadata and hydrate media safely; missing PG records never fall back to seeded memory.

This is a conservative HOLD: no existing record is granted an approval token automatically and no production rights are asserted. The API gate is server-side; reviewer authority / independent media licenses and original Antiqua database migrations remain separately blocked.

Test: tests/collection-authority-v71.mjs exercises anonymous, owner and other account, art hydration and demo non-publication. Exact SHA CI must pass before merge. Other historic public gallery features may require a revised explicit authority workflow; do not weaken the gate by granting demo data approvals.
