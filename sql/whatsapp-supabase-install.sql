-- Fresh installation ONLY in the existing AutoGet Supabase database, first on a test copy.
-- Aborts on a name collision. Does not touch public/auth/storage or any ERP table.
BEGIN;
SET LOCAL lock_timeout='1s';
SET LOCAL statement_timeout='10s';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='marketing') THEN
  RAISE EXCEPTION 'marketing already exists: review the upgrade instead of reinstalling';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='autoget_marketing_app') THEN
  RAISE EXCEPTION 'autoget_marketing_app already exists: review existing permissions';
 END IF;
END $$;
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

CREATE TABLE IF NOT EXISTS marketing.consents (
  phone text PRIMARY KEY CHECK (phone ~ '^\+[1-9][0-9]{7,14}$'),
  opted_in boolean NOT NULL,
  evidence text NOT NULL CHECK (length(trim(evidence)) > 0),
  captured_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON marketing.consents FROM PUBLIC;
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

SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '10s';
CREATE TABLE IF NOT EXISTS marketing.source_items (
 id bigserial PRIMARY KEY,
 phone text,
 data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS marketing_source_phone ON marketing.source_items(phone);
CREATE TABLE IF NOT EXISTS marketing.sync_state (
 id integer PRIMARY KEY CHECK(id=1),
 completed_at timestamptz,
 row_count integer NOT NULL DEFAULT 0,
 last_error text
);
REVOKE ALL ON SCHEMA marketing FROM PUBLIC;
DO $$
DECLARE role_name text; table_name text;
BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
   EXECUTE format('REVOKE ALL ON SCHEMA marketing FROM %I',role_name);
   EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA marketing FROM %I',role_name);
   EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA marketing FROM %I',role_name);
  END IF;
 END LOOP;
 FOREACH table_name IN ARRAY ARRAY['campaigns','recipients','events','suppressions','consents','worker_health','login_limits','source_items','sync_state'] LOOP
  EXECUTE format('ALTER TABLE marketing.%I ENABLE ROW LEVEL SECURITY',table_name);
 END LOOP;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA marketing FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA marketing FROM PUBLIC;
-- Grant this group only to the dedicated server/import LOGIN, never anon/authenticated.
CREATE ROLE autoget_marketing_app NOLOGIN;
GRANT USAGE ON SCHEMA marketing TO autoget_marketing_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA marketing TO autoget_marketing_app;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA marketing TO autoget_marketing_app;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['campaigns','recipients','events','suppressions','consents','worker_health','login_limits','source_items','sync_state'] LOOP
  EXECUTE format('CREATE POLICY marketing_server ON marketing.%I FOR ALL TO autoget_marketing_app USING (true) WITH CHECK (true)',t);
 END LOOP;
END $$;
COMMIT;
