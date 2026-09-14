-- LEGACY REFERENCE ONLY: the Supabase snapshot setup does NOT run this on Neon.
-- Follow docs/VERCEL_WHATSAPP_SETUP.md instead.
-- ERP-side read-only adapter, built from the owner's supplied schema and FKs.
-- Run with an ERP migration role. Grant SELECT on this view to the app role.
-- No source records are modified. Existing catalog soft deletions are retained
-- in historical joins: deleting today's product must not erase past purchases.
BEGIN;
CREATE SCHEMA IF NOT EXISTS autoget_marketing;
REVOKE ALL ON SCHEMA autoget_marketing FROM PUBLIC;
CREATE OR REPLACE VIEW autoget_marketing.delivered_items AS
WITH orders AS (
  SELECT o.* FROM public.woo_orders o
  WHERE o.deleted_at IS NULL AND o.order_status = 'delivered'
), lines AS (
  -- Actual delivered variant takes precedence over the originally confirmed one.
  SELECT o.id AS order_id, 'delivered:' || d.id AS item_id,
    'delivered'::text AS item_source,
    COALESCE('erp:' || p.id, 'erp-variant:' || d.product_variant_id,
             'unknown:delivered:' || d.id) AS product_id,
    COALESCE(NULLIF(btrim(p.name), ''), 'Produit non renseigné') AS product_name,
    v.color AS variant, v.size::text AS size,
    d.quantity_delivered AS quantity, d.delivered_at
  FROM orders o
  JOIN public.delivered_order_items d ON d.woo_order_id = o.id AND d.deleted_at IS NULL
  LEFT JOIN public.product_variants v ON v.id = d.product_variant_id
  LEFT JOIN public.products p ON p.id = v.product_id
  WHERE d.quantity_delivered IS NULL OR d.quantity_delivered > 0
  UNION ALL
  -- Order-level fallback only: never append all confirmed lines to partial deliveries.
  SELECT o.id, 'confirmed:' || c.id, 'confirmed',
    COALESCE('erp:' || p.id, 'erp:' || c.product_id,
             'erp-variant:' || c.product_variant_id, 'unknown:confirmed:' || c.id),
    COALESCE(NULLIF(btrim(p.name), ''), 'Produit non renseigné'),
    v.color, v.size::text, c.quantity, NULL::timestamptz
  FROM orders o
  JOIN public.confrimed_order_items c ON c.woo_order_id = o.id AND c.deleted_at IS NULL
  LEFT JOIN public.product_variants v ON v.id = c.product_variant_id
  LEFT JOIN public.products p ON p.id = COALESCE(v.product_id, c.product_id)
  WHERE (c.quantity IS NULL OR c.quantity > 0)
    AND NOT EXISTS (SELECT 1 FROM public.delivered_order_items d
                    WHERE d.woo_order_id = o.id AND d.deleted_at IS NULL)
  UNION ALL
  -- Woo IDs are external: never join variation_id to the internal variant PK.
  SELECT o.id, 'woo:' || w.id, 'woo',
    'woo-company:' || COALESCE(o.company_id::text, 'unknown') || ':' ||
      COALESCE(w.product_id::text, 'item:' || w.id),
    COALESCE(NULLIF(btrim(w.name), ''), 'Produit non renseigné'),
    NULL::text, NULL::text, w.quantity, NULL::timestamptz
  FROM orders o
  JOIN public.woo_order_items w ON w.order_id = o.id
  WHERE (w.quantity IS NULL OR w.quantity > 0)
    AND NOT EXISTS (SELECT 1 FROM public.delivered_order_items d
                    WHERE d.woo_order_id = o.id AND d.deleted_at IS NULL)
    AND NOT EXISTS (SELECT 1 FROM public.confrimed_order_items c
                    WHERE c.woo_order_id = o.id AND c.deleted_at IS NULL)
)
SELECT o.id::text AS order_id,
  COALESCE(o.date_created, o.created_at) AS ordered_at,
  o.order_status AS status,
  COALESCE(NULLIF(btrim(o.phone_normalized), ''), NULLIF(btrim(o.customer_phone), '')) AS phone,
  COALESCE(NULLIF(btrim(o.billing_name), ''), NULLIF(btrim(o.shipping_name), ''), '') AS customer_name,
  COALESCE(l.product_id, 'unknown:order:' || o.id) AS product_id,
  COALESCE(l.product_name, 'Articles non renseignés') AS product_name,
  COALESCE(l.variant, '') AS variant,
  COALESCE(l.size, '') AS size,
  COALESCE(NULLIF(btrim(o.billing_city), ''), NULLIF(btrim(o.shipping_city), ''), '') AS city,
  -- No consent source was found in the ERP schema. Delivery is not consent.
  -- A documented current consent can be imported into marketing.consents.
  false AS marketing_opt_in,
  o.customer_phone AS phone_fallback,
  COALESCE(l.item_id, 'unknown:order:' || o.id) AS item_id,
  COALESCE(l.item_source, 'unknown') AS item_source,
  l.quantity,
  l.delivered_at,
  o.company_id,
  o.franchise_id,
  o.is_exchange
FROM orders o
LEFT JOIN lines l ON l.order_id = o.id;
REVOKE ALL ON autoget_marketing.delivered_items FROM PUBLIC;
COMMIT;
