-- Provision on an isolated Neon branch first, then review production permissions.
-- No password, LOGIN, view, table change, index or foreign key is created here.
-- Group name collision aborts the whole transaction rather than reusing a role.
BEGIN;
SET LOCAL lock_timeout='500ms';
SET LOCAL statement_timeout='5s';
CREATE ROLE autoget_erp_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT USAGE ON SCHEMA public TO autoget_erp_reader;
GRANT SELECT(id,deleted_at,order_status,status,date_created,created_at,phone_normalized,
 customer_phone,billing_name,shipping_name,billing_city,shipping_city,company_id,
 franchise_id,is_exchange) ON public.woo_orders TO autoget_erp_reader;
GRANT SELECT(id,woo_order_id,product_variant_id,quantity_delivered,delivered_at,deleted_at)
 ON public.delivered_order_items TO autoget_erp_reader;
GRANT SELECT(id,woo_order_id,product_id,product_variant_id,quantity,deleted_at)
 ON public.confrimed_order_items TO autoget_erp_reader;
GRANT SELECT(id,product_id,color,size) ON public.product_variants TO autoget_erp_reader;
GRANT SELECT(id,name) ON public.products TO autoget_erp_reader;
GRANT SELECT(id,order_id,product_id,name,quantity) ON public.woo_order_items TO autoget_erp_reader;
COMMIT;
-- Afterwards, assign this group to a NEW dedicated LOGIN, with no other group
-- memberships or write privileges, using a private admin tool. Audit PUBLIC and
-- inherited grants as well. Never reuse the ERP's owner/admin connection.
