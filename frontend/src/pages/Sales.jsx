import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Eye, X, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { fmt, errorMsg } from '../lib/api.js';
import { getFirmId } from '../lib/auth.js';

const DOC_TYPES = ['invoice', 'estimate', 'sale_order', 'delivery_challan', 'credit_note'];

export default function Sales() {
  const [docs, setDocs] = useState([]);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [docType, setDocType] = useState('invoice');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null); // 'new' | doc
  const [viewDoc, setViewDoc] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/sales', { params: { page, per_page: 50, doc_type: docType, search } });
      setDocs(r.data.data); setMeta(r.data.meta);
    } finally { setLoading(false); }
  }, [page, docType, search]);

  useEffect(() => { load(); }, [load]);

  async function handleCancel(id) {
    if (!confirm('Cancel this document?')) return;
    await api.post(`/sales/${id}/cancel`);
    toast.success('Cancelled'); load();
  }

  return (
    <div style={{ padding: 20 }}>
      <div className="page-header">
        <h1>Sales</h1>
        <button className="btn btn-primary" onClick={() => setModal('new')}><Plus size={15} /> New {docType}</button>
      </div>

      {/* Doc type tabs */}
      <div className="tabs">
        {DOC_TYPES.map(t => (
          <button key={t} className={`tab ${docType === t ? 'active' : ''}`}
            onClick={() => { setDocType(t); setPage(1); }}>
            {t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="search-bar" style={{ width: 260 }}>
            <Search size={15} />
            <input className="form-control" placeholder="Search doc no / party…"
              value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <span className="text-muted text-sm">{meta.total || 0} records</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Doc No</th><th>Date</th><th>Party</th><th className="td-right">Total</th><th className="td-right">Paid</th><th className="td-right">Balance</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={8}><div className="loading-page"><div className="spinner" /></div></td></tr>
                : docs.length === 0 ? <tr><td colSpan={8}><div className="empty-state">No {docType}s found</div></td></tr>
                : docs.map(d => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 600, color: 'var(--primary)', cursor: 'pointer' }} onClick={() => setViewDoc(d)}>{d.doc_no}</td>
                    <td>{fmt.date(d.doc_date)}</td>
                    <td>{d.party_name || <span className="text-muted">Walk-in</span>}</td>
                    <td className="td-right font-semibold">{fmt.currency(d.total)}</td>
                    <td className="td-right">{fmt.currency(d.paid_amt)}</td>
                    <td className="td-right text-danger">{d.balance_amt > 0 ? fmt.currency(d.balance_amt) : '—'}</td>
                    <td><StatusBadge s={d.status} /></td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setViewDoc(d)}><Eye size={14} /></button>
                        {d.status !== 'cancelled' && d.status !== 'paid' && (
                          <button className="btn btn-ghost btn-icon btn-sm text-danger" onClick={() => handleCancel(d.id)}>✕</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {meta.total > meta.per_page && (
          <div className="flex items-center justify-end gap-2" style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
            <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <span className="text-sm text-muted">Page {meta.page}</span>
            <button className="btn btn-secondary btn-sm" disabled={page * meta.per_page >= meta.total} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        )}
      </div>

      {modal === 'new' && <NewSaleModal docType={docType} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
      {viewDoc && <ViewDocModal docId={viewDoc.id} onClose={() => setViewDoc(null)} onRefresh={load} />}
    </div>
  );
}

function StatusBadge({ s }) {
  const m = { paid: 'badge-green', open: 'badge-yellow', partial: 'badge-blue', cancelled: 'badge-gray', returned: 'badge-red', draft: 'badge-gray', converted: 'badge-gray' };
  return <span className={`badge ${m[s] || 'badge-gray'}`}>{s}</span>;
}

function NewSaleModal({ docType, onClose, onSaved }) {
  const [parties, setParties] = useState([]);
  const [items, setItems] = useState([]);
  const [partySearch, setPartySearch] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [form, setForm] = useState({
    party_id: '', doc_date: new Date().toISOString().slice(0, 10),
    due_date: '', notes: '', terms: '', other_charges: 0, round_off: 0,
  });
  const [lineItems, setLineItems] = useState([]);
  const [payments, setPayments] = useState([{ pay_mode: 'cash', amount: 0 }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/parties', { params: { per_page: 200, role: 'customer', search: partySearch } }).then(r => setParties(r.data.data));
  }, [partySearch]);

  useEffect(() => {
    api.get('/items', { params: { per_page: 100, search: itemSearch } }).then(r => setItems(r.data.data));
  }, [itemSearch]);

  function addItem(item) {
    setLineItems(li => [...li, {
      item_id: item.id, item_name: item.name,
      hsn_sac: item.hsn_sac || '', qty: 1,
      unit: item.unit_name || '', price_unit: item.sale_price || 0,
      tax_pct: item.tax_rate || 0, discount_pct: 0, discount_amt: 0,
      price_tax_incl: 1,
    }]);
    setItemSearch('');
  }

  function updateLine(idx, key, val) {
    setLineItems(li => li.map((l, i) => i === idx ? { ...l, [key]: val } : l));
  }

  const subTotal = lineItems.reduce((s, l) => s + (l.price_unit * l.qty), 0);
  const total = subTotal - +form.other_charges + +(form.other_charges);
  const grandTotal = subTotal + +form.other_charges + +form.round_off;

  async function save() {
    if (lineItems.length === 0) { toast.error('Add at least one item'); return; }
    setSaving(true);
    try {
      await api.post('/sales', {
        firm_id: getFirmId(),
        doc_type: docType,
        party_id: form.party_id || null,
        doc_date: form.doc_date,
        due_date: form.due_date || null,
        notes: form.notes,
        terms: form.terms,
        other_charges: +form.other_charges,
        round_off: +form.round_off,
        items: lineItems,
        payments: payments.filter(p => p.amount > 0),
      });
      toast.success(`${docType} created!`);
      onSaved();
    } catch (err) { toast.error(errorMsg(err)); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-xl" style={{ maxHeight: '95vh' }}>
        <div className="modal-header">
          New {docType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label>Party</label>
              <select className="form-control" value={form.party_id} onChange={e => setForm(f => ({ ...f, party_id: e.target.value }))}>
                <option value="">Walk-in Customer</option>
                {parties.map(p => <option key={p.id} value={p.id}>{p.name}{p.phone ? ` (${p.phone})` : ''}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Date</label><input type="date" className="form-control" value={form.doc_date} onChange={e => setForm(f => ({ ...f, doc_date: e.target.value }))} /></div>
            <div className="form-group"><label>Due Date</label><input type="date" className="form-control" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} /></div>
          </div>

          <hr className="divider" />
          <div className="section-header">Items</div>

          {/* Item search */}
          <div className="search-bar mb-2" style={{ maxWidth: 360 }}>
            <Search size={14} />
            <input className="form-control" placeholder="Search & add item…"
              value={itemSearch} onChange={e => setItemSearch(e.target.value)} />
          </div>
          {itemSearch && items.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 6, marginBottom: 8, boxShadow: 'var(--shadow)', maxHeight: 200, overflowY: 'auto' }}>
              {items.map(i => (
                <div key={i.id} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, display: 'flex', justifyContent: 'space-between' }}
                  onClick={() => addItem(i)}>
                  <span>{i.name}</span><span className="text-muted">{fmt.currency(i.sale_price || 0)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="table-wrap">
            <table>
              <thead><tr><th>Item</th><th>HSN</th><th className="td-right">Qty</th><th className="td-right">Rate</th><th className="td-right">Tax%</th><th className="td-right">Amount</th><th></th></tr></thead>
              <tbody>
                {lineItems.map((l, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 500 }}>{l.item_name}</td>
                    <td><input className="form-control" style={{ width: 80 }} value={l.hsn_sac} onChange={e => updateLine(idx, 'hsn_sac', e.target.value)} /></td>
                    <td><input className="form-control" style={{ width: 70, textAlign: 'right' }} type="number" value={l.qty} onChange={e => updateLine(idx, 'qty', +e.target.value)} /></td>
                    <td><input className="form-control" style={{ width: 90, textAlign: 'right' }} type="number" value={l.price_unit} onChange={e => updateLine(idx, 'price_unit', +e.target.value)} /></td>
                    <td><input className="form-control" style={{ width: 60, textAlign: 'right' }} type="number" value={l.tax_pct} onChange={e => updateLine(idx, 'tax_pct', +e.target.value)} /></td>
                    <td className="td-right font-semibold">{fmt.currency(l.price_unit * l.qty)}</td>
                    <td><button className="btn btn-ghost btn-icon btn-sm text-danger" onClick={() => setLineItems(li => li.filter((_, i) => i !== idx))}><Trash2 size={13} /></button></td>
                  </tr>
                ))}
                {lineItems.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 16, color: '#6b7280' }}>No items added</td></tr>}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <div style={{ width: 280 }}>
              <div className="flex justify-between text-sm mb-1"><span>Sub Total</span><strong>{fmt.currency(subTotal)}</strong></div>
              <div className="flex justify-between text-sm mb-1">
                <span>Other Charges</span>
                <input type="number" className="form-control" style={{ width: 100, textAlign: 'right' }} value={form.other_charges} onChange={e => setForm(f => ({ ...f, other_charges: e.target.value }))} />
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span>Round Off</span>
                <input type="number" className="form-control" style={{ width: 100, textAlign: 'right' }} value={form.round_off} onChange={e => setForm(f => ({ ...f, round_off: e.target.value }))} />
              </div>
              <div className="flex justify-between font-bold" style={{ fontSize: 16, marginTop: 8, paddingTop: 8, borderTop: '2px solid var(--border)' }}>
                <span>Grand Total</span><span>{fmt.currency(grandTotal)}</span>
              </div>
            </div>
          </div>

          <hr className="divider" />
          <div className="section-header">Payment</div>
          <div className="flex gap-3 items-center">
            <select className="form-control" style={{ width: 140 }} value={payments[0].pay_mode} onChange={e => setPayments([{ ...payments[0], pay_mode: e.target.value }])}>
              {['cash', 'card', 'upi', 'cheque', 'bank', 'credit'].map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
            </select>
            <input type="number" className="form-control" style={{ width: 130 }} placeholder="Amount paid"
              value={payments[0].amount} onChange={e => setPayments([{ ...payments[0], amount: +e.target.value }])} />
            <span className="text-muted text-sm">Balance: {fmt.currency(Math.max(0, grandTotal - payments[0].amount))}</span>
          </div>

          <div className="form-row mt-2">
            <div className="form-group"><label>Notes</label><textarea className="form-control" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
            <div className="form-group"><label>Terms</label><textarea className="form-control" rows={2} value={form.terms} onChange={e => setForm(f => ({ ...f, terms: e.target.value }))} /></div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : `Create ${docType}`}</button>
        </div>
      </div>
    </div>
  );
}

function ViewDocModal({ docId, onClose, onRefresh }) {
  const [doc, setDoc] = useState(null);
  const [payModal, setPayModal] = useState(false);

  useEffect(() => {
    api.get(`/sales/${docId}`).then(r => setDoc(r.data.data));
  }, [docId]);

  async function recordPayment(mode, amount, ref) {
    await api.post(`/sales/${docId}/payment`, { pay_mode: mode, amount, reference: ref });
    toast.success('Payment recorded');
    setPayModal(false);
    api.get(`/sales/${docId}`).then(r => setDoc(r.data.data));
    onRefresh();
  }

  if (!doc) return <div className="modal-overlay"><div className="modal"><div className="loading-page"><div className="spinner" /></div></div></div>;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-xl">
        <div className="modal-header">
          {doc.doc_type.toUpperCase()} — {doc.doc_no}
          <div className="flex gap-2">
            <StatusBadge s={doc.status} />
            <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
          </div>
        </div>
        <div className="modal-body">
          <div className="grid-2 mb-3">
            <div>
              <div className="text-sm text-muted">Party</div>
              <div className="font-semibold">{doc.party_name || 'Walk-in'}</div>
              {doc.billing_address && <div className="text-sm text-muted">{doc.billing_address}</div>}
            </div>
            <div className="text-right">
              <div className="text-sm text-muted">Date</div>
              <div className="font-semibold">{fmt.date(doc.doc_date)}</div>
              {doc.due_date && <div className="text-sm text-muted">Due: {fmt.date(doc.due_date)}</div>}
            </div>
          </div>

          <div className="table-wrap mb-3">
            <table>
              <thead><tr><th>#</th><th>Item</th><th>HSN</th><th className="td-right">Qty</th><th className="td-right">Rate</th><th className="td-right">Tax</th><th className="td-right">Amount</th></tr></thead>
              <tbody>
                {doc.items?.map((it, i) => (
                  <tr key={it.id}>
                    <td className="text-muted">{i + 1}</td>
                    <td>{it.item_name}</td>
                    <td>{it.hsn_sac || '—'}</td>
                    <td className="td-right">{it.qty} {it.unit || ''}</td>
                    <td className="td-right">{fmt.currency(it.price_unit)}</td>
                    <td className="td-right">{it.tax_pct}% ({fmt.currency(it.tax_amt)})</td>
                    <td className="td-right font-semibold">{fmt.currency(it.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ width: 260 }}>
              <div className="flex justify-between text-sm mb-1"><span>Sub Total</span><span>{fmt.currency(doc.sub_total)}</span></div>
              <div className="flex justify-between text-sm mb-1"><span>Discount</span><span>- {fmt.currency(doc.discount_amt)}</span></div>
              <div className="flex justify-between text-sm mb-1"><span>Tax</span><span>{fmt.currency(doc.tax_amt)}</span></div>
              {doc.other_charges > 0 && <div className="flex justify-between text-sm mb-1"><span>Other Charges</span><span>{fmt.currency(doc.other_charges)}</span></div>}
              <div className="flex justify-between font-bold" style={{ fontSize: 16, marginTop: 8, paddingTop: 8, borderTop: '2px solid var(--border)' }}>
                <span>Total</span><span>{fmt.currency(doc.total)}</span>
              </div>
              <div className="flex justify-between text-sm mt-1"><span>Paid</span><span className="text-success">{fmt.currency(doc.paid_amt)}</span></div>
              {doc.balance_amt > 0 && <div className="flex justify-between text-sm mt-1"><span className="text-danger font-semibold">Balance Due</span><span className="text-danger font-semibold">{fmt.currency(doc.balance_amt)}</span></div>}
            </div>
          </div>

          {doc.payments?.length > 0 && (
            <>
              <hr className="divider" />
              <div className="section-header">Payments</div>
              <table style={{ width: '100%', fontSize: 13 }}>
                <thead><tr><th style={{ padding: '6px 0', textAlign: 'left', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600 }}>Mode</th><th className="td-right">Amount</th><th>Date</th><th>Ref</th></tr></thead>
                <tbody>{doc.payments.map(p => <tr key={p.id}><td style={{ padding: '5px 0', textTransform: 'uppercase', fontWeight: 500 }}>{p.pay_mode}</td><td className="td-right">{fmt.currency(p.amount)}</td><td>{fmt.date(p.pay_date)}</td><td>{p.reference || '—'}</td></tr>)}</tbody>
              </table>
            </>
          )}
        </div>
        <div className="modal-footer">
          {doc.balance_amt > 0 && <button className="btn btn-success btn-sm" onClick={() => setPayModal(true)}>Record Payment</button>}
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
        {payModal && <RecordPaymentModal balance={doc.balance_amt} onSave={recordPayment} onClose={() => setPayModal(false)} />}
      </div>
    </div>
  );
}

function RecordPaymentModal({ balance, onSave, onClose }) {
  const [mode, setMode] = useState('cash');
  const [amount, setAmount] = useState(balance);
  const [ref, setRef] = useState('');
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 380 }}>
        <div className="modal-header">Record Payment<button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button></div>
        <div className="modal-body">
          <div className="form-group"><label>Mode</label>
            <select className="form-control" value={mode} onChange={e => setMode(e.target.value)}>
              {['cash', 'card', 'upi', 'cheque', 'bank', 'credit'].map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
            </select></div>
          <div className="form-group"><label>Amount (₹)</label><input className="form-control" type="number" value={amount} onChange={e => setAmount(+e.target.value)} /></div>
          <div className="form-group"><label>Reference</label><input className="form-control" value={ref} onChange={e => setRef(e.target.value)} /></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(mode, amount, ref)}>Save Payment</button>
        </div>
      </div>
    </div>
  );
}
