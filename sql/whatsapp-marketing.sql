-- Run on the marketing database (can be a dedicated Neon database).
-- Never run this migration against Supabase's public client-facing schema.
BEGIN;
CREATE SCHEMA IF NOT EXISTS marketing;
CREATE TABLE IF NOT EXISTS marketing.campaigns (
 id uuid PRIMARY KEY,
 request_key uuid UNIQUE NOT NULL,
 name text NOT NULL,
 state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','running','paused')),
 template jsonb NOT NULL,
 bindings jsonb NOT NULL,
 filters jsonb NOT NULL,
 cost_config jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS marketing.recipients (
 id uuid PRIMARY KEY,
 campaign_id uuid NOT NULL REFERENCES marketing.campaigns(id),
 phone text NOT NULL,
 customer_name text NOT NULL,
 payload jsonb NOT NULL,
 status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sending','sent','delivered','read','failed','unknown','skipped')),
 attempts integer NOT NULL DEFAULT 0,
 message_id text UNIQUE,
 error_code text,
 retryable boolean NOT NULL DEFAULT false,
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(campaign_id, phone)
);
CREATE INDEX IF NOT EXISTS marketing_queue_ordered ON marketing.recipients(next_attempt_at,id) WHERE status = 'queued';
CREATE TABLE IF NOT EXISTS marketing.events (
 id bigserial PRIMARY KEY,
 recipient_id uuid REFERENCES marketing.recipients(id),
 event_key text UNIQUE,
 kind text NOT NULL,
 code text,
 occurred_at timestamptz,
 pricing jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS marketing.suppressions (
 phone text PRIMARY KEY,
 reason text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON SCHEMA marketing FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA marketing FROM PUBLIC;
COMMIT;

-- Current contact-level consent; also available as a standalone upgrade migration.
BEGIN;
CREATE TABLE IF NOT EXISTS marketing.consents (
  phone text PRIMARY KEY CHECK (phone ~ '^\+[1-9][0-9]{7,14}$'),
  opted_in boolean NOT NULL,
  evidence text NOT NULL CHECK (length(trim(evidence)) > 0),
  captured_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON marketing.consents FROM PUBLIC;
COMMIT;
-- Upgrade for existing marketing installations; included in the fresh schema too.
BEGIN;
CREATE TABLE IF NOT EXISTS marketing.worker_health (
  id integer PRIMARY KEY CHECK(id=1),
  last_started_at timestamptz,
  last_finished_at timestamptz,
  last_processed integer NOT NULL DEFAULT 0,
  rate_limit_until timestamptz,
  last_error text
);
CREATE TABLE IF NOT EXISTS marketing.login_limits (
  bucket text PRIMARY KEY,
  attempts integer NOT NULL,
  resets_at timestamptz NOT NULL
);
REVOKE ALL ON marketing.worker_health, marketing.login_limits FROM PUBLIC;
COMMIT;
