import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, X, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { fmt, errorMsg } from '../lib/api.js';
import { getFirmId } from '../lib/auth.js';

export default function Settings() {
  const [tab, setTab] = useState('firm');
  return (
    <div style={{ padding: 20 }}>
      <div className="page-header"><h1>Settings</h1></div>
      <div className="tabs" style={{ flexWrap: 'wrap' }}>
        {['firm', 'users', 'roles', 'doc-sequences', 'invoice-templates', 'tax-rates', 'units', 'categories'].map(t => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </button>
        ))}
      </div>
      {tab === 'firm' && <FirmTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'roles' && <RolesTab />}
      {tab === 'doc-sequences' && <DocSeqTab />}
      {tab === 'invoice-templates' && <InvTemplatesTab />}
      {tab === 'tax-rates' && <TaxRatesTab />}
      {tab === 'units' && <UnitsTab />}
      {tab === 'categories' && <CategoriesTab />}
    </div>
  );
}

/* ─── Firm ─── */
function FirmTab() {
  const firmId = getFirmId();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (firmId) api.get(`/firms/${firmId}`).then(r => setForm(r.data)).catch(() => setForm({})); }, [firmId]);
  if (!form) return <div className="loading-page"><div className="spinner" /></div>;
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  async function save() {
    setSaving(true);
    try { await api.put(`/firms/${firmId}`, form); toast.success('Firm settings saved'); }
    catch (err) { toast.error(errorMsg(err)); } finally { setSaving(false); }
  }
  return (
    <div className="card" style={{ maxWidth: 640 }}>
      <div className="card-header">Firm Details</div>
      <div className="card-body">
        <div className="form-row">
          <div className="form-group"><label>Firm Name</label><input className="form-control" value={form.name || ''} onChange={e => set('name', e.target.value)} /></div>
          <div className="form-group"><label>Trade Name</label><input className="form-control" value={form.trade_name || ''} onChange={e => set('trade_name', e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>GSTIN</label><input className="form-control" value={form.gstin || ''} onChange={e => set('gstin', e.target.value)} /></div>
          <div className="form-group"><label>PAN</label><input className="form-control" value={form.pan || ''} onChange={e => set('pan', e.target.value)} /></div>
        </div>
        <div className="form-group"><label>Address</label><textarea className="form-control" rows={2} value={form.address || ''} onChange={e => set('address', e.target.value)} /></div>
        <div className="form-row">
          <div className="form-group"><label>City</label><input className="form-control" value={form.city || ''} onChange={e => set('city', e.target.value)} /></div>
          <div className="form-group"><label>State</label><input className="form-control" value={form.state || ''} onChange={e => set('state', e.target.value)} /></div>
          <div className="form-group"><label>PIN</label><input className="form-control" value={form.pin || ''} onChange={e => set('pin', e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Phone</label><input className="form-control" value={form.phone || ''} onChange={e => set('phone', e.target.value)} /></div>
          <div className="form-group"><label>Email</label><input className="form-control" value={form.email || ''} onChange={e => set('email', e.target.value)} /></div>
        </div>
        <div className="flex justify-end mt-3">
          <button className="btn btn-primary" onClick={save} disabled={saving}><Save size={14} /> {saving ? 'Saving…' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Users ─── */
function UsersTab() {
  const [users, setUsers] = useState([]);
  const [modal, setModal] = useState(null);
  const load = () => api.get('/users').then(r => setUsers(r.data.data));
  useEffect(() => { load(); }, []);
  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn btn-primary" onClick={() => setModal('new')}><Plus size={15} /> Add User</button>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 500 }}>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.role_name || '—'}</td>
                  <td><span className={`badge ${u.is_active ? 'badge-green' : 'badge-gray'}`}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={4}><div className="empty-state">No users</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {modal && <UserModal onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
    </div>
  );
}

function UserModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role_id: '' });
  const [roles, setRoles] = useState([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => { api.get('/roles').then(r => setRoles(r.data.data)); }, []);
  async function save() {
    if (!form.email || !form.password) { toast.error('Email and password required'); return; }
    setSaving(true);
    try { await api.post('/users', { ...form, firm_id: getFirmId() }); toast.success('User created'); onSaved(); }
    catch (err) { toast.error(errorMsg(err)); } finally { setSaving(false); }
  }
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">New User<button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button></div>
        <div className="modal-body">
          <div className="form-group"><label>Full Name</label><input className="form-control" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div className="form-group"><label>Email *</label><input className="form-control" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
          <div className="form-group"><label>Password *</label><input className="form-control" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></div>
          <div className="form-group"><label>Role</label>
            <select className="form-control" value={form.role_id} onChange={e => setForm(f => ({ ...f, role_id: e.target.value }))}>
              <option value="">— Select Role —</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Create User'}</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Roles ─── */
function RolesTab() {
  const [roles, setRoles] = useState([]);
  const load = () => api.get('/roles').then(r => setRoles(r.data.data));
  useEffect(() => { load(); }, []);
  return (
    <div className="card">
      <div className="card-header">Roles & Permissions</div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Role</th><th>Description</th><th>Type</th></tr></thead>
          <tbody>
            {roles.map(r => (
              <tr key={r.id}>
                <td style={{ fontWeight: 500 }}>{r.name}</td>
                <td className="text-muted text-sm">{r.description || '—'}</td>
                <td><span className={`badge ${r.is_system ? 'badge-blue' : 'badge-gray'}`}>{r.is_system ? 'System' : 'Custom'}</span></td>
              </tr>
            ))}
            {roles.length === 0 && <tr><td colSpan={3}><div className="empty-state">No roles</div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Document Sequences ─── */
function DocSeqTab() {
  const [seqs, setSeqs] = useState([]);
  const [editing, setEditing] = useState({});
  const [saving, setSaving] = useState({});
  useEffect(() => {
    api.get('/document-sequences').then(r => setSeqs(r.data.data)).catch(() => setSeqs([]));
  }, []);

  async function saveSeq(s) {
    setSaving(sv => ({ ...sv, [s.id]: true }));
    try {
      await api.put(`/document-sequences/${s.id}`, { prefix: editing[s.id]?.prefix ?? s.prefix, next_no: editing[s.id]?.next_no ?? s.next_no });
      toast.success('Updated');
      api.get('/document-sequences').then(r => setSeqs(r.data.data));
    } catch (err) { toast.error(errorMsg(err)); }
    finally { setSaving(sv => ({ ...sv, [s.id]: false })); }
  }

  return (
    <div className="card">
      <div className="card-header">Document Number Sequences</div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Document Type</th><th>Prefix</th><th>Next Number</th><th></th></tr></thead>
          <tbody>
            {seqs.map(s => {
              const e = editing[s.id] || {};
              return (
                <tr key={s.id}>
                  <td style={{ fontWeight: 500 }}>{s.doc_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</td>
                  <td><input className="form-control" style={{ width: 100 }} value={e.prefix ?? s.prefix} onChange={ev => setEditing(ed => ({ ...ed, [s.id]: { ...(ed[s.id] || {}), prefix: ev.target.value } }))} /></td>
                  <td><input className="form-control" style={{ width: 100 }} type="number" value={e.next_no ?? s.next_no} onChange={ev => setEditing(ed => ({ ...ed, [s.id]: { ...(ed[s.id] || {}), next_no: +ev.target.value } }))} /></td>
                  <td><button className="btn btn-primary btn-sm" onClick={() => saveSeq(s)} disabled={saving[s.id]}>{saving[s.id] ? '…' : 'Save'}</button></td>
                </tr>
              );
            })}
            {seqs.length === 0 && <tr><td colSpan={4}><div className="empty-state">No sequences configured</div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Invoice Templates ─── */
function InvTemplatesTab() {
  const [templates, setTemplates] = useState([]);
  const load = () => api.get('/invoice-templates').then(r => setTemplates(r.data.data)).catch(() => setTemplates([]));
  useEffect(() => { load(); }, []);
  async function setDefault(id) {
    try { await api.patch(`/invoice-templates/${id}/default`); toast.success('Default template set'); load(); }
    catch (err) { toast.error(errorMsg(err)); }
  }
  return (
    <div className="grid-3">
      {templates.map(t => (
        <div key={t.id} className="card">
          <div className="card-body">
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{t.name}</div>
            <div className="text-sm text-muted mb-2">{t.layout || 'Standard'}</div>
            {t.is_default ? <span className="badge badge-green">Default</span>
              : <button className="btn btn-ghost btn-sm" onClick={() => setDefault(t.id)}>Set Default</button>}
          </div>
        </div>
      ))}
      {templates.length === 0 && <div className="text-muted text-sm">No invoice templates</div>}
    </div>
  );
}

/* ─── Tax Rates ─── */
function TaxRatesTab() {
  const [rates, setRates] = useState([]);
  const [modal, setModal] = useState(null);
  const load = () => api.get('/tax-rates').then(r => setRates(r.data.data));
  useEffect(() => { load(); }, []);
  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn btn-primary" onClick={() => setModal('new')}><Plus size={15} /> Add Tax Rate</button>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th className="td-right">Rate %</th><th>Type</th></tr></thead>
            <tbody>
              {rates.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 500 }}>{r.name}</td>
                  <td className="td-right">{r.rate}%</td>
                  <td>{r.tax_type || 'GST'}</td>
                </tr>
              ))}
              {rates.length === 0 && <tr><td colSpan={3}><div className="empty-state">No tax rates</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {modal && <TaxRateModal onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
    </div>
  );
}

function TaxRateModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', rate: '', tax_type: 'GST' });
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!form.name || !form.rate) { toast.error('Name and rate required'); return; }
    setSaving(true);
    try { await api.post('/tax-rates', { ...form, rate: +form.rate }); toast.success('Added'); onSaved(); }
    catch (err) { toast.error(errorMsg(err)); } finally { setSaving(false); }
  }
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">Add Tax Rate<button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button></div>
        <div className="modal-body">
          <div className="form-group"><label>Name (e.g. GST 18%)</label><input className="form-control" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div className="form-row">
            <div className="form-group"><label>Rate %</label><input className="form-control" type="number" value={form.rate} onChange={e => setForm(f => ({ ...f, rate: e.target.value }))} /></div>
            <div className="form-group"><label>Type</label>
              <select className="form-control" value={form.tax_type} onChange={e => setForm(f => ({ ...f, tax_type: e.target.value }))}>
                <option value="GST">GST</option><option value="IGST">IGST</option><option value="VAT">VAT</option><option value="None">None</option>
              </select></div>
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

/* ─── Units ─── */
function UnitsTab() {
  const [units, setUnits] = useState([]);
  const [modal, setModal] = useState(null);
  const load = () => api.get('/units').then(r => setUnits(r.data.data));
  useEffect(() => { load(); }, []);
  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn btn-primary" onClick={() => setModal('new')}><Plus size={15} /> Add Unit</button>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Abbreviation</th></tr></thead>
            <tbody>
              {units.map(u => <tr key={u.id}><td style={{ fontWeight: 500 }}>{u.name}</td><td>{u.abbr || '—'}</td></tr>)}
              {units.length === 0 && <tr><td colSpan={2}><div className="empty-state">No units</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {modal && <SimpleAddModal title="Add Unit" fields={[{ key: 'name', label: 'Name', required: true }, { key: 'abbr', label: 'Abbreviation' }]} url="/units" onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
    </div>
  );
}

/* ─── Categories ─── */
function CategoriesTab() {
  const [cats, setCats] = useState([]);
  const [modal, setModal] = useState(null);
  const load = () => api.get('/categories').then(r => setCats(r.data.data));
  useEffect(() => { load(); }, []);
  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn btn-primary" onClick={() => setModal('new')}><Plus size={15} /> Add Category</button>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Description</th></tr></thead>
            <tbody>
              {cats.map(c => <tr key={c.id}><td style={{ fontWeight: 500 }}>{c.name}</td><td className="text-muted">{c.description || '—'}</td></tr>)}
              {cats.length === 0 && <tr><td colSpan={2}><div className="empty-state">No categories</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {modal && <SimpleAddModal title="Add Category" fields={[{ key: 'name', label: 'Name', required: true }, { key: 'description', label: 'Description' }]} url="/categories" onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
    </div>
  );
}

/* ─── Generic Add Modal ─── */
function SimpleAddModal({ title, fields, url, onClose, onSaved }) {
  const [form, setForm] = useState(Object.fromEntries(fields.map(f => [f.key, ''])));
  const [saving, setSaving] = useState(false);
  async function save() {
    for (const f of fields) if (f.required && !form[f.key]) { toast.error(`${f.label} required`); return; }
    setSaving(true);
    try { await api.post(url, form); toast.success('Added'); onSaved(); }
    catch (err) { toast.error(errorMsg(err)); } finally { setSaving(false); }
  }
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">{title}<button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button></div>
        <div className="modal-body">
          {fields.map(f => (
            <div key={f.key} className="form-group">
              <label>{f.label}{f.required ? ' *' : ''}</label>
              <input className="form-control" value={form[f.key]} onChange={e => setForm(fm => ({ ...fm, [f.key]: e.target.value }))} />
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
