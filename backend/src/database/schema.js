// RetailOne — SQLite schema (adapted from MySQL 8 blueprint)
// Conventions: UUID PKs, tenant_id on every business row, soft delete, sync metadata

export const SCHEMA_SQL = `
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

-- =====================================================================
-- 1. TENANCY, PLANS, LICENSING
-- =====================================================================
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price_amount REAL NOT NULL DEFAULT 0,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  entitlements TEXT NOT NULL DEFAULT '{}',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  deployment TEXT NOT NULL DEFAULT 'cloud',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'trialing',
  trial_ends_at TEXT,
  current_period_end TEXT,
  license_token TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (plan_id) REFERENCES plans(id)
);

-- =====================================================================
-- 2. ORG HIERARCHY
-- =====================================================================
CREATE TABLE IF NOT EXISTS firms (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  gstin TEXT,
  state TEXT,
  state_code TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  logo_url TEXT,
  currency TEXT NOT NULL DEFAULT 'INR',
  decimals INTEGER NOT NULL DEFAULT 2,
  fy_start_month INTEGER NOT NULL DEFAULT 4,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS stores (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  firm_id TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS terminals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  store_id TEXT NOT NULL,
  name TEXT NOT NULL,
  doc_prefix TEXT NOT NULL DEFAULT 'T1',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  store_id TEXT,
  label TEXT,
  last_sync_at TEXT,
  sync_cursor INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- =====================================================================
-- 3. USERS, ROLES, RBAC
-- =====================================================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  password_hash TEXT,
  otp_code TEXT,
  otp_expires_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_phone ON users(tenant_id, phone) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_email ON users(tenant_id, email) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  is_system INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  module TEXT NOT NULL,
  can_view INTEGER NOT NULL DEFAULT 0,
  can_create INTEGER NOT NULL DEFAULT 0,
  can_edit INTEGER NOT NULL DEFAULT 0,
  can_share INTEGER NOT NULL DEFAULT 0,
  can_delete INTEGER NOT NULL DEFAULT 0,
  UNIQUE (role_id, module)
);

CREATE TABLE IF NOT EXISTS user_roles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  firm_id TEXT,
  store_id TEXT
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT,
  entity TEXT NOT NULL,
  entity_id TEXT,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL
);

-- =====================================================================
-- 4. CATALOG
-- =====================================================================
CREATE TABLE IF NOT EXISTS units (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  short_name TEXT,
  uqc TEXT,
  base_unit_id TEXT,
  conversion REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS tax_rates (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  rate REAL NOT NULL DEFAULT 0,
  hsn_sac TEXT,
  cgst_rate REAL,
  sgst_rate REAL,
  igst_rate REAL,
  cess_rate REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sku TEXT,
  hsn_sac TEXT,
  description TEXT,
  category_id TEXT,
  unit_id TEXT,
  tax_rate_id TEXT,
  type TEXT NOT NULL DEFAULT 'product',
  track_inventory INTEGER NOT NULL DEFAULT 1,
  low_stock_alert REAL,
  opening_stock REAL NOT NULL DEFAULT 0,
  opening_stock_rate REAL,
  item_image_url TEXT,
  custom_fields TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  device_id TEXT,
  sync_state TEXT NOT NULL DEFAULT 'synced',
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS ix_item_tenant ON items(tenant_id);

CREATE TABLE IF NOT EXISTS item_prices (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  mrp REAL,
  sale_price REAL,
  sale_tax_incl INTEGER NOT NULL DEFAULT 0,
  wholesale_price REAL,
  wholesale_min_qty REAL,
  purchase_price REAL,
  online_price REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS barcodes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  barcode TEXT NOT NULL,
  UNIQUE (tenant_id, barcode)
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  store_id TEXT,
  movement_type TEXT NOT NULL,
  qty REAL NOT NULL,
  rate REAL,
  ref_doc_type TEXT,
  ref_doc_id TEXT,
  reason TEXT,
  moved_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  device_id TEXT,
  sync_state TEXT NOT NULL DEFAULT 'synced'
);
CREATE INDEX IF NOT EXISTS ix_sm_item ON stock_movements(tenant_id, item_id);

-- =====================================================================
-- 5. PARTIES
-- =====================================================================
CREATE TABLE IF NOT EXISTS party_groups (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS parties (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer',
  name TEXT NOT NULL,
  gstin TEXT,
  gst_type TEXT NOT NULL DEFAULT 'consumer',
  phone TEXT,
  alt_phone TEXT,
  email TEXT,
  billing_address TEXT,
  shipping_address TEXT,
  area TEXT,
  city TEXT,
  state TEXT,
  state_code TEXT,
  party_group_id TEXT,
  customer_type TEXT,
  opening_balance REAL NOT NULL DEFAULT 0,
  credit_limit REAL,
  due_days INTEGER,
  loyalty_card TEXT,
  custom_fields TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  device_id TEXT,
  sync_state TEXT NOT NULL DEFAULT 'synced',
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS ix_party_tenant ON parties(tenant_id);

CREATE TABLE IF NOT EXISTS party_balances (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  party_id TEXT NOT NULL,
  receivable REAL NOT NULL DEFAULT 0,
  payable REAL NOT NULL DEFAULT 0,
  points REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, party_id)
);

-- =====================================================================
-- 6. DOCUMENT SEQUENCES
-- =====================================================================
CREATE TABLE IF NOT EXISTS document_sequences (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  firm_id TEXT NOT NULL,
  terminal_id TEXT,
  doc_type TEXT NOT NULL,
  prefix TEXT NOT NULL DEFAULT '',
  next_no INTEGER NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, firm_id, terminal_id, doc_type)
);

-- =====================================================================
-- 7. SALES DOCUMENTS
-- =====================================================================
CREATE TABLE IF NOT EXISTS sale_documents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  firm_id TEXT NOT NULL,
  store_id TEXT,
  terminal_id TEXT,
  doc_type TEXT NOT NULL,
  doc_no TEXT NOT NULL,
  doc_date TEXT NOT NULL,
  due_date TEXT,
  party_id TEXT,
  state_of_supply TEXT,
  ref_no TEXT,
  orig_doc_id TEXT,
  price_type TEXT NOT NULL DEFAULT 'retail',
  sub_total REAL NOT NULL DEFAULT 0,
  discount_amt REAL NOT NULL DEFAULT 0,
  tax_amt REAL NOT NULL DEFAULT 0,
  other_charges REAL NOT NULL DEFAULT 0,
  round_off REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  paid_amt REAL NOT NULL DEFAULT 0,
  balance_amt REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  einvoice_irn TEXT,
  ewaybill_no TEXT,
  notes TEXT,
  terms TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  device_id TEXT,
  sync_state TEXT NOT NULL DEFAULT 'synced',
  deleted_at TEXT,
  UNIQUE (tenant_id, firm_id, doc_type, doc_no)
);
CREATE INDEX IF NOT EXISTS ix_sd_tenant ON sale_documents(tenant_id);
CREATE INDEX IF NOT EXISTS ix_sd_date ON sale_documents(tenant_id, doc_date);

CREATE TABLE IF NOT EXISTS sale_document_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  item_id TEXT,
  item_name TEXT NOT NULL,
  hsn_sac TEXT,
  description TEXT,
  qty REAL NOT NULL DEFAULT 1,
  unit TEXT,
  price_unit REAL NOT NULL DEFAULT 0,
  price_tax_incl INTEGER NOT NULL DEFAULT 0,
  discount_pct REAL NOT NULL DEFAULT 0,
  discount_amt REAL NOT NULL DEFAULT 0,
  tax_pct REAL NOT NULL DEFAULT 0,
  tax_amt REAL NOT NULL DEFAULT 0,
  cgst REAL,
  sgst REAL,
  igst REAL,
  cess REAL,
  line_total REAL NOT NULL DEFAULT 0,
  cost_rate REAL
);
CREATE INDEX IF NOT EXISTS ix_sdi_doc ON sale_document_items(document_id);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  firm_id TEXT NOT NULL,
  party_id TEXT,
  direction TEXT NOT NULL,
  doc_id TEXT,
  pay_mode TEXT NOT NULL,
  amount REAL NOT NULL,
  pay_date TEXT NOT NULL,
  reference TEXT,
  bank_id TEXT,
  gateway TEXT,
  gateway_txn TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  device_id TEXT,
  sync_state TEXT NOT NULL DEFAULT 'synced'
);
CREATE INDEX IF NOT EXISTS ix_pay_tenant ON payments(tenant_id);

-- =====================================================================
-- 8. PURCHASE DOCUMENTS
-- =====================================================================
CREATE TABLE IF NOT EXISTS purchase_documents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  firm_id TEXT NOT NULL,
  doc_type TEXT NOT NULL DEFAULT 'purchase',
  doc_no TEXT NOT NULL,
  doc_date TEXT NOT NULL,
  party_id TEXT,
  grn_no TEXT,
  sub_total REAL NOT NULL DEFAULT 0,
  discount_amt REAL NOT NULL DEFAULT 0,
  tax_amt REAL NOT NULL DEFAULT 0,
  round_off REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  paid_amt REAL NOT NULL DEFAULT 0,
  balance_amt REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  device_id TEXT,
  sync_state TEXT NOT NULL DEFAULT 'synced',
  deleted_at TEXT,
  UNIQUE (tenant_id, firm_id, doc_type, doc_no)
);

CREATE TABLE IF NOT EXISTS purchase_document_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  item_id TEXT,
  item_name TEXT NOT NULL,
  hsn_sac TEXT,
  qty REAL NOT NULL DEFAULT 1,
  unit TEXT,
  price_unit REAL NOT NULL DEFAULT 0,
  discount_amt REAL NOT NULL DEFAULT 0,
  tax_pct REAL NOT NULL DEFAULT 0,
  tax_amt REAL NOT NULL DEFAULT 0,
  line_total REAL NOT NULL DEFAULT 0,
  mrp REAL,
  sale_price REAL
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  firm_id TEXT NOT NULL,
  po_no TEXT NOT NULL,
  po_date TEXT NOT NULL,
  due_date TEXT,
  party_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  total REAL NOT NULL DEFAULT 0,
  items TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  firm_id TEXT NOT NULL,
  category TEXT,
  amount REAL NOT NULL,
  tax_amt REAL NOT NULL DEFAULT 0,
  exp_date TEXT NOT NULL,
  party_id TEXT,
  pay_mode TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT
);

-- =====================================================================
-- 9. ACCOUNTING
-- =====================================================================
CREATE TABLE IF NOT EXISTS account_groups (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  nature TEXT NOT NULL,
  parent_id TEXT
);

CREATE TABLE IF NOT EXISTS ledger_accounts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  firm_id TEXT,
  name TEXT NOT NULL,
  group_id TEXT,
  opening_balance REAL NOT NULL DEFAULT 0,
  party_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS vouchers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  firm_id TEXT NOT NULL,
  voucher_type TEXT NOT NULL,
  voucher_no TEXT NOT NULL,
  voucher_date TEXT NOT NULL,
  narration TEXT,
  amount REAL NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  voucher_id TEXT NOT NULL,
  ledger_id TEXT NOT NULL,
  debit REAL NOT NULL DEFAULT 0,
  credit REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS banks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  firm_id TEXT NOT NULL,
  account_no TEXT,
  account_name TEXT,
  bank_name TEXT,
  branch TEXT,
  ifsc TEXT,
  opening_balance REAL NOT NULL DEFAULT 0,
  remarks TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS cheques (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  bank_id TEXT,
  party_id TEXT,
  cheque_no TEXT,
  amount REAL NOT NULL,
  direction TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  due_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS loans (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  firm_id TEXT NOT NULL,
  lender TEXT,
  principal REAL NOT NULL,
  balance REAL NOT NULL,
  interest_rate REAL,
  start_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- =====================================================================
-- 10. GST, LOYALTY, HR
-- =====================================================================
CREATE TABLE IF NOT EXISTS einvoice_log (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  irn TEXT,
  ack_no TEXT,
  qr_payload TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS loyalty_rules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  firm_id TEXT,
  earn_per_amount REAL NOT NULL DEFAULT 0,
  redeem_value REAL NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS point_transactions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  party_id TEXT NOT NULL,
  doc_id TEXT,
  points REAL NOT NULL,
  type TEXT NOT NULL,
  txn_date TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  firm_id TEXT,
  name TEXT NOT NULL,
  designation TEXT,
  department TEXT,
  gender TEXT,
  blood_group TEXT,
  national_id TEXT,
  dob TEXT,
  doj TEXT,
  nationality TEXT,
  photo_url TEXT,
  phone TEXT,
  user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS staff_profiles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  education TEXT,
  family TEXT,
  jobs TEXT,
  experience TEXT
);

-- =====================================================================
-- 11. ONLINE STORE
-- =====================================================================
CREATE TABLE IF NOT EXISTS store_settings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  firm_id TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT,
  theme TEXT,
  is_enabled INTEGER NOT NULL DEFAULT 0,
  delivery_enabled INTEGER NOT NULL DEFAULT 1,
  pickup_enabled INTEGER NOT NULL DEFAULT 1,
  online_payment INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS online_orders (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  firm_id TEXT NOT NULL,
  order_no TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  address TEXT,
  fulfilment TEXT NOT NULL DEFAULT 'pickup',
  items TEXT NOT NULL,
  total REAL NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  status TEXT NOT NULL DEFAULT 'new',
  linked_sale_doc_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- =====================================================================
-- 12. SETTINGS, NOTIFICATIONS, SYNC
-- =====================================================================
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  firm_id TEXT,
  scope TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, firm_id, scope)
);

CREATE TABLE IF NOT EXISTS message_log (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  recipient TEXT,
  template TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  ref_doc_id TEXT,
  error TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS change_log (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  op TEXT NOT NULL,
  payload TEXT,
  device_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_cursors (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  last_pulled_seq INTEGER NOT NULL DEFAULT 0,
  last_push_at TEXT,
  UNIQUE (tenant_id, device_id)
);

-- =====================================================================
-- 13. INVOICE TEMPLATES
-- =====================================================================
CREATE TABLE IF NOT EXISTS invoice_templates (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  firm_id TEXT NOT NULL,
  name TEXT NOT NULL,
  doc_type TEXT NOT NULL DEFAULT 'invoice',
  layout TEXT NOT NULL DEFAULT 'a4',
  theme_color TEXT NOT NULL DEFAULT '#1a56db',
  show_logo INTEGER NOT NULL DEFAULT 1,
  show_signature INTEGER NOT NULL DEFAULT 0,
  header_note TEXT,
  footer_note TEXT,
  terms TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

// change_log has two PRIMARY KEY clauses above which SQLite won't allow; fix:
export const SCHEMA_SQL_FIXED = SCHEMA_SQL.replace(
  `CREATE TABLE IF NOT EXISTS change_log (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  seq INTEGER PRIMARY KEY AUTOINCREMENT,`,
  `CREATE TABLE IF NOT EXISTS change_log (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,`
);
