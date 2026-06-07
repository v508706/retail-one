-- RetailOne — MySQL Schema
-- Run: mysql -u root retail_one < schema.sql

SET FOREIGN_KEY_CHECKS = 0;
SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS retail_one
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE retail_one;

-- ── Core auth ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tenants (
  id         VARCHAR(36) PRIMARY KEY,
  slug       VARCHAR(50)  NOT NULL UNIQUE,
  name       VARCHAR(150) NOT NULL,
  status     ENUM('active','inactive','suspended') DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS users (
  id               VARCHAR(36) PRIMARY KEY,
  tenant_id        VARCHAR(36) NOT NULL,
  name             VARCHAR(150),
  email            VARCHAR(150),
  phone            VARCHAR(20),
  password_hash    VARCHAR(255),
  status           ENUM('active','inactive','pending') DEFAULT 'active',
  otp_code         VARCHAR(10),
  otp_expires_at   DATETIME,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX (tenant_id),
  INDEX (tenant_id, email),
  INDEX (tenant_id, phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS roles (
  id        VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  name      VARCHAR(100) NOT NULL,
  INDEX (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_roles (
  id        VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  user_id   VARCHAR(36) NOT NULL,
  role_id   VARCHAR(36) NOT NULL,
  INDEX (tenant_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS role_permissions (
  id         VARCHAR(36) PRIMARY KEY,
  tenant_id  VARCHAR(36) NOT NULL,
  role_id    VARCHAR(36) NOT NULL,
  module     VARCHAR(50) NOT NULL,
  can_view   TINYINT DEFAULT 0,
  can_create TINYINT DEFAULT 0,
  can_edit   TINYINT DEFAULT 0,
  can_share  TINYINT DEFAULT 0,
  can_delete TINYINT DEFAULT 0,
  INDEX (tenant_id, role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Business entities ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS firms (
  id             VARCHAR(36) PRIMARY KEY,
  tenant_id      VARCHAR(36) NOT NULL,
  name           VARCHAR(150) NOT NULL,
  gstin          VARCHAR(20),
  state          VARCHAR(100),
  state_code     VARCHAR(5),
  address        TEXT,
  phone          VARCHAR(20),
  email          VARCHAR(150),
  currency       VARCHAR(10) DEFAULT 'INR',
  decimals       INT DEFAULT 2,
  fy_start_month INT DEFAULT 4,
  logo_url       TEXT,
  deleted_at     DATETIME,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  version        INT DEFAULT 1,
  INDEX (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS stores (
  id         VARCHAR(36) PRIMARY KEY,
  tenant_id  VARCHAR(36) NOT NULL,
  firm_id    VARCHAR(36),
  name       VARCHAR(150) NOT NULL,
  address    TEXT,
  deleted_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  version    INT DEFAULT 1,
  INDEX (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS terminals (
  id         VARCHAR(36) PRIMARY KEY,
  tenant_id  VARCHAR(36) NOT NULL,
  store_id   VARCHAR(36),
  name       VARCHAR(100),
  doc_prefix VARCHAR(10) DEFAULT 'T1',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Catalog ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS units (
  id           VARCHAR(36) PRIMARY KEY,
  tenant_id    VARCHAR(36) NOT NULL,
  name         VARCHAR(100) NOT NULL,
  short_name   VARCHAR(20),
  uqc          VARCHAR(20),
  base_unit_id VARCHAR(36),
  conversion   DECIMAL(15,6),
  deleted_at   DATETIME,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  version      INT DEFAULT 1,
  INDEX (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS categories (
  id         VARCHAR(36) PRIMARY KEY,
  tenant_id  VARCHAR(36) NOT NULL,
  name       VARCHAR(100) NOT NULL,
  parent_id  VARCHAR(36),
  deleted_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  version    INT DEFAULT 1,
  INDEX (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tax_rates (
  id         VARCHAR(36) PRIMARY KEY,
  tenant_id  VARCHAR(36) NOT NULL,
  name       VARCHAR(100) NOT NULL,
  rate       DECIMAL(8,4) DEFAULT 0,
  hsn_sac    VARCHAR(20),
  cgst_rate  DECIMAL(8,4),
  sgst_rate  DECIMAL(8,4),
  igst_rate  DECIMAL(8,4),
  cess_rate  DECIMAL(8,4),
  deleted_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  version    INT DEFAULT 1,
  INDEX (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS items (
  id                 VARCHAR(36) PRIMARY KEY,
  tenant_id          VARCHAR(36) NOT NULL,
  name               VARCHAR(200) NOT NULL,
  sku                VARCHAR(100),
  hsn_sac            VARCHAR(20),
  description        TEXT,
  category_id        VARCHAR(36),
  unit_id            VARCHAR(36),
  tax_rate_id        VARCHAR(36),
  type               ENUM('product','service','combo') DEFAULT 'product',
  track_inventory    TINYINT DEFAULT 1,
  low_stock_alert    DECIMAL(15,4),
  opening_stock      DECIMAL(15,4) DEFAULT 0,
  opening_stock_rate DECIMAL(15,4),
  deleted_at         DATETIME,
  created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  version            INT DEFAULT 1,
  sync_state         VARCHAR(20) DEFAULT 'synced',
  INDEX (tenant_id),
  INDEX (tenant_id, sku)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS item_prices (
  id              VARCHAR(36) PRIMARY KEY,
  tenant_id       VARCHAR(36) NOT NULL,
  item_id         VARCHAR(36) NOT NULL,
  sale_price      DECIMAL(15,4),
  mrp             DECIMAL(15,4),
  purchase_price  DECIMAL(15,4),
  wholesale_price DECIMAL(15,4),
  wholesale_min_qty DECIMAL(15,4),
  online_price    DECIMAL(15,4),
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  version         INT DEFAULT 1,
  UNIQUE KEY (tenant_id, item_id),
  INDEX (item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS barcodes (
  id        VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  item_id   VARCHAR(36) NOT NULL,
  barcode   VARCHAR(100) NOT NULL,
  UNIQUE KEY (tenant_id, barcode),
  INDEX (item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS stock_movements (
  id            VARCHAR(36) PRIMARY KEY,
  tenant_id     VARCHAR(36) NOT NULL,
  item_id       VARCHAR(36) NOT NULL,
  store_id      VARCHAR(36),
  movement_type ENUM('opening','purchase','sale','adjustment','transfer_in','transfer_out','return_in','return_out') NOT NULL,
  qty           DECIMAL(15,4) NOT NULL,
  rate          DECIMAL(15,4),
  reason        TEXT,
  ref_doc_type  VARCHAR(50),
  ref_doc_id    VARCHAR(36),
  moved_at      DATETIME,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  version       INT DEFAULT 1,
  sync_state    VARCHAR(20) DEFAULT 'synced',
  INDEX (tenant_id, item_id),
  INDEX (item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Parties ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS party_groups (
  id        VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  name      VARCHAR(100) NOT NULL,
  INDEX (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS parties (
  id               VARCHAR(36) PRIMARY KEY,
  tenant_id        VARCHAR(36) NOT NULL,
  role             ENUM('customer','supplier','both') DEFAULT 'customer',
  name             VARCHAR(200) NOT NULL,
  gstin            VARCHAR(20),
  gst_type         ENUM('regular','composite','consumer','unregistered') DEFAULT 'consumer',
  phone            VARCHAR(20),
  email            VARCHAR(150),
  billing_address  TEXT,
  shipping_address TEXT,
  area             VARCHAR(100),
  city             VARCHAR(100),
  state            VARCHAR(100),
  state_code       VARCHAR(5),
  party_group_id   VARCHAR(36),
  customer_type    VARCHAR(50),
  opening_balance  DECIMAL(15,4) DEFAULT 0,
  credit_limit     DECIMAL(15,4),
  due_days         INT,
  loyalty_card     VARCHAR(50),
  deleted_at       DATETIME,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  version          INT DEFAULT 1,
  sync_state       VARCHAR(20) DEFAULT 'synced',
  INDEX (tenant_id),
  INDEX (tenant_id, phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS party_balances (
  id         VARCHAR(36) PRIMARY KEY,
  tenant_id  VARCHAR(36) NOT NULL,
  party_id   VARCHAR(36) NOT NULL,
  receivable DECIMAL(15,4) DEFAULT 0,
  payable    DECIMAL(15,4) DEFAULT 0,
  points     DECIMAL(15,4) DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY (tenant_id, party_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Sequences & Settings ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS document_sequences (
  id          VARCHAR(36) PRIMARY KEY,
  tenant_id   VARCHAR(36) NOT NULL,
  firm_id     VARCHAR(36) NOT NULL,
  terminal_id VARCHAR(36),
  doc_type    VARCHAR(50) NOT NULL,
  prefix      VARCHAR(20) NOT NULL,
  next_no     INT DEFAULT 1,
  INDEX (tenant_id, firm_id, doc_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS settings (
  id        VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  firm_id   VARCHAR(36),
  scope     VARCHAR(100) NOT NULL,
  data      MEDIUMTEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY (tenant_id, firm_id, scope)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS invoice_templates (
  id             VARCHAR(36) PRIMARY KEY,
  tenant_id      VARCHAR(36) NOT NULL,
  firm_id        VARCHAR(36),
  name           VARCHAR(100),
  doc_type       VARCHAR(50) DEFAULT 'invoice',
  layout         VARCHAR(20) DEFAULT 'a4',
  theme_color    VARCHAR(20) DEFAULT '#1a56db',
  show_logo      TINYINT DEFAULT 1,
  show_signature TINYINT DEFAULT 0,
  header_note    TEXT,
  footer_note    TEXT,
  terms          TEXT,
  is_default     TINYINT DEFAULT 0,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Sales ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sale_documents (
  id             VARCHAR(36) PRIMARY KEY,
  tenant_id      VARCHAR(36) NOT NULL,
  firm_id        VARCHAR(36),
  store_id       VARCHAR(36),
  terminal_id    VARCHAR(36),
  doc_type       ENUM('invoice','pos','estimate','proforma','sale_order','delivery_challan','credit_note') DEFAULT 'invoice',
  doc_no         VARCHAR(50),
  doc_date       DATE,
  due_date       DATE,
  party_id       VARCHAR(36),
  state_of_supply VARCHAR(100),
  ref_no         VARCHAR(100),
  orig_doc_id    VARCHAR(36),
  price_type     VARCHAR(20) DEFAULT 'retail',
  sub_total      DECIMAL(15,4) DEFAULT 0,
  discount_amt   DECIMAL(15,4) DEFAULT 0,
  tax_amt        DECIMAL(15,4) DEFAULT 0,
  other_charges  DECIMAL(15,4) DEFAULT 0,
  round_off      DECIMAL(15,4) DEFAULT 0,
  total          DECIMAL(15,4) DEFAULT 0,
  paid_amt       DECIMAL(15,4) DEFAULT 0,
  balance_amt    DECIMAL(15,4) DEFAULT 0,
  status         ENUM('open','partial','paid','cancelled','converted') DEFAULT 'open',
  notes          TEXT,
  terms          TEXT,
  created_by     VARCHAR(36),
  deleted_at     DATETIME,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  version        INT DEFAULT 1,
  sync_state     VARCHAR(20) DEFAULT 'synced',
  UNIQUE KEY (tenant_id, firm_id, doc_type, doc_no),
  INDEX (tenant_id, doc_date),
  INDEX (tenant_id, party_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sale_document_items (
  id            VARCHAR(36) PRIMARY KEY,
  tenant_id     VARCHAR(36) NOT NULL,
  document_id   VARCHAR(36) NOT NULL,
  item_id       VARCHAR(36),
  item_name     VARCHAR(200),
  hsn_sac       VARCHAR(20),
  description   TEXT,
  qty           DECIMAL(15,4) DEFAULT 1,
  unit          VARCHAR(30),
  price_unit    DECIMAL(15,4) DEFAULT 0,
  price_tax_incl TINYINT DEFAULT 0,
  discount_pct  DECIMAL(8,4) DEFAULT 0,
  discount_amt  DECIMAL(15,4) DEFAULT 0,
  tax_pct       DECIMAL(8,4) DEFAULT 0,
  tax_amt       DECIMAL(15,4) DEFAULT 0,
  cgst          DECIMAL(15,4) DEFAULT 0,
  sgst          DECIMAL(15,4) DEFAULT 0,
  igst          DECIMAL(15,4) DEFAULT 0,
  cess          DECIMAL(15,4) DEFAULT 0,
  line_total    DECIMAL(15,4) DEFAULT 0,
  cost_rate     DECIMAL(15,4),
  INDEX (document_id),
  INDEX (tenant_id, item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Purchases ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS purchase_documents (
  id           VARCHAR(36) PRIMARY KEY,
  tenant_id    VARCHAR(36) NOT NULL,
  firm_id      VARCHAR(36),
  doc_type     ENUM('purchase','purchase_return','purchase_order') DEFAULT 'purchase',
  doc_no       VARCHAR(50),
  doc_date     DATE,
  party_id     VARCHAR(36),
  grn_no       VARCHAR(100),
  sub_total    DECIMAL(15,4) DEFAULT 0,
  discount_amt DECIMAL(15,4) DEFAULT 0,
  tax_amt      DECIMAL(15,4) DEFAULT 0,
  round_off    DECIMAL(15,4) DEFAULT 0,
  total        DECIMAL(15,4) DEFAULT 0,
  paid_amt     DECIMAL(15,4) DEFAULT 0,
  balance_amt  DECIMAL(15,4) DEFAULT 0,
  status       ENUM('open','partial','paid','cancelled') DEFAULT 'open',
  deleted_at   DATETIME,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  version      INT DEFAULT 1,
  sync_state   VARCHAR(20) DEFAULT 'synced',
  INDEX (tenant_id, doc_date),
  INDEX (tenant_id, party_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS purchase_document_items (
  id           VARCHAR(36) PRIMARY KEY,
  tenant_id    VARCHAR(36) NOT NULL,
  document_id  VARCHAR(36) NOT NULL,
  item_id      VARCHAR(36),
  item_name    VARCHAR(200),
  hsn_sac      VARCHAR(20),
  qty          DECIMAL(15,4) DEFAULT 1,
  unit         VARCHAR(30),
  price_unit   DECIMAL(15,4) DEFAULT 0,
  discount_amt DECIMAL(15,4) DEFAULT 0,
  tax_pct      DECIMAL(8,4) DEFAULT 0,
  tax_amt      DECIMAL(15,4) DEFAULT 0,
  line_total   DECIMAL(15,4) DEFAULT 0,
  mrp          DECIMAL(15,4),
  sale_price   DECIMAL(15,4),
  INDEX (document_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS purchase_orders (
  id         VARCHAR(36) PRIMARY KEY,
  tenant_id  VARCHAR(36) NOT NULL,
  firm_id    VARCHAR(36),
  po_no      VARCHAR(50),
  po_date    DATE,
  due_date   DATE,
  party_id   VARCHAR(36),
  status     ENUM('draft','sent','received','cancelled') DEFAULT 'draft',
  total      DECIMAL(15,4) DEFAULT 0,
  items      JSON,
  deleted_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  version    INT DEFAULT 1,
  INDEX (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Payments ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payments (
  id         VARCHAR(36) PRIMARY KEY,
  tenant_id  VARCHAR(36) NOT NULL,
  firm_id    VARCHAR(36),
  party_id   VARCHAR(36),
  direction  ENUM('in','out') NOT NULL,
  doc_id     VARCHAR(36),
  doc_type   VARCHAR(50),
  pay_mode   ENUM('cash','bank','upi','card','cheque','credit') DEFAULT 'cash',
  amount     DECIMAL(15,4) NOT NULL,
  pay_date   DATE,
  reference  VARCHAR(100),
  bank_id    VARCHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  version    INT DEFAULT 1,
  sync_state VARCHAR(20) DEFAULT 'synced',
  INDEX (tenant_id, pay_date),
  INDEX (tenant_id, party_id),
  INDEX (doc_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Expenses ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS expenses (
  id         VARCHAR(36) PRIMARY KEY,
  tenant_id  VARCHAR(36) NOT NULL,
  firm_id    VARCHAR(36),
  category   VARCHAR(100),
  amount     DECIMAL(15,4) NOT NULL,
  tax_amt    DECIMAL(15,4) DEFAULT 0,
  exp_date   DATE,
  party_id   VARCHAR(36),
  pay_mode   VARCHAR(30),
  notes      TEXT,
  deleted_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  version    INT DEFAULT 1,
  INDEX (tenant_id, exp_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Accounting ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS banks (
  id              VARCHAR(36) PRIMARY KEY,
  tenant_id       VARCHAR(36) NOT NULL,
  firm_id         VARCHAR(36),
  account_no      VARCHAR(50),
  account_name    VARCHAR(150),
  bank_name       VARCHAR(150),
  branch          VARCHAR(150),
  ifsc            VARCHAR(20),
  opening_balance DECIMAL(15,4) DEFAULT 0,
  remarks         TEXT,
  deleted_at      DATETIME,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  version         INT DEFAULT 1,
  INDEX (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cheques (
  id         VARCHAR(36) PRIMARY KEY,
  tenant_id  VARCHAR(36) NOT NULL,
  bank_id    VARCHAR(36),
  party_id   VARCHAR(36),
  cheque_no  VARCHAR(50),
  amount     DECIMAL(15,4) NOT NULL,
  direction  ENUM('in','out') NOT NULL,
  status     ENUM('open','cleared','bounced','cancelled') DEFAULT 'open',
  due_date   DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vouchers (
  id           VARCHAR(36) PRIMARY KEY,
  tenant_id    VARCHAR(36) NOT NULL,
  firm_id      VARCHAR(36),
  voucher_type VARCHAR(50),
  voucher_no   VARCHAR(50),
  voucher_date DATE,
  narration    TEXT,
  amount       DECIMAL(15,4),
  deleted_at   DATETIME,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  version      INT DEFAULT 1,
  INDEX (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── HR / Staff ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS staff (
  id          VARCHAR(36) PRIMARY KEY,
  tenant_id   VARCHAR(36) NOT NULL,
  firm_id     VARCHAR(36),
  name        VARCHAR(150) NOT NULL,
  designation VARCHAR(100),
  department  VARCHAR(100),
  gender      VARCHAR(20),
  blood_group VARCHAR(5),
  national_id VARCHAR(50),
  dob         DATE,
  doj         DATE,
  nationality VARCHAR(50),
  photo_url   TEXT,
  phone       VARCHAR(20),
  user_id     VARCHAR(36),
  deleted_at  DATETIME,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  version     INT DEFAULT 1,
  INDEX (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS staff_profiles (
  id        VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  staff_id  VARCHAR(36) NOT NULL UNIQUE,
  salary    DECIMAL(15,4),
  bank_acc  VARCHAR(100),
  address   TEXT,
  emergency_contact VARCHAR(100),
  INDEX (staff_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Loyalty ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS loyalty_rules (
  id                     VARCHAR(36) PRIMARY KEY,
  tenant_id              VARCHAR(36) NOT NULL,
  firm_id                VARCHAR(36),
  name                   VARCHAR(100) DEFAULT 'Default',
  earn_points_per_rupee  DECIMAL(10,4) DEFAULT 1,
  redeem_value_per_point DECIMAL(10,4) DEFAULT 0.5,
  min_purchase           DECIMAL(15,4) DEFAULT 0,
  is_active              TINYINT DEFAULT 1,
  INDEX (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id               VARCHAR(36) PRIMARY KEY,
  tenant_id        VARCHAR(36) NOT NULL,
  party_id         VARCHAR(36),
  points           DECIMAL(10,2) NOT NULL,
  transaction_type ENUM('earn','redeem','expire','adjust') DEFAULT 'earn',
  doc_id           VARCHAR(36),
  note             VARCHAR(200),
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX (tenant_id, party_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Online Store ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS online_store_settings (
  id              VARCHAR(36) PRIMARY KEY,
  tenant_id       VARCHAR(36) NOT NULL,
  firm_id         VARCHAR(36),
  store_live      TINYINT DEFAULT 0,
  accept_orders   TINYINT DEFAULT 1,
  store_name      VARCHAR(150),
  store_url       VARCHAR(200),
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY (tenant_id, firm_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS online_store_orders (
  id           VARCHAR(36) PRIMARY KEY,
  tenant_id    VARCHAR(36) NOT NULL,
  firm_id      VARCHAR(36),
  order_no     VARCHAR(50),
  customer_name VARCHAR(150),
  customer_phone VARCHAR(20),
  customer_email VARCHAR(150),
  address      TEXT,
  items        JSON,
  total        DECIMAL(15,4),
  status       ENUM('pending','confirmed','shipped','delivered','cancelled') DEFAULT 'pending',
  notes        TEXT,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
