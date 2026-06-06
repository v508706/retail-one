import React, { useEffect, useState, useRef } from 'react';
import { Search, Plus, Minus, Trash2, ShoppingCart, User, CreditCard, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { fmt, errorMsg } from '../lib/api.js';
import { getFirmId } from '../lib/auth.js';

export default function POS() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [party, setParty] = useState(null);
  const [partySearch, setPartySearch] = useState('');
  const [partySuggestions, setPartySuggestions] = useState([]);
  const [payMode, setPayMode] = useState('cash');
  const [discount, setDiscount] = useState(0);
  const [otherCharges, setOtherCharges] = useState(0);
  const [saving, setSaving] = useState(false);
  const [lastBill, setLastBill] = useState(null);
  const searchRef = useRef(null);

  useEffect(() => {
    api.get('/items', { params: { per_page: 200, search } }).then(r => setItems(r.data.data));
  }, [search]);

  useEffect(() => {
    if (partySearch.length >= 2) {
      api.get('/parties', { params: { search: partySearch, role: 'customer', per_page: 10 } })
        .then(r => setPartySuggestions(r.data.data));
    } else { setPartySuggestions([]); }
  }, [partySearch]);

  function addToCart(item) {
    setCart(c => {
      const existing = c.find(i => i.id === item.id);
      if (existing) return c.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      return [...c, { ...item, qty: 1 }];
    });
  }

  function updateQty(id, qty) {
    if (qty <= 0) { setCart(c => c.filter(i => i.id !== id)); return; }
    setCart(c => c.map(i => i.id === id ? { ...i, qty } : i));
  }

  function updatePrice(id, price) {
    setCart(c => c.map(i => i.id === id ? { ...i, sale_price: +price } : i));
  }

  const subTotal = cart.reduce((s, i) => s + (i.sale_price || 0) * i.qty, 0);
  const taxAmt = cart.reduce((s, i) => {
    const taxable = (i.sale_price || 0) * i.qty;
    const rate = i.tax_rate || 0;
    return s + taxable * rate / (100 + rate);
  }, 0);
  const grandTotal = subTotal - (+discount) + (+otherCharges);

  async function checkout() {
    if (cart.length === 0) { toast.error('Cart is empty'); return; }
    setSaving(true);
    try {
      const firmId = getFirmId();
      const payload = {
        firm_id: firmId,
        doc_type: 'pos',
        party_id: party?.id || null,
        discount_amt: +discount,
        other_charges: +otherCharges,
        items: cart.map(i => ({
          item_id: i.id,
          item_name: i.name,
          hsn_sac: i.hsn_sac || null,
          qty: i.qty,
          unit: i.unit_name || null,
          price_unit: i.sale_price || 0,
          tax_pct: i.tax_rate || 0,
          price_tax_incl: 1,
        })),
        payments: [{ pay_mode: payMode, amount: grandTotal }],
      };
      const { data } = await api.post('/sales', payload);
      setLastBill(data.data);
      toast.success(`Bill ${data.data.doc_no} created! ₹${fmt.currency(data.data.total)}`);
      setCart([]); setParty(null); setDiscount(0); setOtherCharges(0);
      searchRef.current?.focus();
    } catch (err) { toast.error(errorMsg(err)); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* POS topbar */}
      <div className="topbar">
        <span className="topbar-title">Point of Sale</span>
        {lastBill && (
          <span className="text-sm text-success">Last: {lastBill.doc_no} — {fmt.currency(lastBill.total)}</span>
        )}
      </div>

      <div className="pos-layout" style={{ flex: 1, overflow: 'hidden' }}>
        {/* Left: Item Grid */}
        <div className="pos-items">
          <div className="search-bar mb-3">
            <Search size={15} />
            <input ref={searchRef} className="form-control" placeholder="Search items (name / barcode)…"
              value={search} onChange={e => setSearch(e.target.value)} autoFocus />
          </div>

          <div className="item-grid">
            {items.map(item => (
              <div key={item.id} className="item-tile" onClick={() => addToCart(item)}>
                <div style={{ fontSize: 28, lineHeight: 1 }}>🛒</div>
                <div className="name">{item.name}</div>
                <div className="price">{fmt.currency(item.sale_price || 0)}</div>
                <div className="stock">Stock: {Math.round(item.stock_qty || 0)}</div>
              </div>
            ))}
            {items.length === 0 && <div className="text-muted text-sm">No items found</div>}
          </div>
        </div>

        {/* Right: Cart */}
        <div className="pos-cart">
          <div className="pos-cart-header">
            <div className="flex items-center gap-2">
              <ShoppingCart size={16} />
              Cart ({cart.length})
            </div>
          </div>

          {/* Customer */}
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', position: 'relative' }}>
            <div className="search-bar">
              <User size={13} />
              <input className="form-control" style={{ fontSize: 12 }} placeholder="Customer (optional)…"
                value={partySearch} onChange={e => setPartySearch(e.target.value)} />
            </div>
            {party && <div className="mt-1 text-sm text-primary">✓ {party.name}</div>}
            {partySuggestions.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 8, right: 8, background: '#fff', border: '1px solid var(--border)', borderRadius: 6, zIndex: 10, boxShadow: 'var(--shadow-lg)' }}>
                {partySuggestions.map(p => (
                  <div key={p.id} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13 }}
                    onClick={() => { setParty(p); setPartySearch(p.name); setPartySuggestions([]); }}>
                    {p.name} {p.phone ? `— ${p.phone}` : ''}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart Items */}
          <div className="pos-cart-items">
            {cart.length === 0 && <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>Add items from the left panel</div>}
            {cart.map(item => (
              <div key={item.id} className="pos-cart-item">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                  <input style={{ width: 70, padding: '2px 4px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 4, marginTop: 2 }}
                    type="number" value={item.sale_price || 0} onChange={e => updatePrice(item.id, e.target.value)} />
                </div>
                <div className="qty-ctrl">
                  <button onClick={() => updateQty(item.id, item.qty - 1)}>−</button>
                  <input type="number" value={item.qty} onChange={e => updateQty(item.id, +e.target.value)} />
                  <button onClick={() => updateQty(item.id, item.qty + 1)}>+</button>
                </div>
                <div style={{ width: 64, textAlign: 'right', fontSize: 13, fontWeight: 600 }}>{fmt.currency((item.sale_price || 0) * item.qty)}</div>
                <button className="btn btn-ghost btn-icon btn-sm text-danger" onClick={() => setCart(c => c.filter(i => i.id !== item.id))}><Trash2 size={13} /></button>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="pos-totals">
            <div className="pos-total-row"><span>Sub Total</span><span>{fmt.currency(subTotal)}</span></div>
            <div className="pos-total-row">
              <span>Discount (₹)</span>
              <input style={{ width: 80, textAlign: 'right', padding: '2px 6px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 13 }}
                type="number" value={discount} onChange={e => setDiscount(e.target.value)} />
            </div>
            <div className="pos-total-row">
              <span>Other Charges</span>
              <input style={{ width: 80, textAlign: 'right', padding: '2px 6px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 13 }}
                type="number" value={otherCharges} onChange={e => setOtherCharges(e.target.value)} />
            </div>
            <div className="pos-total-row grand"><span>Total</span><span>{fmt.currency(grandTotal)}</span></div>
          </div>

          {/* Payment Mode */}
          <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)' }}>
            <div className="section-header" style={{ marginBottom: 6 }}>Payment</div>
            <div className="flex gap-2 flex-wrap">
              {['cash', 'card', 'upi', 'credit'].map(m => (
                <button key={m} className={`btn btn-sm ${payMode === m ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setPayMode(m)}>{m.toUpperCase()}</button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="pos-actions">
            <button className="btn btn-secondary" onClick={() => setCart([])} disabled={cart.length === 0}>Clear</button>
            <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}
              onClick={checkout} disabled={saving || cart.length === 0}>
              <CreditCard size={15} /> {saving ? 'Processing…' : `Charge ${fmt.currency(grandTotal)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
