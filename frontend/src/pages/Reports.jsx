import React, { useEffect, useState } from 'react';
import { BarChart2, TrendingUp, Package, Users, DollarSign } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import api, { fmt } from '../lib/api.js';

const TABS = ['profit-loss', 'sale-summary', 'item-sale', 'party-sale', 'stock', 'outstanding', 'gst-summary', 'expenses'];

export default function Reports() {
  const [tab, setTab] = useState('profit-loss');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState(() => {
    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(new Date().setDate(1)).toISOString().slice(0, 10);
    return { from, to };
  });

  useEffect(() => {
    setLoading(true); setData(null);
    api.get(`/${tab}`, { params: range })
      .then(r => setData(r.data.data))
      .finally(() => setLoading(false));
  }, [tab, range]);

  return (
    <div style={{ padding: 20 }}>
      <div className="page-header">
        <h1>Reports</h1>
        <div className="flex gap-2">
          <input type="date" className="form-control" style={{ width: 140 }} value={range.from} onChange={e => setRange(r => ({ ...r, from: e.target.value }))} />
          <input type="date" className="form-control" style={{ width: 140 }} value={range.to} onChange={e => setRange(r => ({ ...r, to: e.target.value }))} />
        </div>
      </div>

      <div className="tabs" style={{ flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </button>
        ))}
      </div>

      {loading && <div className="loading-page"><div className="spinner" /></div>}

      {!loading && data && tab === 'profit-loss' && <ProfitLossReport data={data} />}
      {!loading && data && tab === 'sale-summary' && <SaleSummaryReport data={data} />}
      {!loading && data && tab === 'item-sale' && <ItemSaleReport data={data} />}
      {!loading && data && tab === 'party-sale' && <PartySaleReport data={data} />}
      {!loading && data && tab === 'stock' && <StockReport data={data} />}
      {!loading && data && tab === 'outstanding' && <OutstandingReport data={data} />}
      {!loading && data && tab === 'gst-summary' && <GSTReport data={data} />}
      {!loading && data && tab === 'expenses' && <ExpensesReport data={data} />}
    </div>
  );
}

function ProfitLossReport({ data }) {
  const rows = [
    { label: 'Net Sales', value: data.net_sales, color: 'text-primary' },
    { label: 'Cost of Goods', value: data.cost_of_goods, color: 'text-danger' },
    { label: 'Gross Profit', value: data.gross_profit, color: data.gross_profit >= 0 ? 'text-success' : 'text-danger' },
    { label: 'Expenses', value: data.expenses, color: 'text-danger' },
    { label: 'Net Profit', value: data.net_profit, color: data.net_profit >= 0 ? 'text-success' : 'text-danger' },
  ];
  const margin = data.net_sales > 0 ? (data.net_profit / data.net_sales * 100).toFixed(1) : 0;

  return (
    <div className="grid-2">
      <div className="card">
        <div className="card-header">Profit & Loss Summary</div>
        <div className="card-body">
          {rows.map(r => (
            <div key={r.label} className="flex justify-between" style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: r.label.includes('Profit') ? 15 : 14 }}>
              <span style={{ fontWeight: r.label.includes('Net') ? 700 : 400 }}>{r.label}</span>
              <span className={`font-bold ${r.color}`}>{fmt.currency(r.value)}</span>
            </div>
          ))}
          <div className="mt-2 text-sm text-muted">Net Margin: <strong>{margin}%</strong></div>
        </div>
      </div>
      <div className="card">
        <div className="card-header">Breakdown</div>
        <div className="card-body" style={{ height: 250 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={[{ name: 'Sales', value: data.net_sales }, { name: 'COGS', value: data.cost_of_goods }, { name: 'Expenses', value: data.expenses }, { name: 'Net Profit', value: Math.abs(data.net_profit) }]}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={v => fmt.currency(v)} />
              <Bar dataKey="value" fill="#1a56db" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function SaleSummaryReport({ data }) {
  return (
    <div className="card">
      <div className="card-header">Daily Sale Summary</div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Type</th><th className="td-right">Sub Total</th><th className="td-right">Discount</th><th className="td-right">Tax</th><th className="td-right">Total</th><th className="td-right">Paid</th><th>Count</th></tr></thead>
          <tbody>
            {data.map((r, i) => <tr key={i}><td>{fmt.date(r.doc_date)}</td><td><span className="badge badge-blue">{r.doc_type}</span></td><td className="td-right">{fmt.currency(r.sub_total)}</td><td className="td-right text-danger">{fmt.currency(r.discount_amt)}</td><td className="td-right">{fmt.currency(r.tax_amt)}</td><td className="td-right font-bold">{fmt.currency(r.total)}</td><td className="td-right text-success">{fmt.currency(r.paid_amt)}</td><td className="td-right">{r.count}</td></tr>)}
            {data.length === 0 && <tr><td colSpan={8}><div className="empty-state">No sales</div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ItemSaleReport({ data }) {
  const COLORS = ['#1a56db', '#057a55', '#b45309', '#e02424', '#7c3aed'];
  return (
    <div className="grid-2">
      <div className="card">
        <div className="card-header">Item-wise Sales</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Item</th><th>HSN</th><th className="td-right">Qty</th><th className="td-right">Tax</th><th className="td-right">Amount</th></tr></thead>
            <tbody>
              {data.map((r, i) => <tr key={i}><td style={{ fontWeight: 500 }}>{r.item_name}</td><td>{r.hsn_sac || '—'}</td><td className="td-right">{fmt.number(r.total_qty)}</td><td className="td-right">{fmt.currency(r.total_tax)}</td><td className="td-right font-bold">{fmt.currency(r.total_amount)}</td></tr>)}
              {data.length === 0 && <tr><td colSpan={5}><div className="empty-state">No data</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <div className="card-header">Top Items by Amount</div>
        <div className="card-body" style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data.slice(0, 5)} dataKey="total_amount" nameKey="item_name" outerRadius={100}>
                {data.slice(0, 5).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Legend />
              <Tooltip formatter={v => fmt.currency(v)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function PartySaleReport({ data }) {
  return (
    <div className="card">
      <div className="card-header">Party-wise Sales</div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Party</th><th className="td-right">Invoices</th><th className="td-right">Total</th><th className="td-right">Paid</th><th className="td-right">Balance</th></tr></thead>
          <tbody>
            {data.map((r, i) => <tr key={i}><td style={{ fontWeight: 500 }}>{r.party_name || 'Walk-in'}</td><td className="td-right">{r.invoice_count}</td><td className="td-right font-bold">{fmt.currency(r.total_amount)}</td><td className="td-right text-success">{fmt.currency(r.paid_amt)}</td><td className="td-right text-danger">{r.balance_amt > 0 ? fmt.currency(r.balance_amt) : '—'}</td></tr>)}
            {data.length === 0 && <tr><td colSpan={5}><div className="empty-state">No data</div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StockReport({ data }) {
  const lowStock = data.filter(r => r.low_stock_alert && r.stock_qty <= r.low_stock_alert);
  return (
    <div>
      {lowStock.length > 0 && (
        <div style={{ background: 'var(--warning-light)', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: 'var(--warning)' }}>
          ⚠ {lowStock.length} item(s) are low on stock
        </div>
      )}
      <div className="card">
        <div className="card-header">Stock Summary</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Item</th><th>SKU</th><th>Category</th><th>Unit</th><th className="td-right">Stock Qty</th><th className="td-right">Sale Price</th><th className="td-right">Stock Value</th><th>Alert</th></tr></thead>
            <tbody>
              {data.map((r, i) => (
                <tr key={i} style={{ background: r.low_stock_alert && r.stock_qty <= r.low_stock_alert ? '#fffbeb' : '' }}>
                  <td style={{ fontWeight: 500 }}>{r.name}</td><td>{r.sku || '—'}</td><td>{r.category || '—'}</td><td>{r.unit || '—'}</td>
                  <td className="td-right">{fmt.number(r.stock_qty)}</td>
                  <td className="td-right">{r.sale_price ? fmt.currency(r.sale_price) : '—'}</td>
                  <td className="td-right font-bold">{fmt.currency(r.stock_value)}</td>
                  <td>{r.low_stock_alert ? (r.stock_qty <= r.low_stock_alert ? <span className="badge badge-yellow">Low</span> : '—') : '—'}</td>
                </tr>
              ))}
              {data.length === 0 && <tr><td colSpan={8}><div className="empty-state">No items</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function OutstandingReport({ data }) {
  const total = data.reduce((s, r) => s + r.balance_amt, 0);
  return (
    <div>
      <div className="card mb-3">
        <div className="card-body">
          <div className="flex gap-4">
            <div><div className="text-sm text-muted">Total Outstanding</div><div className="font-bold text-danger" style={{ fontSize: 22 }}>{fmt.currency(total)}</div></div>
            <div><div className="text-sm text-muted">Invoices</div><div className="font-bold" style={{ fontSize: 22 }}>{data.length}</div></div>
            <div><div className="text-sm text-muted">Overdue</div><div className="font-bold text-danger" style={{ fontSize: 22 }}>{data.filter(r => r.overdue).length}</div></div>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Doc No</th><th>Party</th><th>Date</th><th>Due Date</th><th className="td-right">Total</th><th className="td-right">Balance</th><th>Overdue</th></tr></thead>
            <tbody>
              {data.map((r, i) => <tr key={i}><td style={{ fontWeight: 600, color: 'var(--primary)' }}>{r.doc_no}</td><td>{r.party_name || '—'}</td><td>{fmt.date(r.doc_date)}</td><td>{r.due_date ? fmt.date(r.due_date) : '—'}</td><td className="td-right">{fmt.currency(r.total)}</td><td className="td-right font-bold text-danger">{fmt.currency(r.balance_amt)}</td><td>{r.overdue ? <span className="badge badge-red">Overdue</span> : '—'}</td></tr>)}
              {data.length === 0 && <tr><td colSpan={7}><div className="empty-state">No outstanding</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function GSTReport({ data }) {
  const totals = data.reduce((a, r) => ({ taxable: a.taxable + r.taxable_value, cgst: a.cgst + r.cgst, sgst: a.sgst + r.sgst, igst: a.igst + r.igst, total: a.total + r.total_tax }), { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 });
  return (
    <div className="card">
      <div className="card-header">GST Summary (GSTR-1 Style)</div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Tax Rate</th><th className="td-right">Taxable Value</th><th className="td-right">CGST</th><th className="td-right">SGST</th><th className="td-right">IGST</th><th className="td-right">Total Tax</th></tr></thead>
          <tbody>
            {data.map((r, i) => <tr key={i}><td><span className="badge badge-blue">{r.tax_pct}%</span></td><td className="td-right">{fmt.currency(r.taxable_value)}</td><td className="td-right">{fmt.currency(r.cgst)}</td><td className="td-right">{fmt.currency(r.sgst)}</td><td className="td-right">{fmt.currency(r.igst)}</td><td className="td-right font-bold">{fmt.currency(r.total_tax)}</td></tr>)}
            <tr style={{ fontWeight: 700, background: '#f3f4f6' }}><td>Total</td><td className="td-right">{fmt.currency(totals.taxable)}</td><td className="td-right">{fmt.currency(totals.cgst)}</td><td className="td-right">{fmt.currency(totals.sgst)}</td><td className="td-right">{fmt.currency(totals.igst)}</td><td className="td-right">{fmt.currency(totals.total)}</td></tr>
            {data.length === 0 && <tr><td colSpan={6}><div className="empty-state">No GST data</div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExpensesReport({ data }) {
  const total = data.reduce((s, r) => s + r.total, 0);
  return (
    <div className="grid-2">
      <div className="card">
        <div className="card-header">Expenses by Category</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Category</th><th className="td-right">Count</th><th className="td-right">Amount</th></tr></thead>
            <tbody>
              {data.map((r, i) => <tr key={i}><td style={{ fontWeight: 500 }}>{r.category || 'Uncategorised'}</td><td className="td-right">{r.count}</td><td className="td-right font-bold text-danger">{fmt.currency(r.total)}</td></tr>)}
              <tr style={{ fontWeight: 700 }}><td>Total</td><td></td><td className="td-right text-danger">{fmt.currency(total)}</td></tr>
              {data.length === 0 && <tr><td colSpan={3}><div className="empty-state">No expenses</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <div className="card-header">Chart</div>
        <div className="card-body" style={{ height: 250 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.map(r => ({ ...r, category: r.category || 'Misc' }))}>
              <XAxis dataKey="category" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={v => fmt.currency(v)} />
              <Bar dataKey="total" fill="#e02424" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
