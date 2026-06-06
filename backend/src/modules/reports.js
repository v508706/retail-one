import { Router } from 'express';
import { getDb } from '../database/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function dateRange(req) {
  const to = req.query.to || new Date().toISOString().slice(0, 10);
  const from = req.query.from || new Date(new Date(to).getFullYear(), new Date(to).getMonth(), 1).toISOString().slice(0, 10);
  return { from, to };
}

// dashboard summary
router.get('/dashboard', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { from, to } = dateRange(req);

  const sales = db.prepare(`SELECT COALESCE(SUM(total),0) as total, COUNT(*) as count FROM sale_documents WHERE tenant_id=? AND doc_type IN ('invoice','pos') AND doc_date BETWEEN ? AND ? AND deleted_at IS NULL AND status!='cancelled'`).get(t, from, to);
  const purchases = db.prepare(`SELECT COALESCE(SUM(total),0) as total, COUNT(*) as count FROM purchase_documents WHERE tenant_id=? AND doc_type='purchase' AND doc_date BETWEEN ? AND ? AND deleted_at IS NULL AND status!='cancelled'`).get(t, from, to);
  const outstanding = db.prepare(`SELECT COALESCE(SUM(balance_amt),0) as amount FROM sale_documents WHERE tenant_id=? AND balance_amt>0 AND status IN ('open','partial') AND deleted_at IS NULL`).get(t);
  const payable = db.prepare(`SELECT COALESCE(SUM(balance_amt),0) as amount FROM purchase_documents WHERE tenant_id=? AND balance_amt>0 AND status IN ('open','partial') AND deleted_at IS NULL`).get(t);
  const lowStock = db.prepare(`SELECT COUNT(*) as count FROM items i WHERE i.tenant_id=? AND i.track_inventory=1 AND i.deleted_at IS NULL AND i.low_stock_alert IS NOT NULL AND COALESCE((SELECT SUM(sm.qty) FROM stock_movements sm WHERE sm.item_id=i.id AND sm.tenant_id=i.tenant_id),0) <= i.low_stock_alert`).get(t);
  const todaySales = db.prepare(`SELECT COALESCE(SUM(total),0) as total FROM sale_documents WHERE tenant_id=? AND doc_type IN ('invoice','pos') AND doc_date=? AND deleted_at IS NULL AND status!='cancelled'`).get(t, new Date().toISOString().slice(0, 10));

  // daily sales trend (last 7 days)
  const trend = db.prepare(`SELECT doc_date, COALESCE(SUM(total),0) as total, COUNT(*) as count FROM sale_documents WHERE tenant_id=? AND doc_type IN ('invoice','pos') AND doc_date >= date('now','-6 days') AND deleted_at IS NULL AND status!='cancelled' GROUP BY doc_date ORDER BY doc_date`).all(t);

  // top items
  const topItems = db.prepare(`SELECT sdi.item_name, SUM(sdi.qty) as total_qty, SUM(sdi.line_total) as total_amount FROM sale_document_items sdi JOIN sale_documents sd ON sd.id=sdi.document_id WHERE sdi.tenant_id=? AND sd.doc_date BETWEEN ? AND ? AND sd.status!='cancelled' AND sd.deleted_at IS NULL GROUP BY sdi.item_id, sdi.item_name ORDER BY total_amount DESC LIMIT 5`).all(t, from, to);

  res.json({ data: { period: { from, to }, sales, purchases, outstanding: outstanding.amount, payable: payable.amount, low_stock: lowStock.count, today_sales: todaySales.total, trend, top_items: topItems } });
});

// sale summary
router.get('/sale-summary', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { from, to } = dateRange(req);
  const rows = db.prepare(`SELECT doc_date, doc_type, SUM(sub_total) as sub_total, SUM(discount_amt) as discount_amt, SUM(tax_amt) as tax_amt, SUM(total) as total, SUM(paid_amt) as paid_amt, SUM(balance_amt) as balance_amt, COUNT(*) as count FROM sale_documents WHERE tenant_id=? AND doc_date BETWEEN ? AND ? AND deleted_at IS NULL AND status!='cancelled' GROUP BY doc_date, doc_type ORDER BY doc_date DESC`).all(t, from, to);
  res.json({ data: rows });
});

// item-wise sale
router.get('/item-sale', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { from, to } = dateRange(req);
  const rows = db.prepare(`SELECT sdi.item_id, sdi.item_name, sdi.hsn_sac, SUM(sdi.qty) as total_qty, SUM(sdi.discount_amt) as total_discount, SUM(sdi.tax_amt) as total_tax, SUM(sdi.line_total) as total_amount, AVG(sdi.price_unit) as avg_price FROM sale_document_items sdi JOIN sale_documents sd ON sd.id=sdi.document_id WHERE sdi.tenant_id=? AND sd.doc_date BETWEEN ? AND ? AND sd.status!='cancelled' AND sd.deleted_at IS NULL GROUP BY sdi.item_id, sdi.item_name ORDER BY total_amount DESC`).all(t, from, to);
  res.json({ data: rows });
});

// party-wise sale
router.get('/party-sale', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { from, to } = dateRange(req);
  const rows = db.prepare(`SELECT sd.party_id, p.name as party_name, SUM(sd.total) as total_amount, SUM(sd.paid_amt) as paid_amt, SUM(sd.balance_amt) as balance_amt, COUNT(*) as invoice_count FROM sale_documents sd LEFT JOIN parties p ON p.id=sd.party_id WHERE sd.tenant_id=? AND sd.doc_date BETWEEN ? AND ? AND sd.status!='cancelled' AND sd.deleted_at IS NULL GROUP BY sd.party_id, p.name ORDER BY total_amount DESC`).all(t, from, to);
  res.json({ data: rows });
});

// purchase summary
router.get('/purchase-summary', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { from, to } = dateRange(req);
  const rows = db.prepare(`SELECT doc_date, SUM(total) as total, SUM(paid_amt) as paid_amt, SUM(balance_amt) as balance_amt, COUNT(*) as count FROM purchase_documents WHERE tenant_id=? AND doc_date BETWEEN ? AND ? AND deleted_at IS NULL GROUP BY doc_date ORDER BY doc_date DESC`).all(t, from, to);
  res.json({ data: rows });
});

// stock report
router.get('/stock', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const rows = db.prepare(`SELECT i.id, i.name, i.sku, i.hsn_sac, u.short_name as unit, c.name as category, ip.sale_price, ip.purchase_price, i.low_stock_alert, COALESCE(SUM(sm.qty),0) as stock_qty, COALESCE(SUM(sm.qty),0) * COALESCE(ip.purchase_price,0) as stock_value FROM items i LEFT JOIN units u ON u.id=i.unit_id LEFT JOIN categories c ON c.id=i.category_id LEFT JOIN item_prices ip ON ip.item_id=i.id AND ip.tenant_id=i.tenant_id LEFT JOIN stock_movements sm ON sm.item_id=i.id AND sm.tenant_id=i.tenant_id WHERE i.tenant_id=? AND i.deleted_at IS NULL AND i.track_inventory=1 GROUP BY i.id ORDER BY i.name`).all(t);
  res.json({ data: rows });
});

// P&L
router.get('/profit-loss', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { from, to } = dateRange(req);
  const sales = db.prepare(`SELECT COALESCE(SUM(sub_total-discount_amt),0) as net_sales, COALESCE(SUM(tax_amt),0) as tax FROM sale_documents WHERE tenant_id=? AND doc_type IN ('invoice','pos') AND doc_date BETWEEN ? AND ? AND status!='cancelled' AND deleted_at IS NULL`).get(t, from, to);
  const purchases = db.prepare(`SELECT COALESCE(SUM(total),0) as cost FROM purchase_documents WHERE tenant_id=? AND doc_type='purchase' AND doc_date BETWEEN ? AND ? AND status!='cancelled' AND deleted_at IS NULL`).get(t, from, to);
  const expenses = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE tenant_id=? AND exp_date BETWEEN ? AND ? AND deleted_at IS NULL`).get(t, from, to);
  const gross_profit = sales.net_sales - purchases.cost;
  const net_profit = gross_profit - expenses.total;
  res.json({ data: { period: { from, to }, net_sales: sales.net_sales, cost_of_goods: purchases.cost, gross_profit, expenses: expenses.total, net_profit } });
});

// GST report (GSTR-1 style)
router.get('/gst-summary', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { from, to } = dateRange(req);
  const rows = db.prepare(`SELECT sdi.tax_pct, SUM(sdi.line_total - sdi.tax_amt) as taxable_value, SUM(sdi.cgst) as cgst, SUM(sdi.sgst) as sgst, SUM(sdi.igst) as igst, SUM(sdi.cess) as cess, SUM(sdi.tax_amt) as total_tax FROM sale_document_items sdi JOIN sale_documents sd ON sd.id=sdi.document_id WHERE sdi.tenant_id=? AND sd.doc_date BETWEEN ? AND ? AND sd.status!='cancelled' AND sd.deleted_at IS NULL GROUP BY sdi.tax_pct ORDER BY sdi.tax_pct`).all(t, from, to);
  res.json({ data: rows });
});

// outstanding receivables
router.get('/outstanding', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const rows = db.prepare(`SELECT sd.id, sd.doc_no, sd.doc_date, sd.due_date, sd.total, sd.paid_amt, sd.balance_amt, p.name as party_name, p.phone as party_phone, CASE WHEN sd.due_date IS NOT NULL AND sd.due_date < date('now') THEN 1 ELSE 0 END as overdue FROM sale_documents sd LEFT JOIN parties p ON p.id=sd.party_id WHERE sd.tenant_id=? AND sd.balance_amt>0 AND sd.status IN ('open','partial') AND sd.deleted_at IS NULL ORDER BY sd.due_date`).all(t);
  res.json({ data: rows });
});

// payment in/out summary
router.get('/payments', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { from, to } = dateRange(req);
  const rows = db.prepare(`SELECT direction, pay_mode, SUM(amount) as total, COUNT(*) as count FROM payments WHERE tenant_id=? AND pay_date BETWEEN ? AND ? GROUP BY direction, pay_mode ORDER BY direction, total DESC`).all(t, from, to);
  res.json({ data: rows });
});

// loyalty report
router.get('/loyalty', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const rows = db.prepare(`SELECT pb.party_id, p.name as party_name, p.phone, pb.points FROM party_balances pb JOIN parties p ON p.id=pb.party_id WHERE pb.tenant_id=? AND pb.points>0 ORDER BY pb.points DESC`).all(t);
  res.json({ data: rows });
});

// expense report
router.get('/expenses', requireAuth, (req, res) => {
  const db = getDb(); const t = req.tenantId;
  const { from, to } = dateRange(req);
  const rows = db.prepare(`SELECT category, SUM(amount) as total, COUNT(*) as count FROM expenses WHERE tenant_id=? AND exp_date BETWEEN ? AND ? AND deleted_at IS NULL GROUP BY category ORDER BY total DESC`).all(t, from, to);
  res.json({ data: rows });
});

export default router;
