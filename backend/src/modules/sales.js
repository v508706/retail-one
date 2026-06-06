import { Router } from 'express';
import { getDb } from '../database/db.js';
import { requireAuth } from '../middleware/auth.js';
import { paginate, paginatedResponse } from '../middleware/tenant.js';
import { calcLineTotal, calcGSTSplit, calcDocTotals } from '../services/pricing.js';

const router = Router();
const now = () => new Date().toISOString();

function nextDocNo(db, tenantId, firmId, terminalId, docType) {
  // Must be called INSIDE a transaction for atomicity.
  // Use `IS ?` so NULL terminal_id matches correctly (NULL IS NULL = true in SQLite).
  const tid = terminalId || null;
  const defaultPrefix = docType.toUpperCase().slice(0, 3) + '-';

  let seq = db.prepare(
    `SELECT * FROM document_sequences
     WHERE tenant_id=? AND firm_id=? AND doc_type=?
     AND (terminal_id IS ? OR terminal_id=?)`
  ).get(tenantId, firmId, docType, tid, tid);

  if (!seq) {
    // Create sequence. Start next_no at 2 so the NEXT call correctly gets 2.
    db.prepare(
      `INSERT INTO document_sequences(id,tenant_id,firm_id,terminal_id,doc_type,prefix,next_no)
       VALUES(?,?,?,?,?,?,2)`
    ).run(crypto.randomUUID(), tenantId, firmId, tid, docType, defaultPrefix);
    return `${defaultPrefix}1`;   // this call uses 1
  }

  // Read the current value, then increment.
  const used = seq.next_no;
  db.prepare(`UPDATE document_sequences SET next_no=next_no+1 WHERE id=?`).run(seq.id);
  return `${seq.prefix}${used}`;
}

function postSaleDoc(db, tenantId, docId, doc, items) {
  // event-sourced stock: write movements for sales (negative qty)
  if (doc.doc_type === 'invoice' || doc.doc_type === 'pos') {
    for (const it of items) {
      if (it.item_id) {
        db.prepare(`INSERT INTO stock_movements(id,tenant_id,item_id,store_id,movement_type,qty,rate,ref_doc_type,ref_doc_id,moved_at,created_at,updated_at,version,sync_state) VALUES(?,?,?,?,'sale',?,?,?,?,?,?,?,1,'synced')`
        ).run(crypto.randomUUID(), tenantId, it.item_id, doc.store_id || null, -(it.qty), it.price_unit, 'sale', docId, now(), now(), now());
      }
    }
  }
  // update party balance
  if (doc.party_id && doc.balance_amt > 0) {
    db.prepare(`UPDATE party_balances SET receivable=receivable+?,updated_at=? WHERE tenant_id=? AND party_id=?`
    ).run(doc.balance_amt, now(), tenantId, doc.party_id);
  }
}

// LIST
router.get('/sales', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { page, per_page, offset } = paginate(req);
  const { doc_type, status, from, to, party_id, search } = req.query;

  let where = `WHERE sd.tenant_id=? AND sd.deleted_at IS NULL`;
  const params = [t];
  if (doc_type) { where += ` AND sd.doc_type=?`; params.push(doc_type); }
  if (status)   { where += ` AND sd.status=?`;   params.push(status); }
  if (from)     { where += ` AND sd.doc_date>=?`; params.push(from); }
  if (to)       { where += ` AND sd.doc_date<=?`; params.push(to); }
  if (party_id) { where += ` AND sd.party_id=?`;  params.push(party_id); }
  if (search)   { where += ` AND (sd.doc_no LIKE ? OR p.name LIKE ?)`; params.push(`%${search}%`, `%${search}%`); }

  const total = db.prepare(`SELECT COUNT(*) as n FROM sale_documents sd LEFT JOIN parties p ON p.id=sd.party_id ${where}`).get(...params).n;
  const rows = db.prepare(`
    SELECT sd.*, p.name as party_name, p.phone as party_phone
    FROM sale_documents sd
    LEFT JOIN parties p ON p.id=sd.party_id
    ${where}
    ORDER BY sd.doc_date DESC, sd.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, per_page, offset);
  res.json(paginatedResponse(rows, total, page, per_page));
});

// GET one
router.get('/sales/:id', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const doc = db.prepare(`SELECT sd.*, p.name as party_name, p.phone as party_phone, p.gstin as party_gstin, p.billing_address, p.state as party_state FROM sale_documents sd LEFT JOIN parties p ON p.id=sd.party_id WHERE sd.id=? AND sd.tenant_id=? AND sd.deleted_at IS NULL`).get(req.params.id, t);
  if (!doc) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found' } });
  const items = db.prepare(`SELECT * FROM sale_document_items WHERE document_id=? AND tenant_id=?`).all(req.params.id, t);
  const payments = db.prepare(`SELECT * FROM payments WHERE doc_id=? AND tenant_id=?`).all(req.params.id, t);
  res.json({ data: { ...doc, items, payments } });
});

// CREATE
router.post('/sales', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const {
    firm_id, store_id, terminal_id, doc_type = 'invoice', doc_date, due_date,
    party_id, ref_no, price_type = 'retail', notes, terms, other_charges = 0, round_off = 0,
    items: rawItems = [], payments: rawPayments = [], state_of_supply, orig_doc_id,
  } = req.body;

  if (!firm_id) return res.status(422).json({ error: { code: 'VALIDATION_FAILED', message: 'firm_id required' } });

  const docId = crypto.randomUUID();
  const date = doc_date || new Date().toISOString().slice(0, 10);

  // calc items (pure computation — outside transaction is fine)
  const processedItems = rawItems.map(it => {
    const { discount_amt, tax_amt, line_total } = calcLineTotal(
      it.price_unit, it.qty, it.discount_pct || 0, it.discount_amt || 0, it.tax_pct || 0, it.price_tax_incl || 0
    );
    const { cgst, sgst, igst } = calcGSTSplit(it.tax_pct || 0, tax_amt, null, null);
    return { ...it, discount_amt, tax_amt, line_total, cgst, sgst, igst };
  });

  const { sub_total, discount_amt, tax_amt } = calcDocTotals(processedItems);
  const total = sub_total - discount_amt + tax_amt + other_charges + round_off;

  // payment
  const paid_amt = rawPayments.reduce((s, p) => s + (p.amount || 0), 0);
  const balance_amt = Math.max(0, total - paid_amt);
  const status = balance_amt <= 0 ? 'paid' : paid_amt > 0 ? 'partial' : 'open';

  const tx = db.transaction(() => {
    // Generate doc_no INSIDE the transaction so the sequence increment
    // and the INSERT are atomic — prevents duplicate numbers on retry or
    // concurrent requests.
    const doc_no = nextDocNo(db, t, firm_id, terminal_id, doc_type);

    db.prepare(`INSERT INTO sale_documents(id,tenant_id,firm_id,store_id,terminal_id,doc_type,doc_no,doc_date,due_date,party_id,state_of_supply,ref_no,orig_doc_id,price_type,sub_total,discount_amt,tax_amt,other_charges,round_off,total,paid_amt,balance_amt,status,notes,terms,created_by,created_at,updated_at,version,sync_state) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,'synced')`
    ).run(docId, t, firm_id, store_id || null, terminal_id || null, doc_type, doc_no, date, due_date || null, party_id || null, state_of_supply || null, ref_no || null, orig_doc_id || null, price_type, sub_total, discount_amt, tax_amt, other_charges, round_off, total, paid_amt, balance_amt, status, notes || null, terms || null, req.user.sub, now(), now());

    for (const it of processedItems) {
      db.prepare(`INSERT INTO sale_document_items(id,tenant_id,document_id,item_id,item_name,hsn_sac,description,qty,unit,price_unit,price_tax_incl,discount_pct,discount_amt,tax_pct,tax_amt,cgst,sgst,igst,cess,line_total,cost_rate) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).run(crypto.randomUUID(), t, docId, it.item_id || null, it.item_name, it.hsn_sac || null, it.description || null, it.qty, it.unit || null, it.price_unit, it.price_tax_incl || 0, it.discount_pct || 0, it.discount_amt, it.tax_pct || 0, it.tax_amt, it.cgst, it.sgst, it.igst, it.cess || 0, it.line_total, it.cost_rate || null);
    }

    for (const pay of rawPayments) {
      const payId = crypto.randomUUID();
      db.prepare(`INSERT INTO payments(id,tenant_id,firm_id,party_id,direction,doc_id,pay_mode,amount,pay_date,reference,bank_id,created_at,updated_at,version,sync_state) VALUES(?,?,?,?,'in',?,?,?,?,?,?,?,?,1,'synced')`
      ).run(payId, t, firm_id, party_id || null, docId, pay.pay_mode || 'cash', pay.amount, date, pay.reference || null, pay.bank_id || null, now(), now());
    }

    postSaleDoc(db, t, docId, { doc_type, store_id, party_id, balance_amt }, processedItems);
  });
  tx();

  const created = db.prepare(`SELECT * FROM sale_documents WHERE id=?`).get(docId);
  res.status(201).json({ data: created });
});

// convert estimate->invoice
router.post('/sales/:id/convert', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const doc = db.prepare(`SELECT * FROM sale_documents WHERE id=? AND tenant_id=? AND deleted_at IS NULL`).get(req.params.id, t);
  if (!doc) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found' } });
  const items = db.prepare(`SELECT * FROM sale_document_items WHERE document_id=? AND tenant_id=?`).all(req.params.id, t);

  const docId = crypto.randomUUID();
  const convertTx = db.transaction(() => {
    // Mark estimate as converted
    db.prepare(`UPDATE sale_documents SET status='converted', updated_at=? WHERE id=?`).run(now(), req.params.id);
    // Generate invoice number inside transaction
    const doc_no = nextDocNo(db, t, doc.firm_id, doc.terminal_id, 'invoice');
    db.prepare(`INSERT INTO sale_documents(id,tenant_id,firm_id,store_id,terminal_id,doc_type,doc_no,doc_date,party_id,sub_total,discount_amt,tax_amt,other_charges,round_off,total,paid_amt,balance_amt,status,notes,terms,orig_doc_id,created_by,created_at,updated_at,version,sync_state) VALUES(?,?,?,?,?,'invoice',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,'synced')`
    ).run(docId, t, doc.firm_id, doc.store_id, doc.terminal_id, doc_no, new Date().toISOString().slice(0, 10), doc.party_id, doc.sub_total, doc.discount_amt, doc.tax_amt, doc.other_charges, doc.round_off, doc.total, 0, doc.total, 'open', doc.notes, doc.terms, req.params.id, req.user.sub, now(), now());
    for (const it of items) {
      db.prepare(`INSERT INTO sale_document_items(id,tenant_id,document_id,item_id,item_name,hsn_sac,qty,unit,price_unit,price_tax_incl,discount_pct,discount_amt,tax_pct,tax_amt,cgst,sgst,igst,cess,line_total,cost_rate) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).run(crypto.randomUUID(), t, docId, it.item_id, it.item_name, it.hsn_sac, it.qty, it.unit, it.price_unit, it.price_tax_incl, it.discount_pct, it.discount_amt, it.tax_pct, it.tax_amt, it.cgst, it.sgst, it.igst, it.cess, it.line_total, it.cost_rate);
    }
  });
  convertTx();

  res.status(201).json({ data: db.prepare(`SELECT * FROM sale_documents WHERE id=?`).get(docId) });
});

// record additional payment
router.post('/sales/:id/payment', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const doc = db.prepare(`SELECT * FROM sale_documents WHERE id=? AND tenant_id=? AND deleted_at IS NULL`).get(req.params.id, t);
  if (!doc) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found' } });
  const { pay_mode = 'cash', amount, reference, bank_id } = req.body;
  if (!amount) return res.status(422).json({ error: { code: 'VALIDATION_FAILED', message: 'amount required' } });

  const payId = crypto.randomUUID();
  db.prepare(`INSERT INTO payments(id,tenant_id,firm_id,party_id,direction,doc_id,pay_mode,amount,pay_date,reference,bank_id,created_at,updated_at,version,sync_state) VALUES(?,?,?,?,'in',?,?,?,?,?,?,?,?,1,'synced')`
  ).run(payId, t, doc.firm_id, doc.party_id, req.params.id, pay_mode, amount, new Date().toISOString().slice(0,10), reference || null, bank_id || null, now(), now());

  const newPaid = doc.paid_amt + amount;
  const newBalance = Math.max(0, doc.total - newPaid);
  const newStatus = newBalance <= 0 ? 'paid' : 'partial';
  db.prepare(`UPDATE sale_documents SET paid_amt=?,balance_amt=?,status=?,updated_at=? WHERE id=?`).run(newPaid, newBalance, newStatus, now(), req.params.id);

  if (doc.party_id) {
    db.prepare(`UPDATE party_balances SET receivable=receivable-?,updated_at=? WHERE tenant_id=? AND party_id=?`).run(amount, now(), t, doc.party_id);
  }

  res.status(201).json({ data: { id: payId } });
});

// cancel
router.post('/sales/:id/cancel', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  db.prepare(`UPDATE sale_documents SET status='cancelled', updated_at=? WHERE id=? AND tenant_id=?`).run(now(), req.params.id, t);
  res.json({ data: { cancelled: true } });
});

export default router;

