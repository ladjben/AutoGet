-- Read-only. Returns metadata and aggregate counts, not customer records.
-- Run all statements and return each result set.

-- 1. Declared order-item relationships: verify which identifier order_id uses.
SELECT k.conrelid::regclass AS table_name,
       k.conname,
       pg_catalog.pg_get_constraintdef(k.oid) AS definition
FROM pg_catalog.pg_constraint k
WHERE k.conrelid IN ('public.woo_order_items'::regclass, 'public.woo_order_meta'::regclass)
  AND k.contype IN ('p', 'f', 'u')
ORDER BY table_name, k.conname;

-- 2. If there is no foreign key, check whether every line matches woo_orders.id.
-- Counts alone do not prove business semantics; they can expose a wrong join.
SELECT count(*) AS total_items,
       count(*) FILTER (WHERE EXISTS (
         SELECT 1 FROM public.woo_orders o WHERE o.id = i.order_id
       )) AS items_matching_internal_order_id,
       count(*) FILTER (WHERE i.variation_id IS NOT NULL AND i.variation_id <> 0) AS items_with_variation,
       count(*) FILTER (WHERE nullif(btrim(i.sku), '') IS NOT NULL) AS items_with_sku
FROM public.woo_order_items i;

-- 3. Metadata KEY NAMES only: do not return the value column (it may contain PII).
SELECT key, count(*) AS occurrences
FROM public.woo_order_meta
GROUP BY key
ORDER BY occurrences DESC, key;

-- 4. Find candidate variation/product/item-metadata tables and their columns.
SELECT table_schema, table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
  AND (
    table_name ~* '(product|produit|variation|variant|attribute|attribut|size|pointure|item.*meta)'
    OR column_name ~* '(variation_id|variant_id|size|pointure|attributes)'
  )
ORDER BY table_schema, table_name, ordinal_position;
