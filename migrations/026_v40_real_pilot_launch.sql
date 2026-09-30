-- ANTIQUA v0.40 Real Pilot Launch & Partner Onboarding.
CREATE TABLE IF NOT EXISTS dealer_pilot_operations (
 pilot_id text PRIMARY KEY REFERENCES dealer_pilot_engagements(id) ON DELETE CASCADE,
 launch_status text NOT NULL DEFAULT 'PREPARING' CHECK(launch_status IN('PREPARING','READY','LAUNCHED','PAUSED','CLOSED')),
 invitation_delivery jsonb NOT NULL DEFAULT '{}'::jsonb,
 weekly_cadence jsonb,
 launched_at timestamptz,
 launched_by_account_id text REFERENCES accounts(id) ON DELETE SET NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS dealer_pilot_operating_reviews (
 id text PRIMARY KEY,pilot_id text NOT NULL REFERENCES dealer_pilot_engagements(id) ON DELETE CASCADE,
 week_number integer NOT NULL CHECK(week_number>=1),scheduled_at timestamptz NOT NULL,status text NOT NULL DEFAULT 'SCHEDULED'
 CHECK(status IN('SCHEDULED','HELD','MISSED','CANCELLED')),checkpoint_event_id text,notes text,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(pilot_id,week_number)
);
INSERT INTO schema_migrations(version) VALUES('026_v40_real_pilot_launch') ON CONFLICT DO NOTHING;