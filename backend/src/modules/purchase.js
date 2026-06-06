import { Router } from 'express';
import { getDb } from '../database/db.js';
import { requireAuth } from '../middleware/auth.js';
import { paginate, paginatedResponse } from '../middleware/tenant.js';
import { calcLineTotal, calcDocTotals } from '../services/pricing.js';

const router = Router();
const now = () => new Date().toISOString();

function nextPurchaseNo(db, t, firmId, docType) {
  const seq = db.prepare(`SELECT * FROM document_sequences WHERE tenant_id=? AND firm_id=? AND doc_type=?`).get(t, firmId, docType);
  if (!seq) {
    const id = crypto.randomUUID();
    db.prepare(`INSERT INTO document_sequences(id,tenant_id,firm_id,doc_type,prefix,next_no) VALUES(?,?,?,?,?,1)`).run(id, t, firmId, docType, 'PUR-');
    return 'PUR-1';
  }
  const no = `${seq.prefix}${seq.next_no}`;
  db.prepare(`UPDATE document_sequences SET next_no=next_no+1 WHERE id=?`).run(seq.id);
  return no;
}

// â”€â”€ PURCHASES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/purchases', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { page, per_page, offset } = paginate(req);
  const { doc_type, status, from, to, party_id } = req.query;

  let where = `WHERE pd.tenant_id=? AND pd.deleted_at IS NULL`;
  const params = [t];
  if (doc_type) { where += ` AND pd.doc_type=?`; params.push(doc_type); }
  if (status)   { where += ` AND pd.status=?`; params.push(status); }
  if (from)     { where += ` AND pd.doc_date>=?`; params.push(from); }
  if (to)       { where += ` AND pd.doc_date<=?`; params.push(to); }
  if (party_id) { where += ` AND pd.party_id=?`; params.push(party_id); }

  const total = db.prepare(`SELECT COUNT(*) as n FROM purchase_documents pd ${where}`).get(...params).n;
  const rows = db.prepare(`
    SELECT pd.*, p.name as party_name FROM purchase_documents pd
    LEFT JOIN parties p ON p.id=pd.party_id
    ${where} ORDER BY pd.doc_date DESC LIMIT ? OFFSET ?
  `).all(...params, per_page, offset);
  res.json(paginatedResponse(rows, total, page, per_page));
});

router.get('/purchases/:id', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const doc = db.prepare(`SELECT pd.*, p.name as party_name FROM purchase_documents pd LEFT JOIN parties p ON p.id=pd.party_id WHERE pd.id=? AND pd.tenant_id=? AND pd.deleted_at IS NULL`).get(req.params.id, t);
  if (!doc) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Purchase not found' } });
  const items = db.prepare(`SELECT * FROM purchase_document_items WHERE document_id=? AND tenant_id=?`).all(req.params.id, t);
  const payments = db.prepare(`SELECT * FROM payments WHERE doc_id=? AND tenant_id=?`).all(req.params.id, t);
  res.json({ data: { ...doc, items, payments } });
});

router.post('/purchases', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { firm_id, doc_type = 'purchase', doc_date, party_id, grn_no, items: rawItems = [], payments: rawPayments = [], round_off = 0 } = req.body;
  if (!firm_id) return res.status(422).json({ error: { code: 'VALIDATION_FAILED', message: 'firm_id required' } });

  const docId = crypto.randomUUID();
  const doc_no = nextPurchaseNo(db, t, firm_id, doc_type);
  const date = doc_date || new Date().toISOString().slice(0, 10);

  const processedItems = rawItems.map(it => {
    const { discount_amt, tax_amt, line_total } = calcLineTotal(it.price_unit, it.qty, 0, it.discount_amt || 0, it.tax_pct || 0, 0);
    return { ...it, discount_amt, tax_amt, line_total };
  });

  const { sub_total, discount_amt, tax_amt } = calcDocTotals(processedItems);
  const total = sub_total - discount_amt + tax_amt + round_off;
  const paid_amt = rawPayments.reduce((s, p) => s + (p.amount || 0), 0);
  const balance_amt = Math.max(0, total - paid_amt);
  const status = balance_amt <= 0 ? 'paid' : paid_amt > 0 ? 'partial' : 'open';

  const tx = db.transaction(() => {
    db.prepare(`INSERT INTO purchase_documents(id,tenant_id,firm_id,doc_type,doc_no,doc_date,party_id,grn_no,sub_total,discount_amt,tax_amt,round_off,total,paid_amt,balance_amt,status,created_at,updated_at,version,sync_state) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,'synced')`
    ).run(docId, t, firm_id, doc_type, doc_no, date, party_id || null, grn_no || null, sub_total, discount_amt, tax_amt, round_off, total, paid_amt, balance_amt, status, now(), now());

    for (const it of processedItems) {
      db.prepare(`INSERT INTO purchase_document_items(id,tenant_id,document_id,item_id,item_name,hsn_sac,qty,unit,price_unit,discount_amt,tax_pct,tax_amt,line_total,mrp,sale_price) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).run(crypto.randomUUID(), t, docId, it.item_id || null, it.item_name, it.hsn_sac || null, it.qty, it.unit || null, it.price_unit, it.discount_amt, it.tax_pct || 0, it.tax_amt, it.line_total, it.mrp || null, it.sale_price || null);

      // stock in
      if (it.item_id) {
        db.prepare(`INSERT INTO stock_movements(id,tenant_id,item_id,movement_type,qty,rate,ref_doc_type,ref_doc_id,moved_at,created_at,updated_at,version,sync_state) VALUES(?,?,?,'purchase',?,?,'purchase',?,?,?,?,1,'synced')`
        ).run(crypto.randomUUID(), t, it.item_id, it.qty, it.price_unit, docId, now(), now(), now());

        // update purchase price on item
        if (it.price_unit) db.prepare(`UPDATE item_prices SET purchase_price=?,updated_at=? WHERE item_id=? AND tenant_id=?`).run(it.price_unit, now(), it.item_id, t);
        if (it.sale_price) db.prepare(`UPDATE item_prices SET sale_price=?,updated_at=? WHERE item_id=? AND tenant_id=?`).run(it.sale_price, now(), it.item_id, t);
        if (it.mrp) db.prepare(`UPDATE item_prices SET mrp=?,updated_at=? WHERE item_id=? AND tenant_id=?`).run(it.mrp, now(), it.item_id, t);
      }
    }

    for (const pay of rawPayments) {
      db.prepare(`INSERT INTO payments(id,tenant_id,firm_id,party_id,direction,doc_id,pay_mode,amount,pay_date,created_at,updated_at,version,sync_state) VALUES(?,?,?,?,'out',?,?,?,?,?,?,1,'synced')`
      ).run(crypto.randomUUID(), t, firm_id, party_id || null, docId, pay.pay_mode || 'cash', pay.amount, date, now(), now());
    }

    if (party_id && balance_amt > 0) {
      db.prepare(`UPDATE party_balances SET payable=payable+?,updated_at=? WHERE tenant_id=? AND party_id=?`).run(balance_amt, now(), t, party_id);
    }
  });
  tx();

  res.status(201).json({ data: db.prepare(`SELECT * FROM purchase_documents WHERE id=?`).get(docId) });
});

// â”€â”€ PURCHASE ORDERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/purchase-orders', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { page, per_page, offset } = paginate(req);
  const total = db.prepare(`SELECT COUNT(*) as n FROM purchase_orders WHERE tenant_id=? AND deleted_at IS NULL`).get(t).n;
  const rows = db.prepare(`SELECT po.*, p.name as party_name FROM purchase_orders po LEFT JOIN parties p ON p.id=po.party_id WHERE po.tenant_id=? AND po.deleted_at IS NULL ORDER BY po.po_date DESC LIMIT ? OFFSET ?`).all(t, per_page, offset);
  res.json(paginatedResponse(rows, total, page, per_page));
});

router.post('/purchase-orders', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { firm_id, po_date, due_date, party_id, items = [] } = req.body;
  if (!firm_id) return res.status(422).json({ error: { code: 'VALIDATION_FAILED', message: 'firm_id required' } });

  const id = crypto.randomUUID();
  const seq = db.prepare(`SELECT * FROM document_sequences WHERE tenant_id=? AND firm_id=? AND doc_type='po'`).get(t, firm_id);
  const po_no = seq ? `PO-${seq.next_no}` : 'PO-1';
  if (seq) db.prepare(`UPDATE document_sequences SET next_no=next_no+1 WHERE id=?`).run(seq.id);
  else db.prepare(`INSERT INTO document_sequences(id,tenant_id,firm_id,doc_type,prefix,next_no) VALUES(?,?,?,'po','PO-',2)`).run(crypto.randomUUID(), t, firm_id);

  const total = items.reduce((s, it) => s + (it.qty * it.price_unit), 0);
  db.prepare(`INSERT INTO purchase_orders(id,tenant_id,firm_id,po_no,po_date,due_date,party_id,status,total,items,created_at,updated_at,version) VALUES(?,?,?,?,?,?,?,'draft',?,?,?,?,1)`
  ).run(id, t, firm_id, po_no, po_date || new Date().toISOString().slice(0,10), due_date || null, party_id || null, total, JSON.stringify(items), now(), now());

  res.status(201).json({ data: db.prepare(`SELECT * FROM purchase_orders WHERE id=?`).get(id) });
});

// â”€â”€ EXPENSES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/expenses', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { page, per_page, offset } = paginate(req);
  const { from, to } = req.query;
  let where = `WHERE tenant_id=? AND deleted_at IS NULL`;
  const params = [t];
  if (from) { where += ` AND exp_date>=?`; params.push(from); }
  if (to)   { where += ` AND exp_date<=?`; params.push(to); }
  const total = db.prepare(`SELECT COUNT(*) as n FROM expenses ${where}`).get(...params).n;
  const rows = db.prepare(`SELECT * FROM expenses ${where} ORDER BY exp_date DESC LIMIT ? OFFSET ?`).all(...params, per_page, offset);
  res.json(paginatedResponse(rows, total, page, per_page));
});

router.post('/expenses', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { firm_id, category, amount, tax_amt = 0, exp_date, party_id, pay_mode, notes } = req.body;
  if (!firm_id || !amount) return res.status(422).json({ error: { code: 'VALIDATION_FAILED', message: 'firm_id and amount required' } });
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO expenses(id,tenant_id,firm_id,category,amount,tax_amt,exp_date,party_id,pay_mode,notes,created_at,updated_at,version) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,1)`
  ).run(id, t, firm_id, category || null, amount, tax_amt, exp_date || new Date().toISOString().slice(0,10), party_id || null, pay_mode || null, notes || null, now(), now());
  res.status(201).json({ data: db.prepare(`SELECT * FROM expenses WHERE id=?`).get(id) });
});

export default router;

