-- Run in the private marketing database, not as the read-only ERP role.
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
