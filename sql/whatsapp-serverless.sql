-- Upgrade for existing marketing installations; included in the fresh schema too.
BEGIN;
CREATE TABLE IF NOT EXISTS marketing.worker_health (
  id integer PRIMARY KEY CHECK(id=1),
  last_started_at timestamptz,
  last_finished_at timestamptz,
  last_processed integer NOT NULL DEFAULT 0,
  last_error text
);
CREATE TABLE IF NOT EXISTS marketing.login_limits (
  bucket text PRIMARY KEY,
  attempts integer NOT NULL,
  resets_at timestamptz NOT NULL
);
REVOKE ALL ON marketing.worker_health, marketing.login_limits FROM PUBLIC;
COMMIT;
