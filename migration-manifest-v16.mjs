import {fileURLToPath} from 'node:url';

const files=[
  '001_v09_foundation.sql',
  '002_v10_collection_graph_and_auction_integrity.sql',
  '003_v14_e2e_lifecycles.sql',
  '004_v14_verification_states.sql',
  '005_v14_account_object_flags.sql',
  '006_v14_discovery_matches.sql',
  '007_v14_ownership_history.sql',
  '008_v15_financial_exactly_once.sql',
  '009_v15_ownership_invariants.sql',
  '010_v15_worker_outbox.sql',
  '011_v15_durable_organizations.sql',
  '012_v16_lifecycle_events.sql',
  '013_v16_passport_revisions.sql',
  '014_v16_discovery_postgres_matching.sql',
  '015_v16_db_integrity.sql',
  '016_v17_object_engagement.sql',
  '017_v22_offer_negotiation.sql',
  '018_v23_condition_viewing.sql',
  '019_v26_saved_search_alerts.sql'
];

export const migrationManifest=Object.freeze(files.map((file,index)=>Object.freeze({
  index:index+1,
  file,
  version:file.replace(/\.sql$/,''),
  path:fileURLToPath(new URL(`./migrations/${file}`,import.meta.url))
})));

export const baselineMigration=migrationManifest[0];
export const v10Migration=migrationManifest[1];
export const v14PlusMigrations=migrationManifest.slice(2);
export function migrationVersions(){return migrationManifest.map(x=>x.version)}
