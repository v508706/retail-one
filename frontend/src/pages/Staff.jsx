import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { fmt, errorMsg } from '../lib/api.js';
import { getFirmId } from '../lib/auth.js';

export default function Staff() {
  const [staff, setStaff] = useState([]);
  const [modal, setModal] = useState(null);
  const load = () => api.get('/staff').then(r => setStaff(r.data.data));
  useEffect(() => { load(); }, []);

  async function del(id) {
    if (!confirm('Delete staff?')) return;
    await api.delete(`/staff/${id}`); toast.success('Deleted'); load();
  }

  return (
    <div style={{ padding: 20 }}>
      <div className="page-header">
        <h1>Staff / HR</h1>
        <button className="btn btn-primary" onClick={() => setModal('new')}><Plus size={15} /> Add Staff</button>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Designation</th><th>Department</th><th>Phone</th><th>DOJ</th><th></th></tr></thead>
            <tbody>
              {staff.map(s => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 500 }}>{s.name}</td>
                  <td>{s.designation || '—'}</td>
                  <td>{s.department || '—'}</td>
                  <td>{s.phone || '—'}</td>
                  <td>{s.doj ? fmt.date(s.doj) : '—'}</td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setModal(s)}><Edit2 size={14} /></button>
                      <button className="btn btn-ghost btn-icon btn-sm text-danger" onClick={() => del(s.id)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {staff.length === 0 && <tr><td colSpan={6}><div className="empty-state">No staff</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {modal && <StaffModal staff={modal === 'new' ? null : modal} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
    </div>
  );
}

function StaffModal({ staff, onClose, onSaved }) {
  const [form, setForm] = useState(staff ? { ...staff } : { name: '', designation: '', department: '', gender: '', dob: '', doj: '', phone: '', blood_group: '', firm_id: getFirmId() });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  async function save() {
    if (!form.name) { toast.error('Name required'); return; }
    setSaving(true);
    try {
      staff ? await api.put(`/staff/${staff.id}`, form) : await api.post('/staff', form);
      toast.success(staff ? 'Updated' : 'Added'); onSaved();
    } catch (err) { toast.error(errorMsg(err)); } finally { setSaving(false); }
  }
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">{staff ? 'Edit Staff' : 'Add Staff'}<button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button></div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group"><label>Name *</label><input className="form-control" value={form.name} onChange={e => set('name', e.target.value)} /></div>
            <div className="form-group"><label>Phone</label><input className="form-control" value={form.phone || ''} onChange={e => set('phone', e.target.value)} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Designation</label><input className="form-control" value={form.designation || ''} onChange={e => set('designation', e.target.value)} /></div>
            <div className="form-group"><label>Department</label><input className="form-control" value={form.department || ''} onChange={e => set('department', e.target.value)} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Gender</label>
              <select className="form-control" value={form.gender || ''} onChange={e => set('gender', e.target.value)}>
                <option value="">—</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
              </select></div>
            <div className="form-group"><label>Blood Group</label>
              <select className="form-control" value={form.blood_group || ''} onChange={e => set('blood_group', e.target.value)}>
                <option value="">—</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(b => <option key={b} value={b}>{b}</option>)}
              </select></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Date of Birth</label><input type="date" className="form-control" value={form.dob || ''} onChange={e => set('dob', e.target.value)} /></div>
            <div className="form-group"><label>Date of Joining</label><input type="date" className="form-control" value={form.doj || ''} onChange={e => set('doj', e.target.value)} /></div>
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
