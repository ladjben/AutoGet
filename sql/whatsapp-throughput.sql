-- Supabase marketing only; no ERP access. Required before the concurrent worker.
BEGIN;
SET LOCAL lock_timeout='1s';
SET LOCAL statement_timeout='10s';
ALTER TABLE marketing.worker_health ADD COLUMN IF NOT EXISTS rate_limit_until timestamptz;
CREATE INDEX IF NOT EXISTS marketing_queue_ordered
ON marketing.recipients(next_attempt_at,id) WHERE status='queued';
COMMIT;
