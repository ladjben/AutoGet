-- Run after installing the ERP view. Read-only aggregate quality report.
SELECT item_source,
       count(*) AS lignes,
       count(DISTINCT order_id) AS commandes,
       count(*) FILTER (WHERE nullif(size, '') IS NOT NULL) AS lignes_avec_pointure,
       count(*) FILTER (WHERE nullif(phone, '') IS NULL AND nullif(phone_fallback, '') IS NULL) AS lignes_sans_telephone,
       count(*) FILTER (WHERE ordered_at IS NULL) AS lignes_sans_date
FROM autoget_marketing.delivered_items
GROUP BY item_source ORDER BY item_source;

SELECT
  (SELECT count(*) FROM public.woo_orders WHERE deleted_at IS NULL AND order_status = 'delivered') AS commandes_livrees_erp,
  (SELECT count(DISTINCT order_id) FROM autoget_marketing.delivered_items) AS commandes_dans_la_vue;
