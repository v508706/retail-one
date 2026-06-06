import React, { useEffect, useState } from 'react';
import { Globe, Package, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { fmt, errorMsg } from '../lib/api.js';

export default function OnlineStore() {
  const [tab, setTab] = useState('settings');
  return (
    <div style={{ padding: 20 }}>
      <div className="page-header"><h1>Online Store</h1></div>
      <div className="tabs">
        <button className={`tab ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}>Settings</button>
        <button className={`tab ${tab === 'orders' ? 'active' : ''}`} onClick={() => setTab('orders')}>Orders</button>
      </div>
      {tab === 'settings' && <StoreSettings />}
      {tab === 'orders' && <StoreOrders />}
    </div>
  );
}

function StoreSettings() {
  const [form, setForm] = useState({ store_name: '', tagline: '', is_active: false, accept_orders: false, delivery_note: '' });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/online-store/settings').then(r => {
      if (r.data) setForm({ store_name: r.data.store_name || '', tagline: r.data.tagline || '', is_active: !!r.data.is_active, accept_orders: !!r.data.accept_orders, delivery_note: r.data.delivery_note || '' });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-page"><div className="spinner" /></div>;

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function save() {
    setSaving(true);
    try { await api.put('/online-store/settings', form); toast.success('Store settings saved'); }
    catch (err) { toast.error(errorMsg(err)); } finally { setSaving(false); }
  }

  return (
    <div className="card" style={{ maxWidth: 580 }}>
      <div className="card-header">Online Store Settings</div>
      <div className="card-body">
        <div className="form-group">
          <label>Store Name</label>
          <input className="form-control" value={form.store_name} onChange={e => set('store_name', e.target.value)} placeholder="My Shop" />
        </div>
        <div className="form-group">
          <label>Tagline</label>
          <input className="form-control" value={form.tagline} onChange={e => set('tagline', e.target.value)} placeholder="Fresh products delivered to you" />
        </div>
        <div className="form-group">
          <label>Delivery / Order Note</label>
          <textarea className="form-control" rows={2} value={form.delivery_note} onChange={e => set('delivery_note', e.target.value)} placeholder="e.g. Orders delivered within 2 hours" />
        </div>
        <div className="flex gap-4 mb-3">
          <label className="flex gap-2 items-center" style={{ cursor: 'pointer', fontSize: 14 }}>
            <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
            Store is live (visible to customers)
          </label>
          <label className="flex gap-2 items-center" style={{ cursor: 'pointer', fontSize: 14 }}>
            <input type="checkbox" checked={form.accept_orders} onChange={e => set('accept_orders', e.target.checked)} />
            Accept online orders
          </label>
        </div>
        <div className="flex justify-between items-center mt-4">
          <div className="text-sm text-muted flex gap-1 items-center"><Globe size={13} /> Public URL: <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>/store/demo</code></div>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Settings'}</button>
        </div>
      </div>
    </div>
  );
}

function StoreOrders() {
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/online-store/orders').then(r => setOrders(r.data.data || [])).catch(() => setOrders([])).finally(() => setLoading(false));
  }, []);

  async function updateStatus(id, status) {
    try {
      await api.patch(`/online-store/orders/${id}/status`, { status });
      toast.success(`Order ${status}`);
      setOrders(o => o.map(x => x.id === id ? { ...x, status } : x));
      if (selected?.id === id) setSelected(s => ({ ...s, status }));
    } catch (err) { toast.error(errorMsg(err)); }
  }

  const statusColor = { pending: 'badge-yellow', confirmed: 'badge-blue', shipped: 'badge-blue', delivered: 'badge-green', cancelled: 'badge-red' };

  return (
    <div>
      {loading ? <div className="loading-page"><div className="spinner" /></div> : (
        <>
          <div className="card">
            <div className="table-wrap">
              <table>
                <thead><tr><th>Order No</th><th>Customer</th><th>Phone</th><th className="td-right">Total</th><th>Status</th><th>Date</th><th></th></tr></thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(o)}>
                      <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{o.order_no || o.id.slice(0, 8)}</td>
                      <td>{o.customer_name || '—'}</td>
                      <td>{o.customer_phone || '—'}</td>
                      <td className="td-right font-semibold">{fmt.currency(o.total)}</td>
                      <td><span className={`badge ${statusColor[o.status] || 'badge-gray'}`}>{o.status}</span></td>
                      <td>{fmt.date(o.created_at)}</td>
                      <td><button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); setSelected(o); }}>View</button></td>
                    </tr>
                  ))}
                  {orders.length === 0 && <tr><td colSpan={7}><div className="empty-state"><Package size={32} style={{ opacity: 0.3 }} /><div>No online orders yet</div></div></td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          {selected && <OrderDetailModal order={selected} onClose={() => setSelected(null)} onStatusChange={updateStatus} />}
        </>
      )}
    </div>
  );
}

function OrderDetailModal({ order, onClose, onStatusChange }) {
  const items = order.items || [];
  const nextStatus = { pending: 'confirmed', confirmed: 'shipped', shipped: 'delivered' };
  const next = nextStatus[order.status];
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          Order #{order.order_no || order.id.slice(0, 8)}
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="grid-2 mb-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div><div className="text-sm text-muted">Customer</div><div style={{ fontWeight: 500 }}>{order.customer_name || '—'}</div></div>
            <div><div className="text-sm text-muted">Phone</div><div>{order.customer_phone || '—'}</div></div>
            <div><div className="text-sm text-muted">Status</div><span className={`badge ${order.status === 'delivered' ? 'badge-green' : order.status === 'cancelled' ? 'badge-red' : 'badge-yellow'}`}>{order.status}</span></div>
            <div><div className="text-sm text-muted">Order Date</div><div>{fmt.date(order.created_at)}</div></div>
          </div>
          {order.delivery_address && <div className="mb-3"><div className="text-sm text-muted mb-1">Delivery Address</div><div style={{ fontSize: 13, background: '#f9fafb', padding: '8px 10px', borderRadius: 6 }}>{order.delivery_address}</div></div>}
          {items.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Item</th><th className="td-right">Qty</th><th className="td-right">Rate</th><th className="td-right">Amount</th></tr></thead>
                <tbody>
                  {items.map((i, idx) => <tr key={idx}><td>{i.item_name || i.name}</td><td className="td-right">{i.qty}</td><td className="td-right">{fmt.currency(i.price_unit)}</td><td className="td-right font-semibold">{fmt.currency(i.line_total || i.price_unit * i.qty)}</td></tr>)}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex justify-end mt-2" style={{ fontSize: 16, fontWeight: 700 }}>Total: {fmt.currency(order.total)}</div>
        </div>
        <div className="modal-footer">
          {order.status !== 'cancelled' && order.status !== 'delivered' && (
            <button className="btn btn-danger" onClick={() => { onStatusChange(order.id, 'cancelled'); }}>Cancel Order</button>
          )}
          {next && <button className="btn btn-primary" onClick={() => onStatusChange(order.id, next)}>Mark as {next.charAt(0).toUpperCase() + next.slice(1)}</button>}
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
