import { Router } from 'express';
import { getDb } from '../database/db.js';
import { requireAuth } from '../middleware/auth.js';
import { paginate, paginatedResponse } from '../middleware/tenant.js';

const router = Router();
const now = () => new Date().toISOString();

// â”€â”€ BANKS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/banks', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const rows = db.prepare(`SELECT b.*, COALESCE(b.opening_balance + COALESCE(sin.amount,0) - COALESCE(sout.amount,0),b.opening_balance) as current_balance FROM banks b LEFT JOIN (SELECT bank_id, SUM(amount) as amount FROM payments WHERE tenant_id=? AND direction='in' GROUP BY bank_id) sin ON sin.bank_id=b.id LEFT JOIN (SELECT bank_id, SUM(amount) as amount FROM payments WHERE tenant_id=? AND direction='out' GROUP BY bank_id) sout ON sout.bank_id=b.id WHERE b.tenant_id=? AND b.deleted_at IS NULL`).all(t, t, t);
  res.json({ data: rows });
});

router.post('/banks', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { firm_id, account_no, account_name, bank_name, branch, ifsc, opening_balance = 0, remarks } = req.body;
  if (!firm_id) return res.status(422).json({ error: { code: 'VALIDATION_FAILED', message: 'firm_id required' } });
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO banks(id,tenant_id,firm_id,account_no,account_name,bank_name,branch,ifsc,opening_balance,remarks,created_at,updated_at,version) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,1)`
  ).run(id, t, firm_id, account_no || null, account_name || null, bank_name || null, branch || null, ifsc || null, opening_balance, remarks || null, now(), now());
  res.status(201).json({ data: db.prepare(`SELECT * FROM banks WHERE id=?`).get(id) });
});

router.put('/banks/:id', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { account_no, account_name, bank_name, branch, ifsc, remarks } = req.body;
  db.prepare(`UPDATE banks SET account_no=?,account_name=?,bank_name=?,branch=?,ifsc=?,remarks=?,updated_at=?,version=version+1 WHERE id=? AND tenant_id=?`
  ).run(account_no || null, account_name || null, bank_name || null, branch || null, ifsc || null, remarks || null, now(), req.params.id, t);
  res.json({ data: db.prepare(`SELECT * FROM banks WHERE id=?`).get(req.params.id) });
});

// â”€â”€ CHEQUES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/cheques', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { status, direction } = req.query;
  let where = `WHERE c.tenant_id=?`;
  const params = [t];
  if (status) { where += ` AND c.status=?`; params.push(status); }
  if (direction) { where += ` AND c.direction=?`; params.push(direction); }
  const rows = db.prepare(`SELECT c.*, p.name as party_name, b.bank_name FROM cheques c LEFT JOIN parties p ON p.id=c.party_id LEFT JOIN banks b ON b.id=c.bank_id ${where} ORDER BY c.due_date`).all(...params);
  res.json({ data: rows });
});

router.post('/cheques', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { bank_id, party_id, cheque_no, amount, direction, due_date } = req.body;
  if (!amount || !direction) return res.status(422).json({ error: { code: 'VALIDATION_FAILED', message: 'amount and direction required' } });
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO cheques(id,tenant_id,bank_id,party_id,cheque_no,amount,direction,status,due_date,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'open',?,?,?)`
  ).run(id, t, bank_id || null, party_id || null, cheque_no || null, amount, direction, due_date || null, now(), now());
  res.status(201).json({ data: db.prepare(`SELECT * FROM cheques WHERE id=?`).get(id) });
});

router.patch('/cheques/:id/status', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { status } = req.body;
  db.prepare(`UPDATE cheques SET status=?,updated_at=? WHERE id=? AND tenant_id=?`).run(status, now(), req.params.id, t);
  res.json({ data: db.prepare(`SELECT * FROM cheques WHERE id=?`).get(req.params.id) });
});

// â”€â”€ VOUCHERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/vouchers', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { page, per_page, offset } = paginate(req);
  const total = db.prepare(`SELECT COUNT(*) as n FROM vouchers WHERE tenant_id=? AND deleted_at IS NULL`).get(t).n;
  const rows = db.prepare(`SELECT * FROM vouchers WHERE tenant_id=? AND deleted_at IS NULL ORDER BY voucher_date DESC LIMIT ? OFFSET ?`).all(t, per_page, offset);
  res.json(paginatedResponse(rows, total, page, per_page));
});

router.post('/vouchers', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { firm_id, voucher_type, voucher_date, narration, amount, entries = [] } = req.body;
  if (!firm_id || !voucher_type || !amount) return res.status(422).json({ error: { code: 'VALIDATION_FAILED', message: 'firm_id, voucher_type, amount required' } });

  const id = crypto.randomUUID();
  const vno = `${voucher_type.toUpperCase().slice(0,3)}-${Date.now()}`;
  db.prepare(`INSERT INTO vouchers(id,tenant_id,firm_id,voucher_type,voucher_no,voucher_date,narration,amount,created_at,updated_at,version) VALUES(?,?,?,?,?,?,?,?,?,?,1)`
  ).run(id, t, firm_id, voucher_type, vno, voucher_date || new Date().toISOString().slice(0,10), narration || null, amount, now(), now());

  for (const e of entries) {
    db.prepare(`INSERT INTO journal_entries(id,tenant_id,voucher_id,ledger_id,debit,credit) VALUES(?,?,?,?,?,?)`
    ).run(crypto.randomUUID(), t, id, e.ledger_id, e.debit || 0, e.credit || 0);
  }

  res.status(201).json({ data: db.prepare(`SELECT * FROM vouchers WHERE id=?`).get(id) });
});

// â”€â”€ LEDGERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/ledgers', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const rows = db.prepare(`SELECT la.*, ag.name as group_name, ag.nature FROM ledger_accounts la LEFT JOIN account_groups ag ON ag.id=la.group_id WHERE la.tenant_id=? AND la.deleted_at IS NULL ORDER BY la.name`).all(t);
  res.json({ data: rows });
});

router.post('/ledgers', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { firm_id, name, group_id, opening_balance = 0, party_id } = req.body;
  if (!name) return res.status(422).json({ error: { code: 'VALIDATION_FAILED', message: 'name required' } });
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO ledger_accounts(id,tenant_id,firm_id,name,group_id,opening_balance,party_id,created_at,updated_at,version) VALUES(?,?,?,?,?,?,?,?,?,1)`
  ).run(id, t, firm_id || null, name, group_id || null, opening_balance, party_id || null, now(), now());
  res.status(201).json({ data: db.prepare(`SELECT * FROM ledger_accounts WHERE id=?`).get(id) });
});

// â”€â”€ ACCOUNT GROUPS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/account-groups', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  res.json({ data: db.prepare(`SELECT * FROM account_groups WHERE tenant_id=? ORDER BY nature, name`).all(t) });
});

router.post('/account-groups', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { name, nature, parent_id } = req.body;
  if (!name || !nature) return res.status(422).json({ error: { code: 'VALIDATION_FAILED', message: 'name and nature required' } });
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO account_groups(id,tenant_id,name,nature,parent_id) VALUES(?,?,?,?,?)`
  ).run(id, t, name, nature, parent_id || null);
  res.status(201).json({ data: { id, tenant_id: t, name, nature, parent_id } });
});

// â”€â”€ LOANS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/loans', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  res.json({ data: db.prepare(`SELECT * FROM loans WHERE tenant_id=? ORDER BY created_at DESC`).all(t) });
});

router.post('/loans', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { firm_id, lender, principal, interest_rate, start_date } = req.body;
  if (!firm_id || !principal) return res.status(422).json({ error: { code: 'VALIDATION_FAILED', message: 'firm_id and principal required' } });
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO loans(id,tenant_id,firm_id,lender,principal,balance,interest_rate,start_date,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)`
  ).run(id, t, firm_id, lender || null, principal, principal, interest_rate || null, start_date || null, now(), now());
  res.status(201).json({ data: db.prepare(`SELECT * FROM loans WHERE id=?`).get(id) });
});

export default router;

