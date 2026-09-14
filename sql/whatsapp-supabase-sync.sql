-- SUPABASE AutoGet only. Review/test on an isolated copy before production.
-- No ERP objects, public tables or existing foreign keys are altered.
BEGIN;
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
-- Not exposed through the browser API, even with Supabase default role grants.
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
COMMIT;
