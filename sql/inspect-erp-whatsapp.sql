-- Execute in the Neon SQL editor connected to the ERP database.
-- Read-only metadata inspection. Does not retrieve customer records or secrets.
-- Returns one JSON object to copy back for the WhatsApp integration.
WITH target_tables AS (
  SELECT c.oid, n.nspname AS schema_name, c.relname AS table_name
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind IN ('r', 'p', 'v', 'm', 'f')
    AND n.nspname NOT IN ('pg_catalog', 'information_schema')
    AND c.relname IN (
      'franchise_woo_refund_exchange_items',
      'franchise_woo_refund_items',
      'franchise_woo_refunds',
      'woo_commerce_events',
      'woo_companies',
      'woo_order_items',
      'woo_order_meta',
      'woo_order_shipping_lines',
      'woo_orders',
      'woo_shippings'
    )
)
SELECT jsonb_pretty(jsonb_build_object(
  'tables', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'schema', t.schema_name,
      'table', t.table_name,
      'columns', (
        SELECT jsonb_agg(jsonb_build_object(
          'name', a.attname,
          'type', pg_catalog.format_type(a.atttypid, a.atttypmod),
          'nullable', NOT a.attnotnull,
          'enum_values', (
            SELECT jsonb_agg(e.enumlabel ORDER BY e.enumsortorder)
            FROM pg_catalog.pg_enum e WHERE e.enumtypid = a.atttypid
          )
        ) ORDER BY a.attnum)
        FROM pg_catalog.pg_attribute a
        WHERE a.attrelid = t.oid AND a.attnum > 0 AND NOT a.attisdropped
      ),
      'keys', (
        SELECT jsonb_agg(jsonb_build_object(
          'name', k.conname,
          'definition', pg_catalog.pg_get_constraintdef(k.oid)
        ) ORDER BY k.conname)
        FROM pg_catalog.pg_constraint k
        WHERE k.conrelid = t.oid AND k.contype IN ('p', 'f', 'u')
      )
    ) ORDER BY t.schema_name, t.table_name)
    FROM target_tables t
  ), '[]'::jsonb)
)) AS erp_schema;
