import { Router } from 'express';
import { getDb } from '../database/db.js';
import { requireAuth } from '../middleware/auth.js';
import { paginate, paginatedResponse } from '../middleware/tenant.js';

const router = Router();
const now = () => new Date().toISOString();

// â”€â”€ UNITS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/units', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const rows = db.prepare(`SELECT * FROM units WHERE tenant_id=? AND deleted_at IS NULL ORDER BY name`).all(t);
  res.json({ data: rows });
});

router.post('/units', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { name, short_name, uqc, base_unit_id, conversion } = req.body;
  if (!name) return res.status(422).json({ error: { code: 'VALIDATION_FAILED', message: 'name required' } });
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO units(id,tenant_id,name,short_name,uqc,base_unit_id,conversion,created_at,updated_at,version) VALUES(?,?,?,?,?,?,?,?,?,1)`
  ).run(id, t, name, short_name || null, uqc || null, base_unit_id || null, conversion || null, now(), now());
  res.status(201).json({ data: db.prepare(`SELECT * FROM units WHERE id=?`).get(id) });
});

router.put('/units/:id', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { name, short_name, uqc } = req.body;
  db.prepare(`UPDATE units SET name=?,short_name=?,uqc=?,updated_at=?,version=version+1 WHERE id=? AND tenant_id=?`
  ).run(name, short_name || null, uqc || null, now(), req.params.id, t);
  res.json({ data: db.prepare(`SELECT * FROM units WHERE id=?`).get(req.params.id) });
});

// â”€â”€ CATEGORIES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/categories', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const rows = db.prepare(`SELECT * FROM categories WHERE tenant_id=? AND deleted_at IS NULL ORDER BY name`).all(t);
  res.json({ data: rows });
});

router.post('/categories', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { name, parent_id } = req.body;
  if (!name) return res.status(422).json({ error: { code: 'VALIDATION_FAILED', message: 'name required' } });
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO categories(id,tenant_id,name,parent_id,created_at,updated_at,version) VALUES(?,?,?,?,?,?,1)`
  ).run(id, t, name, parent_id || null, now(), now());
  res.status(201).json({ data: db.prepare(`SELECT * FROM categories WHERE id=?`).get(id) });
});

// â”€â”€ TAX RATES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/tax-rates', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  res.json({ data: db.prepare(`SELECT * FROM tax_rates WHERE tenant_id=? AND deleted_at IS NULL ORDER BY rate`).all(t) });
});

router.post('/tax-rates', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { name, rate, hsn_sac, cgst_rate, sgst_rate, igst_rate, cess_rate } = req.body;
  if (!name) return res.status(422).json({ error: { code: 'VALIDATION_FAILED', message: 'name required' } });
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO tax_rates(id,tenant_id,name,rate,hsn_sac,cgst_rate,sgst_rate,igst_rate,cess_rate,created_at,updated_at,version) VALUES(?,?,?,?,?,?,?,?,?,?,?,1)`
  ).run(id, t, name, rate || 0, hsn_sac || null, cgst_rate || null, sgst_rate || null, igst_rate || null, cess_rate || null, now(), now());
  res.status(201).json({ data: db.prepare(`SELECT * FROM tax_rates WHERE id=?`).get(id) });
});

// â”€â”€ ITEMS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/items', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { page, per_page, offset } = paginate(req);
  const search = req.query.search ? `%${req.query.search}%` : null;
  const cat = req.query.category_id;

  let where = `WHERE i.tenant_id=? AND i.deleted_at IS NULL`;
  const params = [t];
  if (search) { where += ` AND (i.name LIKE ? OR i.sku LIKE ?)`; params.push(search, search); }
  if (cat) { where += ` AND i.category_id=?`; params.push(cat); }

  const total = db.prepare(`SELECT COUNT(*) as n FROM items i ${where}`).get(...params).n;
  const rows = db.prepare(`
    SELECT i.*, ip.sale_price, ip.mrp, ip.purchase_price, ip.wholesale_price,
           u.name as unit_name, c.name as category_name, tr.rate as tax_rate,
           COALESCE((SELECT SUM(sm.qty) FROM stock_movements sm WHERE sm.item_id=i.id AND sm.tenant_id=i.tenant_id),0) as stock_qty
    FROM items i
    LEFT JOIN item_prices ip ON ip.item_id=i.id AND ip.tenant_id=i.tenant_id
    LEFT JOIN units u ON u.id=i.unit_id
    LEFT JOIN categories c ON c.id=i.category_id
    LEFT JOIN tax_rates tr ON tr.id=i.tax_rate_id
    ${where}
    ORDER BY i.name
    LIMIT ? OFFSET ?
  `).all(...params, per_page, offset);
  res.json(paginatedResponse(rows, total, page, per_page));
});

router.get('/items/:id', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const item = db.prepare(`
    SELECT i.*, ip.sale_price, ip.mrp, ip.purchase_price, ip.wholesale_price, ip.online_price,
           u.name as unit_name, c.name as category_name, tr.rate as tax_rate, tr.id as tax_rate_id,
           COALESCE((SELECT SUM(sm.qty) FROM stock_movements sm WHERE sm.item_id=i.id AND sm.tenant_id=?),0) as stock_qty
    FROM items i
    LEFT JOIN item_prices ip ON ip.item_id=i.id AND ip.tenant_id=i.tenant_id
    LEFT JOIN units u ON u.id=i.unit_id
    LEFT JOIN categories c ON c.id=i.category_id
    LEFT JOIN tax_rates tr ON tr.id=i.tax_rate_id
    WHERE i.id=? AND i.tenant_id=? AND i.deleted_at IS NULL
  `).get(t, req.params.id, t);
  if (!item) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Item not found' } });
  const barcodes = db.prepare(`SELECT barcode FROM barcodes WHERE item_id=? AND tenant_id=?`).all(req.params.id, t);
  res.json({ data: { ...item, barcodes: barcodes.map(b => b.barcode) } });
});

router.post('/items', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { name, sku, hsn_sac, description, category_id, unit_id, tax_rate_id, type = 'product',
    track_inventory = 1, low_stock_alert, opening_stock = 0, opening_stock_rate,
    sale_price, mrp, purchase_price, wholesale_price, wholesale_min_qty, online_price,
    barcodes: barcodeList = [] } = req.body;

  if (!name) return res.status(422).json({ error: { code: 'VALIDATION_FAILED', message: 'name required' } });

  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO items(id,tenant_id,name,sku,hsn_sac,description,category_id,unit_id,tax_rate_id,type,track_inventory,low_stock_alert,opening_stock,opening_stock_rate,created_at,updated_at,version,sync_state) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,'synced')`
  ).run(id, t, name, sku || null, hsn_sac || null, description || null, category_id || null, unit_id || null, tax_rate_id || null, type, track_inventory ? 1 : 0, low_stock_alert || null, opening_stock, opening_stock_rate || null, now(), now());

  const priceId = crypto.randomUUID();
  db.prepare(`INSERT INTO item_prices(id,tenant_id,item_id,sale_price,mrp,purchase_price,wholesale_price,wholesale_min_qty,online_price,created_at,updated_at,version) VALUES(?,?,?,?,?,?,?,?,?,?,?,1)`
  ).run(priceId, t, id, sale_price || null, mrp || null, purchase_price || null, wholesale_price || null, wholesale_min_qty || null, online_price || null, now(), now());

  if (opening_stock > 0) {
    db.prepare(`INSERT INTO stock_movements(id,tenant_id,item_id,movement_type,qty,rate,moved_at,created_at,updated_at,version,sync_state) VALUES(?,?,?,'opening',?,?,?,?,?,1,'synced')`
    ).run(crypto.randomUUID(), t, id, opening_stock, opening_stock_rate || null, now(), now(), now());
  }

  for (const bc of barcodeList) {
    try { db.prepare(`INSERT INTO barcodes(id,tenant_id,item_id,barcode) VALUES(?,?,?,?)`).run(crypto.randomUUID(), t, id, bc); } catch {}
  }

  res.status(201).json({ data: db.prepare(`SELECT * FROM items WHERE id=?`).get(id) });
});

router.put('/items/:id', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { name, sku, hsn_sac, description, category_id, unit_id, tax_rate_id, type, track_inventory, low_stock_alert,
    sale_price, mrp, purchase_price, wholesale_price, wholesale_min_qty, online_price } = req.body;

  db.prepare(`UPDATE items SET name=?,sku=?,hsn_sac=?,description=?,category_id=?,unit_id=?,tax_rate_id=?,type=?,track_inventory=?,low_stock_alert=?,updated_at=?,version=version+1 WHERE id=? AND tenant_id=?`
  ).run(name, sku || null, hsn_sac || null, description || null, category_id || null, unit_id || null, tax_rate_id || null, type || 'product', track_inventory ? 1 : 0, low_stock_alert || null, now(), req.params.id, t);

  db.prepare(`UPDATE item_prices SET sale_price=?,mrp=?,purchase_price=?,wholesale_price=?,wholesale_min_qty=?,online_price=?,updated_at=?,version=version+1 WHERE item_id=? AND tenant_id=?`
  ).run(sale_price || null, mrp || null, purchase_price || null, wholesale_price || null, wholesale_min_qty || null, online_price || null, now(), req.params.id, t);

  res.json({ data: db.prepare(`SELECT * FROM items WHERE id=?`).get(req.params.id) });
});

router.delete('/items/:id', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  db.prepare(`UPDATE items SET deleted_at=?,updated_at=? WHERE id=? AND tenant_id=?`).run(now(), now(), req.params.id, t);
  res.json({ data: { deleted: true } });
});

// stock adjustment
router.post('/items/:id/stock-adjustment', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { qty, reason, store_id, rate } = req.body;
  if (qty === undefined) return res.status(422).json({ error: { code: 'VALIDATION_FAILED', message: 'qty required' } });
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO stock_movements(id,tenant_id,item_id,store_id,movement_type,qty,rate,reason,moved_at,created_at,updated_at,version,sync_state) VALUES(?,?,?,?,'adjustment',?,?,?,?,?,?,1,'synced')`
  ).run(id, t, req.params.id, store_id || null, qty, rate || null, reason || null, now(), now(), now());
  res.status(201).json({ data: { id } });
});

export default router;

