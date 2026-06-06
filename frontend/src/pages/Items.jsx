import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Edit2, Trash2, BarChart2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { fmt, errorMsg } from '../lib/api.js';

export default function Items() {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null); // null | 'new' | item object
  const [units, setUnits] = useState([]);
  const [categories, setCategories] = useState([]);
  const [taxRates, setTaxRates] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/items', { params: { page, per_page: 50, search } });
      setItems(r.data.data);
      setMeta(r.data.meta);
    } finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get('/units').then(r => setUnits(r.data.data));
    api.get('/categories').then(r => setCategories(r.data.data));
    api.get('/tax-rates').then(r => setTaxRates(r.data.data));
  }, []);

  async function handleDelete(id) {
    if (!confirm('Delete this item?')) return;
    await api.delete(`/items/${id}`);
    toast.success('Item deleted');
    load();
  }

  const badgeStock = qty => {
    if (qty <= 0) return <span className="badge badge-red">Out</span>;
    if (qty <= 10) return <span className="badge badge-yellow">Low</span>;
    return <span className="badge badge-green">{fmt.number(qty)}</span>;
  };

  return (
    <div style={{ padding: 20 }}>
      <div className="page-header">
        <h1>Items & Stock</h1>
        <button className="btn btn-primary" onClick={() => setModal('new')}>
          <Plus size={15} /> Add Item
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="search-bar" style={{ width: 280 }}>
            <Search size={15} />
            <input className="form-control" placeholder="Search items…"
              value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <span className="text-muted text-sm">{meta.total || 0} items</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name / SKU</th>
                <th>Category</th>
                <th>Unit</th>
                <th className="td-right">Sale Price</th>
                <th className="td-right">Purchase</th>
                <th className="td-center">Stock</th>
                <th className="td-center">Tax</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8}><div className="loading-page"><div className="spinner" /></div></td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={8}><div className="empty-state">No items found</div></td></tr>
              ) : items.map(item => (
                <tr key={item.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{item.name}</div>
                    {item.sku && <div className="text-sm text-muted">{item.sku}</div>}
                  </td>
                  <td>{item.category_name || '—'}</td>
                  <td>{item.unit_name || '—'}</td>
                  <td className="td-right font-semibold">{item.sale_price ? fmt.currency(item.sale_price) : '—'}</td>
                  <td className="td-right">{item.purchase_price ? fmt.currency(item.purchase_price) : '—'}</td>
                  <td className="td-center">{item.track_inventory ? badgeStock(item.stock_qty) : <span className="badge badge-gray">N/A</span>}</td>
                  <td className="td-center">{item.tax_rate ? `${item.tax_rate}%` : '—'}</td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setModal(item)}><Edit2 size={14} /></button>
                      <button className="btn btn-ghost btn-icon btn-sm text-danger" onClick={() => handleDelete(item.id)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {meta.total > meta.per_page && (
          <div className="flex items-center justify-end gap-2" style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
            <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <span className="text-sm text-muted">Page {meta.page}</span>
            <button className="btn btn-secondary btn-sm" disabled={page * meta.per_page >= meta.total} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        )}
      </div>

      {modal && (
        <ItemModal
          item={modal === 'new' ? null : modal}
          units={units} categories={categories} taxRates={taxRates}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}

function ItemModal({ item, units, categories, taxRates, onClose, onSaved }) {
  const [form, setForm] = useState(item ? {
    name: item.name, sku: item.sku || '', hsn_sac: item.hsn_sac || '',
    category_id: item.category_id || '', unit_id: item.unit_id || '',
    tax_rate_id: item.tax_rate_id || '', track_inventory: item.track_inventory,
    low_stock_alert: item.low_stock_alert || '', description: item.description || '',
    sale_price: item.sale_price || '', purchase_price: item.purchase_price || '',
    mrp: item.mrp || '', opening_stock: item.opening_stock || 0,
  } : {
    name: '', sku: '', hsn_sac: '', category_id: '', unit_id: '', tax_rate_id: '',
    track_inventory: 1, low_stock_alert: '', description: '',
    sale_price: '', purchase_price: '', mrp: '', opening_stock: 0,
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function save() {
    if (!form.name) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      if (item) {
        await api.put(`/items/${item.id}`, form);
        toast.success('Item updated');
      } else {
        await api.post('/items', form);
        toast.success('Item created');
      }
      onSaved();
    } catch (err) { toast.error(errorMsg(err)); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          {item ? 'Edit Item' : 'Add Item'}
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group"><label>Item Name *</label>
              <input className="form-control" value={form.name} onChange={e => set('name', e.target.value)} /></div>
            <div className="form-group"><label>SKU</label>
              <input className="form-control" value={form.sku} onChange={e => set('sku', e.target.value)} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>HSN / SAC Code</label>
              <input className="form-control" value={form.hsn_sac} onChange={e => set('hsn_sac', e.target.value)} /></div>
            <div className="form-group"><label>Category</label>
              <select className="form-control" value={form.category_id} onChange={e => set('category_id', e.target.value)}>
                <option value="">— Select —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Unit</label>
              <select className="form-control" value={form.unit_id} onChange={e => set('unit_id', e.target.value)}>
                <option value="">— Select —</option>
                {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select></div>
            <div className="form-group"><label>Tax Rate</label>
              <select className="form-control" value={form.tax_rate_id} onChange={e => set('tax_rate_id', e.target.value)}>
                <option value="">— None —</option>
                {taxRates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.rate}%)</option>)}
              </select></div>
          </div>

          <hr className="divider" />
          <div className="section-header">Pricing</div>
          <div className="form-row-3">
            <div className="form-group"><label>Sale Price (₹)</label>
              <input className="form-control" type="number" value={form.sale_price} onChange={e => set('sale_price', e.target.value)} /></div>
            <div className="form-group"><label>Purchase Price (₹)</label>
              <input className="form-control" type="number" value={form.purchase_price} onChange={e => set('purchase_price', e.target.value)} /></div>
            <div className="form-group"><label>MRP (₹)</label>
              <input className="form-control" type="number" value={form.mrp} onChange={e => set('mrp', e.target.value)} /></div>
          </div>

          <hr className="divider" />
          <div className="section-header">Inventory</div>
          <div className="form-row">
            <div className="form-group"><label>Track Inventory</label>
              <select className="form-control" value={form.track_inventory} onChange={e => set('track_inventory', +e.target.value)}>
                <option value={1}>Yes</option><option value={0}>No</option>
              </select></div>
            {!item && <div className="form-group"><label>Opening Stock (qty)</label>
              <input className="form-control" type="number" value={form.opening_stock} onChange={e => set('opening_stock', e.target.value)} /></div>}
            <div className="form-group"><label>Low Stock Alert</label>
              <input className="form-control" type="number" value={form.low_stock_alert} onChange={e => set('low_stock_alert', e.target.value)} /></div>
          </div>
          <div className="form-group"><label>Description</label>
            <textarea className="form-control" rows={2} value={form.description} onChange={e => set('description', e.target.value)} /></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Item'}</button>
        </div>
      </div>
    </div>
  );
}
