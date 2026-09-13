-- LEGACY REFERENCE ONLY: the Supabase snapshot setup does NOT run this on Neon.
-- Follow docs/VERCEL_WHATSAPP_SETUP.md instead.
-- ERP-side foundation, based on the supplied woo_orders columns/statuses.
-- Prepared locally; NOT executed against the ERP.
-- Creates a private read-only view without modifying source order records.
-- This is NOT yet the delivered_items contract used by the application:
-- product joins, size mapping and current consent still need to be completed.
BEGIN;
CREATE SCHEMA IF NOT EXISTS autoget_marketing;
REVOKE ALL ON SCHEMA autoget_marketing FROM PUBLIC;
CREATE OR REPLACE VIEW autoget_marketing.delivered_orders AS
SELECT
  o.id AS erp_order_id,
  o.id::text AS order_id,
  o.woo_id,
  o.shopify_id,
  o.company_id,
  o.franchise_id,
  o.date_created AS ordered_at,
  o.order_status AS status,
  o.phone_normalized,
  o.customer_phone,
  -- Keep both phone sources for validation before choosing the recipient.
  -- customer_phone2 is deliberately not treated as another recipient.
  COALESCE(NULLIF(btrim(o.billing_name), ''), NULLIF(btrim(o.shipping_name), '')) AS customer_name,
  COALESCE(NULLIF(btrim(o.billing_city), ''), NULLIF(btrim(o.shipping_city), '')) AS city,
  o.is_exchange
FROM public.woo_orders o
WHERE o.deleted_at IS NULL
  AND o.order_status = 'delivered';
REVOKE ALL ON autoget_marketing.delivered_orders FROM PUBLIC;
COMMIT;
