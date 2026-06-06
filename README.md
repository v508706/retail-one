# RetailOne

Multi-tenant Retail & Wholesale Management Platform — built for Indian retail businesses.

## Features

- 🛒 **POS** — Touch-friendly point-of-sale with barcode support
- 📦 **Inventory** — Event-sourced stock with HSN/SKU tracking
- 🧾 **Sales** — Invoices, estimates, delivery challans, credit notes
- 🛍️ **Purchases** — GRN, purchase orders, expenses
- 👥 **Parties** — Customers & suppliers with ledger statements
- 💰 **Accounting** — Banks, cheques, vouchers, chart of accounts
- 📊 **Reports** — P&L, GST summary, stock, outstanding, loyalty
- 🏆 **Loyalty** — Points earn/redeem rules
- 🌐 **Online Store** — Public storefront with order management
- 👨‍💼 **Staff / HR** — Employee management
- ⚙️ **Settings** — Multi-firm, roles & permissions, invoice templates

## Tech Stack

| Layer    | Technology |
|----------|-----------|
| Backend  | Node.js 22 + Express |
| Database | SQLite (node:sqlite built-in) |
| Frontend | React 18 + Vite |
| Auth     | JWT (access + refresh tokens) |
| UI       | Custom CSS design system + Recharts |

## Quick Start

```
start.bat
```

Opens:
- Frontend → http://localhost:5173
- Backend API → http://localhost:3001/api/v1

**Demo credentials:** `admin@retailone.app` / `demo1234`

## Seed / Reset Database

```bash
cd backend
npm run seed
```

## Development

```bash
# Backend (port 3001)
cd backend && npm run dev

# Frontend (port 5173)
cd frontend && npm run dev
```

## Project Structure

```
retail-one/
├── backend/
│   ├── src/
│   │   ├── database/     # Schema, migrations, seed
│   │   ├── middleware/   # Auth, tenant scope
│   │   ├── modules/      # Feature routers (catalog, sales, …)
│   │   └── services/     # Pricing, GST calculations
│   └── data/             # SQLite database (gitignored)
├── frontend/
│   └── src/
│       ├── components/   # Shell layout
│       ├── lib/          # API client, auth helpers
│       └── pages/        # All 13 app pages
└── start.bat             # Launch both servers
```
