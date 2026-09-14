import test from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { readFile } from 'node:fs/promises'

const url = process.env.MARKETING_TEST_DATABASE_URL
// Uses separate fixture schemas so it can run concurrently with integration.test.js.
test(
  'adaptateur ERP : vrais liens, priorité livraison, replis et historique incomplet',
  { skip: !url },
  async (t) => {
    const db = new pg.Pool({ connectionString: url })
    t.after(() => db.end())
    await db.query(
      'DROP SCHEMA IF EXISTS erp_adapter_result CASCADE; DROP SCHEMA IF EXISTS erp_adapter_test CASCADE; CREATE SCHEMA erp_adapter_test',
    )
    await db.query(`
    CREATE TABLE erp_adapter_test.woo_orders (
      id bigint PRIMARY KEY, order_status text, status text, deleted_at timestamptz,
      date_created timestamptz, created_at timestamptz, phone_normalized text,
      customer_phone text, billing_name text, shipping_name text, billing_city text,
      shipping_city text, company_id bigint, franchise_id bigint, is_exchange boolean
    );
    CREATE TABLE erp_adapter_test.products(id bigint PRIMARY KEY, name text, deleted_at timestamptz);
    CREATE TABLE erp_adapter_test.product_variants(id bigint PRIMARY KEY,product_id bigint REFERENCES erp_adapter_test.products(id),color text,size bigint,deleted_at timestamptz);
    CREATE TABLE erp_adapter_test.confrimed_order_items(id bigint PRIMARY KEY,woo_order_id bigint REFERENCES erp_adapter_test.woo_orders(id),product_id bigint,product_variant_id bigint REFERENCES erp_adapter_test.product_variants(id),quantity bigint,deleted_at timestamptz);
    CREATE TABLE erp_adapter_test.delivered_order_items(id bigint PRIMARY KEY,woo_order_id bigint REFERENCES erp_adapter_test.woo_orders(id),product_variant_id bigint REFERENCES erp_adapter_test.product_variants(id),quantity_delivered bigint,delivered_at timestamptz,deleted_at timestamptz);
    CREATE TABLE erp_adapter_test.woo_order_items(id bigint PRIMARY KEY,order_id bigint REFERENCES erp_adapter_test.woo_orders(id),product_id bigint,name text,quantity bigint,variation_id bigint);
    INSERT INTO erp_adapter_test.woo_orders(id,order_status,date_created,customer_phone,billing_name,company_id,is_exchange)
      SELECT id,'delivered','2026-09-01','0551234567','Client fictif',1,id=1 FROM generate_series(1,7) id;
    UPDATE erp_adapter_test.woo_orders SET order_status='cancelled' WHERE id=5;
    UPDATE erp_adapter_test.woo_orders SET deleted_at=now() WHERE id=6;
    INSERT INTO erp_adapter_test.products VALUES(10,'Chaussure historique',now()),(20,'Autre produit',NULL);
    INSERT INTO erp_adapter_test.product_variants VALUES(100,10,'Noir',42,now()),(200,20,'Blanc',44,NULL);
    INSERT INTO erp_adapter_test.confrimed_order_items VALUES(1,1,20,200,1,NULL),(2,2,10,100,2,NULL);
    INSERT INTO erp_adapter_test.delivered_order_items VALUES(1,1,100,1,'2026-09-05',NULL),(7,7,100,0,NULL,NULL);
    INSERT INTO erp_adapter_test.woo_order_items VALUES(1,1,999,'Ne doit pas doubler la livraison',1,200),(3,3,10,'Produit Woo externe',1,100);
  `)
    const sql = (
      await readFile(
        new URL('../../sql/whatsapp-erp-delivered-items.sql', import.meta.url),
        'utf8',
      )
    )
      .replaceAll('public.', 'erp_adapter_test.')
      .replaceAll('autoget_marketing', 'erp_adapter_result')
    await db.query(sql)
    await db.query(sql)
    const rows = (
      await db.query(
        'SELECT * FROM erp_adapter_result.delivered_items ORDER BY order_id',
      )
    ).rows
    assert.equal(rows.length, 5)
    const delivered = rows.find((r) => r.order_id === '1')
    assert.equal(delivered.item_source, 'delivered')
    assert.equal(delivered.product_id, 'erp:10')
    assert.equal(
      delivered.size,
      '42',
      'uses the actual delivered variant, not the confirmed replacement',
    )
    assert.equal(delivered.is_exchange, true)
    assert.equal(
      delivered.product_name,
      'Chaussure historique',
      'retains soft-deleted catalog history',
    )
    assert.equal(rows.find((r) => r.order_id === '2').item_source, 'confirmed')
    assert.equal(rows.find((r) => r.order_id === '2').size, '42')
    const woo = rows.find((r) => r.order_id === '3')
    assert.equal(woo.item_source, 'woo')
    assert.equal(
      woo.size,
      '',
      'external variation ID must not be joined to internal PK',
    )
    assert.equal(woo.product_id, 'woo-company:1:10')
    assert.equal(rows.find((r) => r.order_id === '4').item_source, 'unknown')
    assert.equal(
      rows.find((r) => r.order_id === '7').item_source,
      'unknown',
      'zero delivered quantity is not a purchased size',
    )
    const select = (await readFile(new URL('../../server/marketing/erp-source.sql', import.meta.url), 'utf8')).replaceAll('public.', 'erp_adapter_test.')
    const grants = (await readFile(new URL('../../sql/whatsapp-erp-reader.sql', import.meta.url), 'utf8'))
      .replaceAll('public.', 'erp_adapter_test.').replace('SCHEMA public', 'SCHEMA erp_adapter_test')
      .replaceAll('autoget_erp_reader', 'erp_adapter_reader_test')
    const reader = await db.connect()
    try {
      await reader.query('DROP ROLE IF EXISTS erp_adapter_reader_test')
      await reader.query(grants)
      await reader.query('SET ROLE erp_adapter_reader_test')
      const actual = (await reader.query(select)).rows.sort((a,b) => a.order_id.localeCompare(b.order_id))
      assert.deepEqual(actual.filter((r) => r.status === 'delivered'), rows,
        'delivered history remains unchanged under the all-status SELECT')
      assert.equal(actual.length, 6)
      assert.equal(actual.find((r) => r.order_id === '5').status, 'cancelled')
      assert.ok(!actual.some((r) => r.order_id === '6'), 'deleted orders remain excluded')
      await assert.rejects(reader.query("UPDATE erp_adapter_test.woo_orders SET order_status='cancelled'"), /permission denied/)
      await reader.query('RESET ROLE')
      await reader.query("UPDATE erp_adapter_test.woo_orders SET order_status=' ',status=' Pending ' WHERE id=5")
      await reader.query('SET ROLE erp_adapter_reader_test')
      assert.equal((await reader.query(select)).rows.find((r) => r.order_id === '5').status, 'pending')
      await reader.query('RESET ROLE')
      await reader.query('BEGIN READ ONLY')
      await assert.rejects(reader.query("UPDATE erp_adapter_test.woo_orders SET order_status='cancelled'"), /read-only transaction/)
      await reader.query('ROLLBACK')
      await reader.query('DROP OWNED BY erp_adapter_reader_test')
      await reader.query('DROP ROLE erp_adapter_reader_test')
    } finally {
      await reader.query('ROLLBACK')
      await reader.query('RESET ROLE')
      reader.release()
    }
    assert.ok(rows.every((r) => r.marketing_opt_in === false))
  },
)
