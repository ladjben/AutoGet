-- Read-only inspection of the order status combinations, without customer data.
-- Uses woo_orders, the table name originally supplied by the owner.
-- If needed, qualify it with the actual schema returned by inspect-erp-whatsapp.sql.
SELECT
  status,
  order_status,
  delivery_contact_status,
  franchise_order_status,
  is_exchange,
  count(*) AS nombre_commandes
FROM woo_orders
WHERE deleted_at IS NULL
GROUP BY
  status, order_status, delivery_contact_status,
  franchise_order_status, is_exchange
ORDER BY nombre_commandes DESC;

-- Columns still needed to map the purchased products, variants and sizes.
SELECT table_schema, table_name, column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_name IN ('woo_order_items', 'woo_order_meta')
ORDER BY table_schema, table_name, ordinal_position;
