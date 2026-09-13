-- Read-only schema inspection. No customer or order row values are read.
-- Returns one JSON cell containing the line tables, their columns and keys,
-- plus referenced parent tables (up to two levels) to reveal bridge tables.
WITH RECURSIVE seeds AS (
  SELECT c.oid
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p', 'v', 'm')
    AND c.relname IN (
      'woo_orders', 'woo_order_items',
      'delivered_order_items', 'confrimed_order_items', 'order_items',
      'products', 'product_variants', 'exchange_items', 'return_items',
      'franchise_woo_refunds', 'franchise_woo_refund_items',
      'franchise_woo_refund_exchange_items'
    )
), dependencies(oid, depth) AS (
  SELECT oid, 0 FROM seeds
  UNION
  SELECT fk.confrelid, d.depth + 1
  FROM dependencies d
  JOIN pg_catalog.pg_constraint fk ON fk.conrelid = d.oid AND fk.contype = 'f'
  WHERE d.depth < 2
), selected_tables AS (
  SELECT DISTINCT oid FROM dependencies
)
SELECT jsonb_pretty(COALESCE(jsonb_agg(jsonb_build_object(
  'schema', n.nspname,
  'table', c.relname,
  'columns', (
    SELECT jsonb_agg(jsonb_build_object(
      'name', a.attname,
      'type', pg_catalog.format_type(a.atttypid, a.atttypmod),
      'nullable', NOT a.attnotnull
    ) ORDER BY a.attnum)
    FROM pg_catalog.pg_attribute a
    WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
  ),
  'keys', (
    SELECT jsonb_agg(jsonb_build_object(
      'name', k.conname,
      'definition', pg_catalog.pg_get_constraintdef(k.oid)
    ) ORDER BY k.conname)
    FROM pg_catalog.pg_constraint k
    WHERE k.conrelid = c.oid AND k.contype IN ('p', 'f', 'u')
  )
) ORDER BY n.nspname, c.relname), '[]'::jsonb)) AS item_relationships
FROM selected_tables s
JOIN pg_catalog.pg_class c ON c.oid = s.oid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace;
