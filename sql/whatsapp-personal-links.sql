-- Additive migration in AutoGet's marketing database, never the ERP database.
BEGIN;
CREATE TABLE marketing.personal_links (
 token_hash text PRIMARY KEY CHECK(length(token_hash)=64),
 recipient_id uuid NOT NULL UNIQUE REFERENCES marketing.recipients(id),
 request_id uuid NOT NULL UNIQUE,
 expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days',
 revoked_at timestamptz,
 views integer NOT NULL DEFAULT 0,
 contact jsonb,
 state text NOT NULL DEFAULT 'ready' CHECK(state IN ('ready','processing','created','failed','review')),
 result jsonb
);
ALTER TABLE marketing.personal_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON marketing.personal_links FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON marketing.personal_links TO autoget_marketing_app;
CREATE POLICY marketing_server ON marketing.personal_links
 FOR ALL TO autoget_marketing_app USING (true) WITH CHECK (true);
COMMIT;
