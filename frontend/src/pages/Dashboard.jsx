import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, ShoppingCart, AlertTriangle, DollarSign, Package, Users, ArrowRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import api, { fmt } from '../lib/api.js';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(() => {
    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(new Date().setDate(1)).toISOString().slice(0, 10);
    return { from, to };
  });

  useEffect(() => {
    api.get('/dashboard', { params: range })
      .then(r => setData(r.data.data))
      .finally(() => setLoading(false));
  }, [range]);

  if (loading) return <div className="loading-page"><div className="spinner" /></div>;
  if (!data) return null;

  const trendData = data.trend.map(t => ({ date: fmt.date(t.doc_date).slice(0, 6), total: t.total }));

  return (
    <div style={{ padding: 20 }}>
      {/* header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Dashboard</h1>
          <p className="text-muted text-sm">{fmt.date(range.from)} — {fmt.date(range.to)}</p>
        </div>
        <div className="flex gap-2">
          <input type="date" className="form-control" style={{ width: 140 }} value={range.from}
            onChange={e => setRange(r => ({ ...r, from: e.target.value }))} />
          <input type="date" className="form-control" style={{ width: 140 }} value={range.to}
            onChange={e => setRange(r => ({ ...r, to: e.target.value }))} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid-4 mb-4">
        <StatCard icon={<TrendingUp size={20} color="#1a56db" />} iconBg="#ebf0ff"
          label="Sales This Period" value={fmt.currency(data.sales.total)}
          sub={`${data.sales.count} invoices`} />
        <StatCard icon={<ShoppingCart size={20} color="#057a55" />} iconBg="#e8faf3"
          label="Today's Sales" value={fmt.currency(data.today_sales)}
          sub="Cash + Credit" />
        <StatCard icon={<DollarSign size={20} color="#e02424" />} iconBg="#fde8e8"
          label="Outstanding" value={fmt.currency(data.outstanding)}
          sub="Receivables" />
        <StatCard icon={<AlertTriangle size={20} color="#b45309" />} iconBg="#fef3c7"
          label="Low Stock Items" value={data.low_stock}
          sub="Need reorder" />
      </div>

      <div className="grid-2 mb-4">
        {/* Sales Trend */}
        <div className="card">
          <div className="card-header">Sales Trend (Last 7 Days)</div>
          <div className="card-body" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1a56db" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#1a56db" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={v => fmt.currency(v)} />
                <Area type="monotone" dataKey="total" stroke="#1a56db" strokeWidth={2} fill="url(#grad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Items */}
        <div className="card">
          <div className="card-header">
            Top Selling Items
            <Link to="/reports" className="btn btn-ghost btn-sm"><ArrowRight size={14} /></Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <table style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ padding: '8px 14px', fontSize: 11, color: '#6b7280', textAlign: 'left' }}>Item</th>
                  <th style={{ padding: '8px 14px', fontSize: 11, color: '#6b7280', textAlign: 'right' }}>Qty</th>
                  <th style={{ padding: '8px 14px', fontSize: 11, color: '#6b7280', textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.top_items.map((item, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '9px 14px', fontSize: 13 }}>{item.item_name}</td>
                    <td style={{ padding: '9px 14px', fontSize: 13, textAlign: 'right' }}>{fmt.number(item.total_qty)}</td>
                    <td style={{ padding: '9px 14px', fontSize: 13, textAlign: 'right', fontWeight: 600 }}>{fmt.currency(item.total_amount)}</td>
                  </tr>
                ))}
                {data.top_items.length === 0 && (
                  <tr><td colSpan={3} style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>No sales yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="card-header">Quick Actions</div>
        <div className="card-body">
          <div className="flex gap-3 flex-wrap">
            <Link to="/pos" className="btn btn-primary"><ShoppingCart size={15} /> New Sale (POS)</Link>
            <Link to="/sales?new=invoice" className="btn btn-secondary"><TrendingUp size={15} /> New Invoice</Link>
            <Link to="/purchases?new=1" className="btn btn-secondary"><Package size={15} /> New Purchase</Link>
            <Link to="/parties?new=1" className="btn btn-secondary"><Users size={15} /> Add Party</Link>
            <Link to="/items?new=1" className="btn btn-secondary"><Package size={15} /> Add Item</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, iconBg, label, value, sub }) {
  return (
    <div className="stat-card">
      <div className="icon-wrap" style={{ background: iconBg }}>{icon}</div>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      <div className="sub">{sub}</div>
    </div>
  );
}
