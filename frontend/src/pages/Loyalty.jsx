import React, { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { fmt, errorMsg } from '../lib/api.js';

export default function Loyalty() {
  const [tab, setTab] = useState('rules');
  return (
    <div style={{ padding: 20 }}>
      <div className="page-header"><h1>Loyalty Programme</h1></div>
      <div className="tabs">
        {['rules', 'transactions'].map(t => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {tab === 'rules' && <RulesTab />}
      {tab === 'transactions' && <TxTab />}
    </div>
  );
}

function RulesTab() {
  const [rules, setRules] = useState([]);
  const [modal, setModal] = useState(null);
  const load = () => api.get('/loyalty/rules').then(r => setRules(r.data.data));
  useEffect(() => { load(); }, []);

  async function toggleActive(r) {
    await api.put(`/loyalty/rules/${r.id}`, { ...r, is_active: r.is_active ? 0 : 1 });
    load();
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn btn-primary" onClick={() => setModal('new')}><Plus size={15} /> Add Rule</button>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Rule Name</th><th>Earn (per ₹)</th><th>Redeem (pts = ₹)</th><th>Min Purchase</th><th>Expiry Days</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rules.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 500 }}>{r.rule_name}</td>
                  <td>{r.earn_points_per_amount} pts per ₹{r.earn_on_amount}</td>
                  <td>₹{r.redeem_value_per_point} per pt</td>
                  <td>{r.min_purchase_amt ? fmt.currency(r.min_purchase_amt) : '—'}</td>
                  <td>{r.points_expiry_days ? `${r.points_expiry_days} days` : 'Never'}</td>
                  <td>
                    <span className={`badge ${r.is_active ? 'badge-green' : 'badge-gray'}`}>
                      {r.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(r)}>
                      {r.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
              {rules.length === 0 && <tr><td colSpan={7}><div className="empty-state">No loyalty rules. Add one to start rewarding customers.</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {modal && <RuleModal onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
    </div>
  );
}

function RuleModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ rule_name: 'Default', earn_on_amount: 100, earn_points_per_amount: 1, redeem_value_per_point: 0.5, min_purchase_amt: 0, points_expiry_days: 365, is_active: 1 });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  async function save() {
    if (!form.rule_name) { toast.error('Name required'); return; }
    setSaving(true);
    try { await api.post('/loyalty/rules', form); toast.success('Rule created'); onSaved(); }
    catch (err) { toast.error(errorMsg(err)); } finally { setSaving(false); }
  }
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">New Loyalty Rule<button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button></div>
        <div className="modal-body">
          <div className="form-group"><label>Rule Name</label><input className="form-control" value={form.rule_name} onChange={e => set('rule_name', e.target.value)} /></div>
          <div className="form-row">
            <div className="form-group"><label>Earn X points per ₹Y</label><div className="flex gap-2"><input className="form-control" type="number" placeholder="Points" value={form.earn_points_per_amount} onChange={e => set('earn_points_per_amount', +e.target.value)} /><input className="form-control" type="number" placeholder="Per ₹" value={form.earn_on_amount} onChange={e => set('earn_on_amount', +e.target.value)} /></div></div>
            <div className="form-group"><label>₹ value per point (redeem)</label><input className="form-control" type="number" value={form.redeem_value_per_point} onChange={e => set('redeem_value_per_point', +e.target.value)} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Min Purchase (₹)</label><input className="form-control" type="number" value={form.min_purchase_amt} onChange={e => set('min_purchase_amt', +e.target.value)} /></div>
            <div className="form-group"><label>Points Expiry (days)</label><input className="form-control" type="number" value={form.points_expiry_days} onChange={e => set('points_expiry_days', +e.target.value)} /></div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Rule'}</button>
        </div>
      </div>
    </div>
  );
}

function TxTab() {
  const [txs, setTxs] = useState([]);
  useEffect(() => { api.get('/loyalty/transactions').then(r => setTxs(r.data.data)).catch(() => setTxs([])); }, []);
  return (
    <div className="card">
      <div className="card-header">Points Transactions</div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Party</th><th>Type</th><th className="td-right">Points</th><th>Reference</th></tr></thead>
          <tbody>
            {txs.map(t => (
              <tr key={t.id}>
                <td>{fmt.date(t.tx_date)}</td>
                <td>{t.party_name || '—'}</td>
                <td><span className={`badge ${t.tx_type === 'earn' ? 'badge-green' : t.tx_type === 'redeem' ? 'badge-blue' : 'badge-gray'}`}>{t.tx_type}</span></td>
                <td className={`td-right font-bold ${t.tx_type === 'earn' ? 'text-success' : 'text-danger'}`}>{t.tx_type === 'earn' ? '+' : '-'}{fmt.number(t.points)}</td>
                <td className="text-muted text-sm">{t.reference_doc_no || '—'}</td>
              </tr>
            ))}
            {txs.length === 0 && <tr><td colSpan={5}><div className="empty-state">No transactions yet</div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
