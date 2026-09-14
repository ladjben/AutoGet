-- Supabase AutoGet only. Adds analytics metadata without touching ERP tables.
BEGIN;
SET LOCAL lock_timeout='1s';
SET LOCAL statement_timeout='10s';
ALTER TABLE marketing.campaigns ADD COLUMN IF NOT EXISTS cost_config jsonb NOT NULL DEFAULT '{}';
ALTER TABLE marketing.events ADD COLUMN IF NOT EXISTS occurred_at timestamptz;
ALTER TABLE marketing.events ADD COLUMN IF NOT EXISTS pricing jsonb;
CREATE INDEX IF NOT EXISTS marketing_events_recipient_time ON marketing.events(recipient_id,created_at);
COMMIT;
