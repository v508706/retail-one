import React, { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { fmt, errorMsg } from '../lib/api.js';
import { getFirmId } from '../lib/auth.js';

export default function Accounting() {
  const [tab, setTab] = useState('banks');
  return (
    <div style={{ padding: 20 }}>
      <div className="page-header"><h1>Accounting & Cash/Bank</h1></div>
      <div className="tabs">
        {['banks', 'cheques', 'vouchers', 'ledgers'].map(t => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {tab === 'banks' && <BanksTab />}
      {tab === 'cheques' && <ChequesTab />}
      {tab === 'vouchers' && <VouchersTab />}
      {tab === 'ledgers' && <LedgersTab />}
    </div>
  );
}

function BanksTab() {
  const [banks, setBanks] = useState([]);
  const [modal, setModal] = useState(null);

  useEffect(() => { api.get('/banks').then(r => setBanks(r.data.data)); }, [modal]);

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn btn-primary" onClick={() => setModal('new')}><Plus size={15} /> Add Bank</button>
      </div>
      <div className="grid-3">
        {banks.map(b => (
          <div key={b.id} className="card">
            <div className="card-body">
              <div style={{ fontSize: 13, fontWeight: 600 }}>{b.account_name || b.bank_name}</div>
              <div className="text-sm text-muted">{b.bank_name} {b.account_no ? `· ${b.account_no}` : ''}</div>
              <div style={{ marginTop: 10, fontSize: 18, fontWeight: 700, color: 'var(--primary)' }}>{fmt.currency(b.current_balance ?? b.opening_balance)}</div>
              <div className="text-sm text-muted">Current Balance</div>
            </div>
          </div>
        ))}
        {banks.length === 0 && <div className="text-muted text-sm">No banks added</div>}
      </div>
      {modal && <BankModal onClose={() => setModal(null)} onSaved={() => setModal(null)} />}
    </div>
  );
}

function BankModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ firm_id: getFirmId(), account_name: '', bank_name: '', account_no: '', ifsc: '', branch: '', opening_balance: 0 });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  async function save() {
    setSaving(true);
    try { await api.post('/banks', form); toast.success('Bank added'); onSaved(); }
    catch (err) { toast.error(errorMsg(err)); } finally { setSaving(false); }
  }
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">Add Bank<button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button></div>
        <div className="modal-body">
          <div className="form-group"><label>Account Name</label><input className="form-control" value={form.account_name} onChange={e => set('account_name', e.target.value)} /></div>
          <div className="form-row">
            <div className="form-group"><label>Bank Name</label><input className="form-control" value={form.bank_name} onChange={e => set('bank_name', e.target.value)} /></div>
            <div className="form-group"><label>Account No</label><input className="form-control" value={form.account_no} onChange={e => set('account_no', e.target.value)} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>IFSC</label><input className="form-control" value={form.ifsc} onChange={e => set('ifsc', e.target.value)} /></div>
            <div className="form-group"><label>Branch</label><input className="form-control" value={form.branch} onChange={e => set('branch', e.target.value)} /></div>
          </div>
          <div className="form-group"><label>Opening Balance (₹)</label><input className="form-control" type="number" value={form.opening_balance} onChange={e => set('opening_balance', e.target.value)} /></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

function ChequesTab() {
  const [cheques, setCheques] = useState([]);
  const [dir, setDir] = useState('');
  const [status, setStatus] = useState('open');
  const [modal, setModal] = useState(false);

  useEffect(() => {
    api.get('/cheques', { params: { direction: dir, status } }).then(r => setCheques(r.data.data));
  }, [dir, status, modal]);

  async function updateStatus(id, s) {
    await api.patch(`/cheques/${id}/status`, { status: s });
    toast.success('Updated');
    api.get('/cheques', { params: { direction: dir, status } }).then(r => setCheques(r.data.data));
  }

  return (
    <div>
      <div className="flex justify-between mb-3">
        <div className="flex gap-2">
          <select className="form-control" style={{ width: 130 }} value={dir} onChange={e => setDir(e.target.value)}>
            <option value="">All Directions</option><option value="in">Received</option><option value="out">Issued</option>
          </select>
          <select className="form-control" style={{ width: 120 }} value={status} onChange={e => setStatus(e.target.value)}>
            <option value="open">Open</option><option value="cleared">Cleared</option><option value="bounced">Bounced</option>
          </select>
        </div>
        <button className="btn btn-primary" onClick={() => setModal(true)}><Plus size={15} /> Add Cheque</button>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Cheque No</th><th>Party</th><th>Bank</th><th>Direction</th><th className="td-right">Amount</th><th>Due Date</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {cheques.map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.cheque_no || '—'}</td>
                  <td>{c.party_name || '—'}</td>
                  <td>{c.bank_name || '—'}</td>
                  <td><span className={`badge ${c.direction === 'in' ? 'badge-green' : 'badge-yellow'}`}>{c.direction === 'in' ? 'Received' : 'Issued'}</span></td>
                  <td className="td-right font-bold">{fmt.currency(c.amount)}</td>
                  <td>{c.due_date ? fmt.date(c.due_date) : '—'}</td>
                  <td><span className={`badge ${c.status === 'cleared' ? 'badge-green' : c.status === 'bounced' ? 'badge-red' : 'badge-yellow'}`}>{c.status}</span></td>
                  <td>
                    {c.status === 'open' && (
                      <div className="flex gap-1">
                        <button className="btn btn-success btn-sm" onClick={() => updateStatus(c.id, 'cleared')}>Clear</button>
                        <button className="btn btn-danger btn-sm" onClick={() => updateStatus(c.id, 'bounced')}>Bounce</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {cheques.length === 0 && <tr><td colSpan={8}><div className="empty-state">No cheques</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {modal && <ChequeModal onClose={() => setModal(false)} onSaved={() => setModal(false)} />}
    </div>
  );
}

function ChequeModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ cheque_no: '', amount: '', direction: 'in', due_date: '', party_id: '' });
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!form.amount) { toast.error('Amount required'); return; }
    setSaving(true);
    try { await api.post('/cheques', form); toast.success('Cheque added'); onSaved(); }
    catch (err) { toast.error(errorMsg(err)); } finally { setSaving(false); }
  }
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">Add Cheque<button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button></div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group"><label>Cheque No</label><input className="form-control" value={form.cheque_no} onChange={e => setForm(f => ({ ...f, cheque_no: e.target.value }))} /></div>
            <div className="form-group"><label>Direction</label>
              <select className="form-control" value={form.direction} onChange={e => setForm(f => ({ ...f, direction: e.target.value }))}>
                <option value="in">Received (In)</option><option value="out">Issued (Out)</option>
              </select></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Amount (₹)</label><input className="form-control" type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
            <div className="form-group"><label>Due Date</label><input type="date" className="form-control" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} /></div>
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

function VouchersTab() {
  const [vouchers, setVouchers] = useState([]);
  useEffect(() => { api.get('/vouchers').then(r => setVouchers(r.data.data)); }, []);
  return (
    <div className="card">
      <div className="card-header">Vouchers</div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Voucher No</th><th>Type</th><th>Date</th><th className="td-right">Amount</th><th>Narration</th></tr></thead>
          <tbody>
            {vouchers.map(v => <tr key={v.id}><td style={{ fontWeight: 600 }}>{v.voucher_no}</td><td><span className="badge badge-blue">{v.voucher_type}</span></td><td>{fmt.date(v.voucher_date)}</td><td className="td-right font-bold">{fmt.currency(v.amount)}</td><td>{v.narration || '—'}</td></tr>)}
            {vouchers.length === 0 && <tr><td colSpan={5}><div className="empty-state">No vouchers</div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LedgersTab() {
  const [ledgers, setLedgers] = useState([]);
  useEffect(() => { api.get('/ledgers').then(r => setLedgers(r.data.data)); }, []);
  const grouped = ledgers.reduce((acc, l) => { const g = l.nature || 'Other'; if (!acc[g]) acc[g] = []; acc[g].push(l); return acc; }, {});
  return (
    <div className="card">
      <div className="card-header">Chart of Accounts</div>
      <div className="card-body">
        {Object.entries(grouped).map(([nature, items]) => (
          <div key={nature} className="mb-3">
            <div className="section-header">{nature.toUpperCase()}</div>
            <table style={{ width: '100%', fontSize: 13 }}>
              <thead><tr><th style={{ padding: '4px 0', textAlign: 'left', color: 'var(--text-muted)', fontSize: 11 }}>Account</th><th style={{ textAlign: 'left', padding: '4px 0', color: 'var(--text-muted)', fontSize: 11 }}>Group</th><th style={{ textAlign: 'right', padding: '4px 0', color: 'var(--text-muted)', fontSize: 11 }}>Opening Balance</th></tr></thead>
              <tbody>{items.map(l => <tr key={l.id}><td style={{ padding: '5px 0' }}>{l.name}</td><td style={{ padding: '5px 0', color: 'var(--text-muted)' }}>{l.group_name || '—'}</td><td style={{ padding: '5px 0', textAlign: 'right' }}>{fmt.currency(l.opening_balance)}</td></tr>)}</tbody>
            </table>
          </div>
        ))}
        {ledgers.length === 0 && <div className="empty-state">No ledgers</div>}
      </div>
    </div>
  );
}
