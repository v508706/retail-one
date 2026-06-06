import { Router } from 'express';
import { getDb } from '../database/db.js';
import { requireAuth } from '../middleware/auth.js';
import { paginate, paginatedResponse } from '../middleware/tenant.js';

const router = Router();
const now = () => new Date().toISOString();

router.get('/parties', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { page, per_page, offset } = paginate(req);
  const { search, role } = req.query;

  let where = `WHERE p.tenant_id=? AND p.deleted_at IS NULL`;
  const params = [t];
  if (search) { where += ` AND (p.name LIKE ? OR p.phone LIKE ?)`; params.push(`%${search}%`, `%${search}%`); }
  if (role) { where += ` AND p.role IN (?, 'both')`; params.push(role); }

  const total = db.prepare(`SELECT COUNT(*) as n FROM parties p ${where}`).get(...params).n;
  const rows = db.prepare(`
    SELECT p.*, pb.receivable, pb.payable, pb.points
    FROM parties p
    LEFT JOIN party_balances pb ON pb.party_id=p.id AND pb.tenant_id=p.tenant_id
    ${where} ORDER BY p.name LIMIT ? OFFSET ?
  `).all(...params, per_page, offset);
  res.json(paginatedResponse(rows, total, page, per_page));
});

router.get('/parties/:id', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const party = db.prepare(`
    SELECT p.*, pb.receivable, pb.payable, pb.points
    FROM parties p
    LEFT JOIN party_balances pb ON pb.party_id=p.id AND pb.tenant_id=p.tenant_id
    WHERE p.id=? AND p.tenant_id=? AND p.deleted_at IS NULL
  `).get(req.params.id, t);
  if (!party) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Party not found' } });
  res.json({ data: party });
});

router.post('/parties', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { name, role = 'customer', gstin, gst_type = 'consumer', phone, email,
    billing_address, shipping_address, area, city, state, state_code,
    party_group_id, customer_type, opening_balance = 0, credit_limit, due_days, loyalty_card } = req.body;
  if (!name) return res.status(422).json({ error: { code: 'VALIDATION_FAILED', message: 'name required' } });

  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO parties(id,tenant_id,role,name,gstin,gst_type,phone,email,billing_address,shipping_address,area,city,state,state_code,party_group_id,customer_type,opening_balance,credit_limit,due_days,loyalty_card,created_at,updated_at,version,sync_state) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,'synced')`
  ).run(id, t, role, name, gstin || null, gst_type, phone || null, email || null, billing_address || null, shipping_address || null, area || null, city || null, state || null, state_code || null, party_group_id || null, customer_type || null, opening_balance, credit_limit || null, due_days || null, loyalty_card || null, now(), now());

  db.prepare(`INSERT OR IGNORE INTO party_balances(id,tenant_id,party_id,receivable,payable,points,updated_at) VALUES(?,?,?,0,0,0,?)`
  ).run(crypto.randomUUID(), t, id, now());

  res.status(201).json({ data: db.prepare(`SELECT * FROM parties WHERE id=?`).get(id) });
});

router.put('/parties/:id', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { name, role, gstin, gst_type, phone, email, billing_address, shipping_address,
    area, city, state, state_code, customer_type, credit_limit, due_days, loyalty_card } = req.body;

  db.prepare(`UPDATE parties SET name=?,role=?,gstin=?,gst_type=?,phone=?,email=?,billing_address=?,shipping_address=?,area=?,city=?,state=?,state_code=?,customer_type=?,credit_limit=?,due_days=?,loyalty_card=?,updated_at=?,version=version+1 WHERE id=? AND tenant_id=?`
  ).run(name, role || 'customer', gstin || null, gst_type || 'consumer', phone || null, email || null, billing_address || null, shipping_address || null, area || null, city || null, state || null, state_code || null, customer_type || null, credit_limit || null, due_days || null, loyalty_card || null, now(), req.params.id, t);

  res.json({ data: db.prepare(`SELECT * FROM parties WHERE id=?`).get(req.params.id) });
});

router.delete('/parties/:id', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  db.prepare(`UPDATE parties SET deleted_at=?,updated_at=? WHERE id=? AND tenant_id=?`).run(now(), now(), req.params.id, t);
  res.json({ data: { deleted: true } });
});

// party statement
router.get('/parties/:id/statement', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { from, to } = req.query;
  let dateFilter = ''; const params = [t, req.params.id];
  if (from) { dateFilter += ` AND doc_date >= ?`; params.push(from); }
  if (to)   { dateFilter += ` AND doc_date <= ?`; params.push(to); }

  const sales = db.prepare(`SELECT id, doc_type, doc_no, doc_date, total, paid_amt, balance_amt, status FROM sale_documents WHERE tenant_id=? AND party_id=? AND deleted_at IS NULL ${dateFilter} ORDER BY doc_date`).all(...params);
  const purchases = db.prepare(`SELECT id, doc_type, doc_no, doc_date, total, paid_amt, balance_amt, status FROM purchase_documents WHERE tenant_id=? AND party_id=? AND deleted_at IS NULL ${dateFilter} ORDER BY doc_date`).all(...params);
  const payments = db.prepare(`SELECT id, direction, pay_mode, amount, pay_date, reference FROM payments WHERE tenant_id=? AND party_id=? ${dateFilter.replace(/doc_date/g,'pay_date')} ORDER BY pay_date`).all(...params);

  res.json({ data: { sales, purchases, payments } });
});

// party groups
router.get('/party-groups', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  res.json({ data: db.prepare(`SELECT * FROM party_groups WHERE tenant_id=? ORDER BY name`).all(t) });
});

router.post('/party-groups', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { name } = req.body;
  if (!name) return res.status(422).json({ error: { code: 'VALIDATION_FAILED', message: 'name required' } });
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO party_groups(id,tenant_id,name) VALUES(?,?,?)`).run(id, t, name);
  res.status(201).json({ data: { id, tenant_id: t, name } });
});

export default router;

