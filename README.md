# RetailOne

Multi-tenant Retail & Wholesale Management Platform — built for Indian retail businesses.

## Features

- 🛒 **POS** — Touch-friendly point-of-sale with barcode support
- 📦 **Inventory** — Event-sourced stock with HSN/SKU tracking
- 🧾 **Sales** — Invoices, estimates, delivery challans, credit notes
- 🛍️ **Purchases** — GRN, purchase orders, expenses
- 👥 **Parties** — Customers & suppliers with ledger statements
- 💰 **Accounting** — Banks, cheques, vouchers, chart of accounts
- 📊 **Reports** — P&L, GST summary, stock, outstanding, cash flow
- 🏆 **Loyalty** — Points earn/redeem rules
- 🌐 **Online Store** — Public storefront with order management
- 👨‍💼 **Staff / HR** — Employee management
- ⚙️ **Settings** — Multi-firm, roles & permissions, invoice templates

## Tech Stack

| Layer    | Technology |
|----------|-----------|
| Backend  | PHP 8.2 (built-in server) |
| Database | MySQL 8 / MariaDB 10 (via XAMPP) |
| Frontend | React 19 + Vite |
| Auth     | JWT HS256 — zero dependencies, manual implementation |
| UI       | Custom CSS design system + Recharts |

## Requirements

- [XAMPP](https://www.apachefriends.org/) — provides PHP 8.2 and MySQL
- Node.js 18+ — for the React frontend
- Windows (start.bat) — or run commands manually on Linux/Mac

## Quick Start

1. Install XAMPP and start **MySQL** from the XAMPP Control Panel
2. Run setup once (first time only):

```bat
"C:\xampp\mysql\bin\mysql.exe" -u root -e "CREATE DATABASE IF NOT EXISTS retail_one"
"C:\xampp\mysql\bin\mysql.exe" -u root retail_one < backend-php\database\schema.sql
"C:\xampp\php\php.exe" backend-php\database\seed.php
```

3. Launch everything:

```bat
start.bat
```

Opens automatically:
- **Frontend** → http://localhost:5173
- **Backend API** → http://localhost:3001/api/v1

**Demo login:** `admin@demo.com` / `admin123`

## Reset / Re-seed Database

```bat
"C:\xampp\mysql\bin\mysql.exe" -u root retail_one < backend-php\database\schema.sql
"C:\xampp\php\php.exe" backend-php\database\seed.php
```

## Manual Start (without start.bat)

```bat
:: Terminal 1 — PHP backend (port 3001)
"C:\xampp\php\php.exe" -S localhost:3001 backend-php\index.php

:: Terminal 2 — React frontend (port 5173)
cd frontend && npm run dev
```

## Project Structure

```
retail-one/
├── backend-php/
│   ├── config.php            DB + JWT constants
│   ├── index.php             Entry point & router
│   ├── start.bat             Start PHP server standalone
│   ├── src/
│   │   ├── DB.php            PDO singleton
│   │   ├── JWT.php           HS256 JWT (no Composer)
│   │   ├── helpers.php       Response helpers, requireAuth()
│   │   ├── pricing.php       Line totals, GST split
│   │   └── api/
│   │       ├── auth.php      Login, refresh, OTP, /me
│   │       ├── catalog.php   Items, units, categories, tax rates
│   │       ├── parties.php   Customers, suppliers, statement
│   │       ├── sales.php     Invoices, POS, estimates, payments
│   │       ├── purchase.php  Purchases, expenses, purchase orders
│   │       ├── accounting.php Banks, cheques, vouchers
│   │       ├── reports.php   P&L, GST, stock, top items, cash flow
│   │       ├── settings.php  Firms, users, roles, templates
│   │       ├── loyalty.php   Points rules & transactions
│   │       ├── hr.php        Staff management
│   │       └── online_store.php  Online orders
│   └── database/
│       ├── schema.sql        35-table MySQL schema
│       └── seed.php          Demo data seeder
├── frontend/
│   └── src/
│       ├── components/       Shell layout
│       ├── lib/              API client (axios), auth helpers
│       └── pages/            13 app pages
└── start.bat                 One-click launcher (MySQL + PHP + React)
```

## API Contract

All endpoints are prefixed `/api/v1/`. The Vite dev proxy forwards frontend
requests to the PHP backend transparently — no frontend changes needed.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /auth/login | Email + password login |
| POST | /auth/refresh | Refresh access token |
| GET | /items | List items (paginated) |
| POST | /sales | Create invoice / POS sale |
| POST | /sales/:id/payment | Record payment |
| GET | /reports/profit-loss | P&L statement |
| GET | /reports/gst | GST output vs input |
| … | … | Full CRUD for all modules |

Responses: `{ data: ... }` or `{ data: [...], meta: { page, per_page, total } }`  
Errors: `{ error: { code: "CODE", message: "..." } }`
