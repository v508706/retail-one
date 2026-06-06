import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Edit2, Trash2, X, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { fmt, errorMsg } from '../lib/api.js';

export default function Parties() {
  const [parties, setParties] = useState([]);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [statementParty, setStatementParty] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/parties', { params: { page, per_page: 50, search, role } });
      setParties(r.data.data); setMeta(r.data.meta);
    } finally { setLoading(false); }
  }, [page, search, role]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id) {
    if (!confirm('Delete party?')) return;
    await api.delete(`/parties/${id}`);
    toast.success('Party deleted'); load();
  }

  return (
    <div style={{ padding: 20 }}>
      <div className="page-header">
        <h1>Parties</h1>
        <button className="btn btn-primary" onClick={() => setModal('new')}><Plus size={15} /> Add Party</button>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="flex gap-2 items-center">
            <div className="search-bar" style={{ width: 260 }}>
              <Search size={15} />
              <input className="form-control" placeholder="Search name / phone…"
                value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            </div>
            <select className="form-control" style={{ width: 130 }} value={role} onChange={e => setRole(e.target.value)}>
              <option value="">All</option>
              <option value="customer">Customers</option>
              <option value="supplier">Suppliers</option>
            </select>
          </div>
          <span className="text-muted text-sm">{meta.total || 0} parties</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Role</th><th>Phone</th><th>GSTIN</th>
                <th className="td-right">Receivable</th><th className="td-right">Payable</th><th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={7}><div className="loading-page"><div className="spinner" /></div></td></tr>
                : parties.length === 0 ? <tr><td colSpan={7}><div className="empty-state">No parties</div></td></tr>
                : parties.map(p => (
                  <tr key={p.id}>
                    <td><div style={{ fontWeight: 500 }}>{p.name}</div>{p.city && <div className="text-sm text-muted">{p.city}</div>}</td>
                    <td><span className={`badge ${p.role === 'customer' ? 'badge-blue' : p.role === 'supplier' ? 'badge-yellow' : 'badge-gray'}`}>{p.role}</span></td>
                    <td>{p.phone || '—'}</td>
                    <td>{p.gstin || '—'}</td>
                    <td className="td-right text-success font-semibold">{p.receivable > 0 ? fmt.currency(p.receivable) : '—'}</td>
                    <td className="td-right text-danger font-semibold">{p.payable > 0 ? fmt.currency(p.payable) : '—'}</td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setStatementParty(p)} title="Statement"><Eye size={14} /></button>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setModal(p)}><Edit2 size={14} /></button>
                        <button className="btn btn-ghost btn-icon btn-sm text-danger" onClick={() => handleDelete(p.id)}><Trash2 size={14} /></button>
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

      {modal && <PartyModal party={modal === 'new' ? null : modal} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
      {statementParty && <StatementModal party={statementParty} onClose={() => setStatementParty(null)} />}
    </div>
  );
}

function PartyModal({ party, onClose, onSaved }) {
  const [form, setForm] = useState(party ? { ...party } : {
    name: '', role: 'customer', phone: '', email: '', gstin: '', gst_type: 'consumer',
    billing_address: '', city: '', state: '', opening_balance: 0, credit_limit: '', due_days: '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function save() {
    if (!form.name) { toast.error('Name required'); return; }
    setSaving(true);
    try {
      party ? await api.put(`/parties/${party.id}`, form) : await api.post('/parties', form);
      toast.success(party ? 'Party updated' : 'Party created');
      onSaved();
    } catch (err) { toast.error(errorMsg(err)); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">{party ? 'Edit Party' : 'Add Party'}<button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button></div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group"><label>Name *</label><input className="form-control" value={form.name} onChange={e => set('name', e.target.value)} /></div>
            <div className="form-group"><label>Type</label>
              <select className="form-control" value={form.role} onChange={e => set('role', e.target.value)}>
                <option value="customer">Customer</option><option value="supplier">Supplier</option><option value="both">Both</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Phone</label><input className="form-control" value={form.phone || ''} onChange={e => set('phone', e.target.value)} /></div>
            <div className="form-group"><label>Email</label><input className="form-control" type="email" value={form.email || ''} onChange={e => set('email', e.target.value)} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>GSTIN</label><input className="form-control" value={form.gstin || ''} onChange={e => set('gstin', e.target.value)} /></div>
            <div className="form-group"><label>GST Type</label>
              <select className="form-control" value={form.gst_type || 'consumer'} onChange={e => set('gst_type', e.target.value)}>
                <option value="registered">Registered</option><option value="unregistered">Unregistered</option>
                <option value="consumer">Consumer</option><option value="composition">Composition</option>
              </select>
            </div>
          </div>
          <div className="form-group"><label>Billing Address</label><textarea className="form-control" rows={2} value={form.billing_address || ''} onChange={e => set('billing_address', e.target.value)} /></div>
          <div className="form-row">
            <div className="form-group"><label>City</label><input className="form-control" value={form.city || ''} onChange={e => set('city', e.target.value)} /></div>
            <div className="form-group"><label>State</label><input className="form-control" value={form.state || ''} onChange={e => set('state', e.target.value)} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Opening Balance (₹)</label><input className="form-control" type="number" value={form.opening_balance || 0} onChange={e => set('opening_balance', e.target.value)} /></div>
            <div className="form-group"><label>Credit Limit (₹)</label><input className="form-control" type="number" value={form.credit_limit || ''} onChange={e => set('credit_limit', e.target.value)} /></div>
            <div className="form-group"><label>Due Days</label><input className="form-control" type="number" value={form.due_days || ''} onChange={e => set('due_days', e.target.value)} /></div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

function StatementModal({ party, onClose }) {
  const [data, setData] = useState(null);
  const [range, setRange] = useState({ from: new Date(new Date().setDate(1)).toISOString().slice(0,10), to: new Date().toISOString().slice(0,10) });

  useEffect(() => {
    api.get(`/parties/${party.id}/statement`, { params: range }).then(r => setData(r.data.data));
  }, [party.id, range]);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-xl">
        <div className="modal-header">Account Statement — {party.name}<button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button></div>
        <div className="modal-body">
          <div className="flex gap-2 mb-3">
            <input type="date" className="form-control" style={{ width: 150 }} value={range.from} onChange={e => setRange(r => ({ ...r, from: e.target.value }))} />
            <input type="date" className="form-control" style={{ width: 150 }} value={range.to} onChange={e => setRange(r => ({ ...r, to: e.target.value }))} />
          </div>
          {!data ? <div className="loading-page"><div className="spinner" /></div> : (
            <>
              <div className="section-header">Sales ({data.sales.length})</div>
              <div className="table-wrap mb-3">
                <table>
                  <thead><tr><th>Doc No</th><th>Date</th><th>Type</th><th className="td-right">Total</th><th className="td-right">Paid</th><th className="td-right">Balance</th><th>Status</th></tr></thead>
                  <tbody>
                    {data.sales.map(s => <tr key={s.id}><td>{s.doc_no}</td><td>{fmt.date(s.doc_date)}</td><td>{s.doc_type}</td><td className="td-right">{fmt.currency(s.total)}</td><td className="td-right">{fmt.currency(s.paid_amt)}</td><td className="td-right text-danger">{fmt.currency(s.balance_amt)}</td><td><StatusBadge s={s.status} /></td></tr>)}
                    {data.sales.length === 0 && <tr><td colSpan={7} className="empty-state" style={{ textAlign: 'center', padding: 16, color: '#6b7280' }}>No transactions</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="section-header">Payments ({data.payments.length})</div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Date</th><th>Mode</th><th>Direction</th><th className="td-right">Amount</th><th>Reference</th></tr></thead>
                  <tbody>
                    {data.payments.map(p => <tr key={p.id}><td>{fmt.date(p.pay_date)}</td><td>{p.pay_mode}</td><td><span className={`badge ${p.direction === 'in' ? 'badge-green' : 'badge-red'}`}>{p.direction === 'in' ? 'Received' : 'Paid'}</span></td><td className="td-right font-semibold">{fmt.currency(p.amount)}</td><td>{p.reference || '—'}</td></tr>)}
                    {data.payments.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 16, color: '#6b7280' }}>No payments</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        <div className="modal-footer"><button className="btn btn-secondary" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}

function StatusBadge({ s }) {
  const m = { paid: 'badge-green', open: 'badge-yellow', partial: 'badge-blue', cancelled: 'badge-gray', draft: 'badge-gray' };
  return <span className={`badge ${m[s] || 'badge-gray'}`}>{s}</span>;
}
