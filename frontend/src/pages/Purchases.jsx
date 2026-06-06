import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Eye, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { fmt, errorMsg } from '../lib/api.js';
import { getFirmId } from '../lib/auth.js';

export default function Purchases() {
  const [docs, setDocs] = useState([]);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('purchase'); // purchase | purchase_order | expense
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'expense') {
        const r = await api.get('/expenses', { params: { page, per_page: 50 } });
        setDocs(r.data.data); setMeta(r.data.meta);
      } else if (tab === 'purchase_order') {
        const r = await api.get('/purchase-orders', { params: { page, per_page: 50 } });
        setDocs(r.data.data); setMeta(r.data.meta);
      } else {
        const r = await api.get('/purchases', { params: { page, per_page: 50, doc_type: tab } });
        setDocs(r.data.data); setMeta(r.data.meta);
      }
    } finally { setLoading(false); }
  }, [page, tab]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ padding: 20 }}>
      <div className="page-header">
        <h1>Purchases</h1>
        <button className="btn btn-primary" onClick={() => setModal('new')}><Plus size={15} /> New {tab.replace(/_/g, ' ')}</button>
      </div>

      <div className="tabs">
        {['purchase', 'purchase_return', 'purchase_order', 'expense'].map(t => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => { setTab(t); setPage(1); }}>
            {t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {tab === 'expense' ? <>
                  <th>Date</th><th>Category</th><th>Party</th><th className="td-right">Amount</th><th>Mode</th><th>Notes</th>
                </> : tab === 'purchase_order' ? <>
                  <th>PO No</th><th>Date</th><th>Party</th><th className="td-right">Total</th><th>Status</th>
                </> : <>
                  <th>Doc No</th><th>Date</th><th>Party</th><th className="td-right">Total</th><th className="td-right">Paid</th><th className="td-right">Balance</th><th>Status</th>
                </>}
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={8}><div className="loading-page"><div className="spinner" /></div></td></tr>
                : docs.length === 0 ? <tr><td colSpan={8}><div className="empty-state">No records</div></td></tr>
                : docs.map(d => (
                  <tr key={d.id}>
                    {tab === 'expense' ? <>
                      <td>{fmt.date(d.exp_date)}</td>
                      <td>{d.category || '—'}</td>
                      <td>{d.party_name || '—'}</td>
                      <td className="td-right font-semibold">{fmt.currency(d.amount)}</td>
                      <td>{d.pay_mode || '—'}</td>
                      <td className="text-muted">{d.notes || '—'}</td>
                    </> : tab === 'purchase_order' ? <>
                      <td style={{ fontWeight: 600 }}>{d.po_no}</td>
                      <td>{fmt.date(d.po_date)}</td>
                      <td>{d.party_name || '—'}</td>
                      <td className="td-right font-semibold">{fmt.currency(d.total)}</td>
                      <td><span className={`badge ${d.status === 'received' ? 'badge-green' : d.status === 'ordered' ? 'badge-blue' : 'badge-gray'}`}>{d.status}</span></td>
                    </> : <>
                      <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{d.doc_no}</td>
                      <td>{fmt.date(d.doc_date)}</td>
                      <td>{d.party_name || '—'}</td>
                      <td className="td-right font-semibold">{fmt.currency(d.total)}</td>
                      <td className="td-right">{fmt.currency(d.paid_amt)}</td>
                      <td className="td-right text-danger">{d.balance_amt > 0 ? fmt.currency(d.balance_amt) : '—'}</td>
                      <td><span className={`badge ${d.status === 'paid' ? 'badge-green' : d.status === 'partial' ? 'badge-blue' : 'badge-gray'}`}>{d.status}</span></td>
                    </>}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal === 'new' && tab === 'expense' && <ExpenseModal onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
      {modal === 'new' && tab !== 'expense' && tab !== 'purchase_order' && <PurchaseModal docType={tab} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
    </div>
  );
}

function PurchaseModal({ docType, onClose, onSaved }) {
  const [parties, setParties] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [itemSearch, setItemSearch] = useState('');
  const [form, setForm] = useState({ party_id: '', doc_date: new Date().toISOString().slice(0, 10), grn_no: '' });
  const [lineItems, setLineItems] = useState([]);
  const [payments, setPayments] = useState([{ pay_mode: 'cash', amount: 0 }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/parties', { params: { per_page: 200, role: 'supplier' } }).then(r => setParties(r.data.data));
  }, []);
  useEffect(() => {
    api.get('/items', { params: { per_page: 100, search: itemSearch } }).then(r => setAllItems(r.data.data));
  }, [itemSearch]);

  function addItem(item) {
    setLineItems(li => [...li, { item_id: item.id, item_name: item.name, hsn_sac: item.hsn_sac || '', qty: 1, unit: item.unit_name || '', price_unit: item.purchase_price || 0, tax_pct: item.tax_rate || 0, mrp: item.mrp || '', sale_price: item.sale_price || '' }]);
    setItemSearch('');
  }

  const subTotal = lineItems.reduce((s, l) => s + l.price_unit * l.qty, 0);

  async function save() {
    if (lineItems.length === 0) { toast.error('Add items'); return; }
    setSaving(true);
    try {
      await api.post('/purchases', {
        firm_id: getFirmId(), doc_type: docType,
        party_id: form.party_id || null, doc_date: form.doc_date, grn_no: form.grn_no,
        items: lineItems, payments: payments.filter(p => p.amount > 0),
      });
      toast.success('Purchase created'); onSaved();
    } catch (err) { toast.error(errorMsg(err)); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-xl" style={{ maxHeight: '95vh' }}>
        <div className="modal-header">New Purchase<button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button></div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group"><label>Supplier</label>
              <select className="form-control" value={form.party_id} onChange={e => setForm(f => ({ ...f, party_id: e.target.value }))}>
                <option value="">— Select Supplier —</option>
                {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select></div>
            <div className="form-group"><label>Date</label><input type="date" className="form-control" value={form.doc_date} onChange={e => setForm(f => ({ ...f, doc_date: e.target.value }))} /></div>
            <div className="form-group"><label>GRN No</label><input className="form-control" value={form.grn_no} onChange={e => setForm(f => ({ ...f, grn_no: e.target.value }))} /></div>
          </div>

          <hr className="divider" />
          <div className="search-bar mb-2" style={{ maxWidth: 340 }}>
            <Search size={14} />
            <input className="form-control" placeholder="Search & add item…" value={itemSearch} onChange={e => setItemSearch(e.target.value)} />
          </div>
          {itemSearch && allItems.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 6, marginBottom: 8, boxShadow: 'var(--shadow)', maxHeight: 180, overflowY: 'auto' }}>
              {allItems.map(i => <div key={i.id} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, display: 'flex', justifyContent: 'space-between' }} onClick={() => addItem(i)}><span>{i.name}</span><span className="text-muted">{fmt.currency(i.purchase_price || 0)}</span></div>)}
            </div>
          )}

          <div className="table-wrap">
            <table>
              <thead><tr><th>Item</th><th className="td-right">Qty</th><th className="td-right">Rate</th><th className="td-right">Tax%</th><th className="td-right">MRP</th><th className="td-right">Sale Price</th><th className="td-right">Amount</th><th></th></tr></thead>
              <tbody>
                {lineItems.map((l, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 500 }}>{l.item_name}</td>
                    <td><input className="form-control" style={{ width: 70, textAlign: 'right' }} type="number" value={l.qty} onChange={e => setLineItems(li => li.map((x, i) => i === idx ? { ...x, qty: +e.target.value } : x))} /></td>
                    <td><input className="form-control" style={{ width: 90, textAlign: 'right' }} type="number" value={l.price_unit} onChange={e => setLineItems(li => li.map((x, i) => i === idx ? { ...x, price_unit: +e.target.value } : x))} /></td>
                    <td><input className="form-control" style={{ width: 60, textAlign: 'right' }} type="number" value={l.tax_pct} onChange={e => setLineItems(li => li.map((x, i) => i === idx ? { ...x, tax_pct: +e.target.value } : x))} /></td>
                    <td><input className="form-control" style={{ width: 80, textAlign: 'right' }} type="number" value={l.mrp} onChange={e => setLineItems(li => li.map((x, i) => i === idx ? { ...x, mrp: +e.target.value } : x))} /></td>
                    <td><input className="form-control" style={{ width: 80, textAlign: 'right' }} type="number" value={l.sale_price} onChange={e => setLineItems(li => li.map((x, i) => i === idx ? { ...x, sale_price: +e.target.value } : x))} /></td>
                    <td className="td-right font-semibold">{fmt.currency(l.price_unit * l.qty)}</td>
                    <td><button className="btn btn-ghost btn-icon btn-sm text-danger" onClick={() => setLineItems(li => li.filter((_, i) => i !== idx))}>✕</button></td>
                  </tr>
                ))}
                {lineItems.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 16, color: '#6b7280' }}>No items</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end mt-2">
            <div className="font-bold" style={{ fontSize: 16 }}>Total: {fmt.currency(subTotal)}</div>
          </div>
          <hr className="divider" />
          <div className="flex gap-3 items-center">
            <select className="form-control" style={{ width: 130 }} value={payments[0].pay_mode} onChange={e => setPayments([{ ...payments[0], pay_mode: e.target.value }])}>
              {['cash', 'card', 'upi', 'bank', 'credit'].map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
            </select>
            <input type="number" className="form-control" style={{ width: 130 }} placeholder="Amount paid" value={payments[0].amount} onChange={e => setPayments([{ ...payments[0], amount: +e.target.value }])} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Create Purchase'}</button>
        </div>
      </div>
    </div>
  );
}

function ExpenseModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ category: '', amount: '', tax_amt: 0, exp_date: new Date().toISOString().slice(0, 10), pay_mode: 'cash', notes: '' });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.amount) { toast.error('Amount required'); return; }
    setSaving(true);
    try {
      await api.post('/expenses', { firm_id: getFirmId(), ...form, amount: +form.amount });
      toast.success('Expense added'); onSaved();
    } catch (err) { toast.error(errorMsg(err)); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">New Expense<button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button></div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group"><label>Category</label><input className="form-control" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Rent, Salary…" /></div>
            <div className="form-group"><label>Date</label><input type="date" className="form-control" value={form.exp_date} onChange={e => setForm(f => ({ ...f, exp_date: e.target.value }))} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Amount (₹) *</label><input className="form-control" type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
            <div className="form-group"><label>Pay Mode</label>
              <select className="form-control" value={form.pay_mode} onChange={e => setForm(f => ({ ...f, pay_mode: e.target.value }))}>
                {['cash', 'bank', 'upi', 'card', 'credit'].map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
              </select></div>
          </div>
          <div className="form-group"><label>Notes</label><textarea className="form-control" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Expense'}</button>
        </div>
      </div>
    </div>
  );
}
