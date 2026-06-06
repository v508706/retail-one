import { Router } from 'express';
import { getDb } from '../database/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const now = () => new Date().toISOString();

router.get('/loyalty/rules', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  res.json({ data: db.prepare(`SELECT * FROM loyalty_rules WHERE tenant_id=? AND is_active=1`).all(t) });
});

router.put('/loyalty/rules/:id', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { earn_per_amount, redeem_value, is_active } = req.body;
  db.prepare(`UPDATE loyalty_rules SET earn_per_amount=?,redeem_value=?,is_active=? WHERE id=? AND tenant_id=?`
  ).run(earn_per_amount || 0, redeem_value || 0, is_active ? 1 : 0, req.params.id, t);
  res.json({ data: db.prepare(`SELECT * FROM loyalty_rules WHERE id=?`).get(req.params.id) });
});

router.post('/loyalty/earn', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { party_id, amount, doc_id } = req.body;
  if (!party_id || !amount) return res.status(422).json({ error: { code: 'VALIDATION_FAILED', message: 'party_id and amount required' } });

  const rule = db.prepare(`SELECT * FROM loyalty_rules WHERE tenant_id=? AND is_active=1 LIMIT 1`).get(t);
  if (!rule) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No active loyalty rule' } });

  const points = Math.floor(amount / rule.earn_per_amount);
  if (points <= 0) return res.json({ data: { points: 0, message: 'Minimum not reached' } });

  db.prepare(`INSERT INTO point_transactions(id,tenant_id,party_id,doc_id,points,type,txn_date,created_at) VALUES(?,?,?,?,?,'earn',?,?)`
  ).run(crypto.randomUUID(), t, party_id, doc_id || null, points, new Date().toISOString().slice(0,10), now());
  db.prepare(`UPDATE party_balances SET points=points+?,updated_at=? WHERE tenant_id=? AND party_id=?`
  ).run(points, now(), t, party_id);

  res.json({ data: { points } });
});

router.post('/loyalty/redeem', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { party_id, points, doc_id } = req.body;
  if (!party_id || !points) return res.status(422).json({ error: { code: 'VALIDATION_FAILED', message: 'party_id and points required' } });

  const balance = db.prepare(`SELECT points FROM party_balances WHERE tenant_id=? AND party_id=?`).get(t, party_id);
  if (!balance || balance.points < points) return res.status(422).json({ error: { code: 'VALIDATION_FAILED', message: 'Insufficient points' } });

  const rule = db.prepare(`SELECT * FROM loyalty_rules WHERE tenant_id=? AND is_active=1 LIMIT 1`).get(t);
  const value = points * (rule?.redeem_value || 1);

  db.prepare(`INSERT INTO point_transactions(id,tenant_id,party_id,doc_id,points,type,txn_date,created_at) VALUES(?,?,?,?,?,'redeem',?,?)`
  ).run(crypto.randomUUID(), t, party_id, doc_id || null, -points, new Date().toISOString().slice(0,10), now());
  db.prepare(`UPDATE party_balances SET points=points-?,updated_at=? WHERE tenant_id=? AND party_id=?`
  ).run(points, now(), t, party_id);

  res.json({ data: { points_redeemed: points, value } });
});

router.get('/loyalty/transactions', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { party_id } = req.query;
  let where = `WHERE pt.tenant_id=?`;
  const params = [t];
  if (party_id) { where += ` AND pt.party_id=?`; params.push(party_id); }
  const rows = db.prepare(`SELECT pt.*, p.name as party_name FROM point_transactions pt JOIN parties p ON p.id=pt.party_id ${where} ORDER BY pt.created_at DESC LIMIT 100`).all(...params);
  res.json({ data: rows });
});

export default router;

