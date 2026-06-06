import { Router } from 'express';
import { getDb } from '../database/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const now = () => new Date().toISOString();

// â”€â”€ ADMIN ROUTES (authenticated) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/online-store/settings', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const settings = db.prepare(`SELECT * FROM store_settings WHERE tenant_id=? LIMIT 1`).get(t);
  res.json({ data: settings });
});

router.put('/online-store/settings', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { title, theme, is_enabled, delivery_enabled, pickup_enabled, online_payment } = req.body;
  const existing = db.prepare(`SELECT * FROM store_settings WHERE tenant_id=? LIMIT 1`).get(t);
  if (existing) {
    db.prepare(`UPDATE store_settings SET title=?,theme=?,is_enabled=?,delivery_enabled=?,pickup_enabled=?,online_payment=?,updated_at=? WHERE id=?`
    ).run(title || existing.title, theme || existing.theme, is_enabled ? 1 : 0, delivery_enabled ? 1 : 0, pickup_enabled ? 1 : 0, online_payment ? 1 : 0, now(), existing.id);
    res.json({ data: db.prepare(`SELECT * FROM store_settings WHERE id=?`).get(existing.id) });
  } else {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Store settings not configured' } });
  }
});

router.get('/online-store/orders', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { status } = req.query;
  let where = `WHERE tenant_id=?`;
  const params = [t];
  if (status) { where += ` AND status=?`; params.push(status); }
  const rows = db.prepare(`SELECT * FROM online_orders ${where} ORDER BY created_at DESC LIMIT 100`).all(...params);
  res.json({ data: rows });
});

router.patch('/online-store/orders/:id/status', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { status } = req.body;
  db.prepare(`UPDATE online_orders SET status=?,updated_at=? WHERE id=? AND tenant_id=?`).run(status, now(), req.params.id, t);
  res.json({ data: db.prepare(`SELECT * FROM online_orders WHERE id=?`).get(req.params.id) });
});

// â”€â”€ PUBLIC STORE ROUTES (unauthenticated) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/store/:slug', (req, res) => {
  const db = getDb();
  const settings = db.prepare(`SELECT ss.*, f.name as firm_name, f.phone, f.email, f.address FROM store_settings ss JOIN firms f ON f.id=ss.firm_id WHERE ss.slug=? AND ss.is_enabled=1`).get(req.params.slug);
  if (!settings) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Store not found' } });
  res.json({ data: settings });
});

router.get('/store/:slug/products', (req, res) => {
  const db = getDb();
  const settings = db.prepare(`SELECT * FROM store_settings WHERE slug=? AND is_enabled=1`).get(req.params.slug);
  if (!settings) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Store not found' } });

  const { search, category_id } = req.query;
  let where = `WHERE i.tenant_id=? AND i.deleted_at IS NULL AND ip.online_price IS NOT NULL`;
  const params = [settings.tenant_id];
  if (search) { where += ` AND i.name LIKE ?`; params.push(`%${search}%`); }
  if (category_id) { where += ` AND i.category_id=?`; params.push(category_id); }

  const items = db.prepare(`SELECT i.id, i.name, i.description, i.item_image_url, ip.online_price, ip.mrp, c.name as category, COALESCE(SUM(sm.qty),0) as in_stock FROM items i LEFT JOIN item_prices ip ON ip.item_id=i.id AND ip.tenant_id=i.tenant_id LEFT JOIN categories c ON c.id=i.category_id LEFT JOIN stock_movements sm ON sm.item_id=i.id AND sm.tenant_id=i.tenant_id ${where} GROUP BY i.id ORDER BY i.name`).all(...params);
  res.json({ data: items.filter(i => i.in_stock > 0 || !i.track_inventory) });
});

router.post('/store/:slug/order', (req, res) => {
  const db = getDb();
  const settings = db.prepare(`SELECT * FROM store_settings WHERE slug=? AND is_enabled=1`).get(req.params.slug);
  if (!settings) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Store not found' } });

  const { customer_name, customer_phone, customer_email, address, fulfilment = 'pickup', items = [] } = req.body;
  if (!customer_name || items.length === 0) {
    return res.status(422).json({ error: { code: 'VALIDATION_FAILED', message: 'customer_name and items required' } });
  }

  const t = settings.tenant_id;
  const total = items.reduce((s, i) => s + (i.qty * i.price), 0);
  const orderNo = `ONL-${Date.now()}`;
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO online_orders(id,tenant_id,firm_id,order_no,customer_name,customer_phone,customer_email,address,fulfilment,items,total,payment_status,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,'unpaid','new',?,?)`
  ).run(id, t, settings.firm_id, orderNo, customer_name, customer_phone || null, customer_email || null, address || null, fulfilment, JSON.stringify(items), total, now(), now());

  res.status(201).json({ data: { id, order_no: orderNo, total, status: 'new' } });
});

export default router;

