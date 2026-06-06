import { getDb } from './db.js';
import bcrypt from 'bcryptjs';

const now = () => new Date().toISOString();

function seed() {
  const db = getDb();

  // plans
  const plans = [
    { id: crypto.randomUUID(), code: 'free', name: 'Free', price_amount: 0, billing_cycle: 'none', entitlements: JSON.stringify({ max_items: 50, max_users: 1, online_store: false, gst: false }) },
    { id: crypto.randomUUID(), code: 'trial', name: 'Trial', price_amount: 0, billing_cycle: 'none', entitlements: JSON.stringify({ max_items: 500, max_users: 5, online_store: true, gst: true }) },
    { id: crypto.randomUUID(), code: 'premium', name: 'Premium', price_amount: 999, billing_cycle: 'monthly', entitlements: JSON.stringify({ max_items: -1, max_users: -1, online_store: true, gst: true }) },
  ];
  const ins_plan = db.prepare(`INSERT OR IGNORE INTO plans(id,code,name,price_amount,billing_cycle,entitlements,is_active,created_at,updated_at) VALUES(?,?,?,?,?,?,1,?,?)`);
  for (const p of plans) ins_plan.run(p.id, p.code, p.name, p.price_amount, p.billing_cycle, p.entitlements, now(), now());

  // demo tenant
  const tenantId = '018e2c00-0000-7000-8000-000000000001';
  db.prepare(`INSERT OR IGNORE INTO tenants(id,name,slug,status,deployment,created_at,updated_at) VALUES(?,?,?,?,?,?,?)`
  ).run(tenantId, 'Demo Retail', 'demo', 'active', 'local', now(), now());

  const trialPlanId = plans.find(p => p.code === 'trial').id;
  const subId = crypto.randomUUID();
  db.prepare(`INSERT OR IGNORE INTO subscriptions(id,tenant_id,plan_id,status,trial_ends_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?)`
  ).run(subId, tenantId, trialPlanId, 'trialing', new Date(Date.now() + 30*86400*1000).toISOString(), now(), now());

  // firm
  const firmId = '018e2c00-0000-7000-8000-000000000002';
  db.prepare(`INSERT OR IGNORE INTO firms(id,tenant_id,name,gstin,state,state_code,phone,email,currency,decimals,fy_start_month,created_at,updated_at,version) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,1)`
  ).run(firmId, tenantId, 'Demo Retail Store', '27AABCT1332L1Z5', 'Maharashtra', '27', '9876543210', 'demo@retailone.app', 'INR', 2, 4, now(), now());

  // store
  const storeId = crypto.randomUUID();
  db.prepare(`INSERT OR IGNORE INTO stores(id,tenant_id,firm_id,name,address,created_at,updated_at,version) VALUES(?,?,?,?,?,?,?,1)`
  ).run(storeId, tenantId, firmId, 'Main Store', '123 Market Road, Mumbai', now(), now());

  // terminal
  const terminalId = crypto.randomUUID();
  db.prepare(`INSERT OR IGNORE INTO terminals(id,tenant_id,store_id,name,doc_prefix,created_at,updated_at) VALUES(?,?,?,?,?,?,?)`
  ).run(terminalId, tenantId, storeId, 'POS Terminal 1', 'INV', now(), now());

  // roles
  const ownerRoleId = crypto.randomUUID();
  const cashierRoleId = crypto.randomUUID();
  const modules = ['items', 'parties', 'sales', 'purchase', 'reports', 'settings', 'accounting', 'hr', 'loyalty'];

  db.prepare(`INSERT OR IGNORE INTO roles(id,tenant_id,name,is_system) VALUES(?,?,?,1)`).run(ownerRoleId, tenantId, 'Owner');
  db.prepare(`INSERT OR IGNORE INTO roles(id,tenant_id,name,is_system) VALUES(?,?,?,1)`).run(cashierRoleId, tenantId, 'Cashier');

  const insRp = db.prepare(`INSERT OR IGNORE INTO role_permissions(id,tenant_id,role_id,module,can_view,can_create,can_edit,can_share,can_delete) VALUES(?,?,?,?,?,?,?,?,?)`);
  for (const m of modules) {
    insRp.run(crypto.randomUUID(), tenantId, ownerRoleId, m, 1, 1, 1, 1, 1);
    insRp.run(crypto.randomUUID(), tenantId, cashierRoleId, m, m === 'sales' ? 1 : 0, m === 'sales' ? 1 : 0, 0, 0, 0);
  }

  // admin user
  const userId = crypto.randomUUID();
  const hash = bcrypt.hashSync('demo1234', 10);
  db.prepare(`INSERT OR IGNORE INTO users(id,tenant_id,name,email,password_hash,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)`
  ).run(userId, tenantId, 'Admin User', 'admin@retailone.app', hash, 'active', now(), now());
  db.prepare(`INSERT OR IGNORE INTO user_roles(id,tenant_id,user_id,role_id) VALUES(?,?,?,?)`
  ).run(crypto.randomUUID(), tenantId, userId, ownerRoleId);

  // ── Units ──────────────────────────────────────────────────
  const unitsData = [
    { name: 'Piece',      abbr: 'pcs'  },
    { name: 'Kilogram',   abbr: 'kg'   },
    { name: 'Gram',       abbr: 'g'    },
    { name: 'Litre',      abbr: 'ltr'  },
    { name: 'Millilitre', abbr: 'ml'   },
    { name: 'Metre',      abbr: 'm'    },
    { name: 'Box',        abbr: 'box'  },
    { name: 'Dozen',      abbr: 'dz'   },
    { name: 'Bag',        abbr: 'bag'  },
    { name: 'Bottle',     abbr: 'btl'  },
    { name: 'Pack',       abbr: 'pck'  },
    { name: 'Pair',       abbr: 'pr'   },
    { name: 'Set',        abbr: 'set'  },
    { name: 'Roll',       abbr: 'roll' },
    { name: 'Quintal',    abbr: 'qtl'  },
  ];
  const unitIds = {};
  const insUnit = db.prepare(`INSERT OR IGNORE INTO units(id,tenant_id,name,short_name,created_at,updated_at,version) VALUES(?,?,?,?,?,?,1)`);
  for (const u of unitsData) {
    const uid = crypto.randomUUID();
    insUnit.run(uid, tenantId, u.name, u.abbr, now(), now());
    unitIds[u.abbr] = uid;
  }
  const unitId = unitIds['pcs']; // default unit for sample items

  // ── Categories ─────────────────────────────────────────────
  const catsData = [
    'Groceries & Staples',
    'Beverages',
    'Dairy & Eggs',
    'Snacks & Bakery',
    'Personal Care',
    'Household & Cleaning',
    'Electronics & Accessories',
    'Clothing & Apparel',
    'Medicines & Health',
    'Stationery & Office',
    'Fruits & Vegetables',
    'Frozen & Chilled',
    'Baby Products',
    'General',
  ];
  const catIds = {};
  const insCat = db.prepare(`INSERT OR IGNORE INTO categories(id,tenant_id,name,created_at,updated_at,version) VALUES(?,?,?,?,?,1)`);
  for (const c of catsData) {
    const cid = crypto.randomUUID();
    insCat.run(cid, tenantId, c, now(), now());
    catIds[c] = cid;
  }
  const catId = catIds['Groceries & Staples']; // default for sample items

  // ── Tax Rates ──────────────────────────────────────────────
  const taxData = [
    { name: 'Exempt (0%)',  rate: 0,  cgst: 0,   sgst: 0,   igst: 0   },
    { name: 'GST 3%',       rate: 3,  cgst: 1.5, sgst: 1.5, igst: 3   },
    { name: 'GST 5%',       rate: 5,  cgst: 2.5, sgst: 2.5, igst: 5   },
    { name: 'GST 12%',      rate: 12, cgst: 6,   sgst: 6,   igst: 12  },
    { name: 'GST 18%',      rate: 18, cgst: 9,   sgst: 9,   igst: 18  },
    { name: 'GST 28%',      rate: 28, cgst: 14,  sgst: 14,  igst: 28  },
  ];
  const taxIds = {};
  const insTax = db.prepare(`INSERT OR IGNORE INTO tax_rates(id,tenant_id,name,rate,cgst_rate,sgst_rate,igst_rate,created_at,updated_at,version) VALUES(?,?,?,?,?,?,?,?,?,1)`);
  for (const t of taxData) {
    const tid = crypto.randomUUID();
    insTax.run(tid, tenantId, t.name, t.rate, t.cgst, t.sgst, t.igst, now(), now());
    taxIds[t.rate] = tid;
  }
  const taxId = taxIds[5]; // default GST 5% for groceries

  // ── Sample Items ──────────────────────────────────────────
  // HSN codes are standard Indian tariff codes used for GST filing
  // SAC codes apply to services (e.g., SAC 9963 = food service)
  const sampleItems = [
    // Groceries — GST 5%
    { name: 'Rice (1kg)',         sku: 'RICE001',   hsn: '1006', catKey: 'Groceries & Staples', unitKey: 'kg',  taxRate: 5,  sale: 60,  purchase: 50,  mrp: 65,  qty: 200 },
    { name: 'Sugar (1kg)',        sku: 'SUG001',    hsn: '1701', catKey: 'Groceries & Staples', unitKey: 'kg',  taxRate: 5,  sale: 45,  purchase: 38,  mrp: 50,  qty: 150 },
    { name: 'Wheat Flour (1kg)',  sku: 'FLOUR001',  hsn: '1101', catKey: 'Groceries & Staples', unitKey: 'kg',  taxRate: 0,  sale: 40,  purchase: 34,  mrp: 45,  qty: 180 },
    { name: 'Salt (1kg)',         sku: 'SALT001',   hsn: '2501', catKey: 'Groceries & Staples', unitKey: 'kg',  taxRate: 0,  sale: 20,  purchase: 15,  mrp: 22,  qty: 100 },
    { name: 'Turmeric Powder',    sku: 'TUR001',    hsn: '0910', catKey: 'Groceries & Staples', unitKey: 'pcs', taxRate: 5,  sale: 55,  purchase: 42,  mrp: 60,  qty: 80  },
    // Edible Oil — GST 5%
    { name: 'Sunflower Oil (1L)', sku: 'OIL001',   hsn: '1512', catKey: 'Groceries & Staples', unitKey: 'ltr', taxRate: 5,  sale: 140, purchase: 120, mrp: 150, qty: 60  },
    { name: 'Mustard Oil (1L)',   sku: 'OIL002',   hsn: '1514', catKey: 'Groceries & Staples', unitKey: 'ltr', taxRate: 5,  sale: 130, purchase: 110, mrp: 140, qty: 50  },
    // Dairy — GST 0% / 5%
    { name: 'Full Cream Milk (1L)', sku: 'MILK001', hsn: '0401', catKey: 'Dairy & Eggs',       unitKey: 'ltr', taxRate: 0,  sale: 58,  purchase: 48,  mrp: 62,  qty: 100 },
    { name: 'Butter (100g)',       sku: 'BUT001',   hsn: '0405', catKey: 'Dairy & Eggs',       unitKey: 'pcs', taxRate: 5,  sale: 55,  purchase: 45,  mrp: 60,  qty: 50  },
    { name: 'Paneer (200g)',       sku: 'PAN001',   hsn: '0406', catKey: 'Dairy & Eggs',       unitKey: 'pcs', taxRate: 5,  sale: 80,  purchase: 65,  mrp: 85,  qty: 40  },
    // Beverages — GST 12%/18%
    { name: 'Tea (250g)',          sku: 'TEA001',   hsn: '0902', catKey: 'Beverages',           unitKey: 'pcs', taxRate: 5,  sale: 90,  purchase: 72,  mrp: 95,  qty: 60  },
    { name: 'Coffee Powder (100g)',sku: 'COF001',   hsn: '0901', catKey: 'Beverages',           unitKey: 'pcs', taxRate: 5,  sale: 70,  purchase: 55,  mrp: 75,  qty: 40  },
    { name: 'Cola Drink (600ml)',  sku: 'COLA001',  hsn: '2202', catKey: 'Beverages',           unitKey: 'btl', taxRate: 28, sale: 40,  purchase: 30,  mrp: 45,  qty: 120 },
    { name: 'Mineral Water (1L)',  sku: 'WAT001',   hsn: '2201', catKey: 'Beverages',           unitKey: 'btl', taxRate: 18, sale: 20,  purchase: 14,  mrp: 20,  qty: 200 },
    // Snacks — GST 12%
    { name: 'Potato Chips (50g)', sku: 'CHIPS001', hsn: '1905', catKey: 'Snacks & Bakery',     unitKey: 'pcs', taxRate: 12, sale: 20,  purchase: 14,  mrp: 20,  qty: 100 },
    { name: 'Biscuits (100g)',    sku: 'BISC001',  hsn: '1905', catKey: 'Snacks & Bakery',     unitKey: 'pcs', taxRate: 5,  sale: 25,  purchase: 18,  mrp: 30,  qty: 80  },
    // Personal Care — GST 18%
    { name: 'Shampoo (200ml)',    sku: 'SHAM001',  hsn: '3305', catKey: 'Personal Care',       unitKey: 'btl', taxRate: 18, sale: 130, purchase: 95,  mrp: 150, qty: 50  },
    { name: 'Soap (100g)',        sku: 'SOAP001',  hsn: '3401', catKey: 'Personal Care',       unitKey: 'pcs', taxRate: 18, sale: 35,  purchase: 24,  mrp: 40,  qty: 100 },
    { name: 'Toothpaste (100g)',  sku: 'TPASTE01', hsn: '3306', catKey: 'Personal Care',       unitKey: 'pcs', taxRate: 12, sale: 80,  purchase: 58,  mrp: 90,  qty: 60  },
    // Household — GST 18%
    { name: 'Detergent Powder (1kg)', sku: 'DET001', hsn: '3402', catKey: 'Household & Cleaning', unitKey: 'pcs', taxRate: 18, sale: 90, purchase: 68, mrp: 100, qty: 60 },
  ];

  for (const si of sampleItems) {
    const itemId = crypto.randomUUID();
    const itemCatId = catIds[si.catKey] || catId;
    const itemUnitId = unitIds[si.unitKey] || unitId;
    const itemTaxId = taxIds[si.taxRate] || taxIds[5];
    db.prepare(`INSERT OR IGNORE INTO items(id,tenant_id,name,sku,hsn_sac,category_id,unit_id,tax_rate_id,type,track_inventory,opening_stock,created_at,updated_at,version,sync_state) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,1,'synced')`
    ).run(itemId, tenantId, si.name, si.sku, si.hsn, itemCatId, itemUnitId, itemTaxId, 'product', 1, si.qty, now(), now());

    const priceId = crypto.randomUUID();
    db.prepare(`INSERT OR IGNORE INTO item_prices(id,tenant_id,item_id,sale_price,purchase_price,mrp,created_at,updated_at,version) VALUES(?,?,?,?,?,?,?,?,1)`
    ).run(priceId, tenantId, itemId, si.sale, si.purchase, si.mrp, now(), now());

    // opening stock movement
    db.prepare(`INSERT INTO stock_movements(id,tenant_id,item_id,store_id,movement_type,qty,rate,moved_at,created_at,updated_at,version,sync_state) VALUES(?,?,?,?,?,?,?,?,?,?,1,'synced')`
    ).run(crypto.randomUUID(), tenantId, itemId, storeId, 'opening', si.qty, si.purchase, now(), now(), now());
  }

  // sample parties
  const partyData = [
    { name: 'Walk-in Customer', role: 'customer', phone: null },
    { name: 'Rajesh Traders', role: 'supplier', phone: '9123456789', gstin: '27AABCT1332L1Z5' },
    { name: 'Priya Stores', role: 'customer', phone: '9876543210' },
  ];
  for (const p of partyData) {
    const pid = crypto.randomUUID();
    db.prepare(`INSERT OR IGNORE INTO parties(id,tenant_id,role,name,phone,gstin,created_at,updated_at,version,sync_state) VALUES(?,?,?,?,?,?,?,?,1,'synced')`
    ).run(pid, tenantId, p.role, p.name, p.phone || null, p.gstin || null, now(), now());
    db.prepare(`INSERT OR IGNORE INTO party_balances(id,tenant_id,party_id,receivable,payable,points,updated_at) VALUES(?,?,?,0,0,0,?)`
    ).run(crypto.randomUUID(), tenantId, pid, now());
  }

  // document sequences
  db.prepare(`INSERT OR IGNORE INTO document_sequences(id,tenant_id,firm_id,terminal_id,doc_type,prefix,next_no) VALUES(?,?,?,?,?,?,1)`
  ).run(crypto.randomUUID(), tenantId, firmId, terminalId, 'invoice', 'INV-');
  db.prepare(`INSERT OR IGNORE INTO document_sequences(id,tenant_id,firm_id,terminal_id,doc_type,prefix,next_no) VALUES(?,?,?,?,?,?,1)`
  ).run(crypto.randomUUID(), tenantId, firmId, terminalId, 'purchase', 'PUR-');
  db.prepare(`INSERT OR IGNORE INTO document_sequences(id,tenant_id,firm_id,terminal_id,doc_type,prefix,next_no) VALUES(?,?,?,?,?,?,1)`
  ).run(crypto.randomUUID(), tenantId, firmId, terminalId, 'estimate', 'EST-');

  // default invoice template
  db.prepare(`INSERT OR IGNORE INTO invoice_templates(id,tenant_id,firm_id,name,doc_type,layout,theme_color,show_logo,is_default,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`
  ).run(crypto.randomUUID(), tenantId, firmId, 'Default A4', 'invoice', 'a4', '#1a56db', 1, 1, now(), now());

  // loyalty rule
  db.prepare(`INSERT OR IGNORE INTO loyalty_rules(id,tenant_id,firm_id,earn_per_amount,redeem_value,is_active) VALUES(?,?,?,?,?,1)`
  ).run(crypto.randomUUID(), tenantId, firmId, 100, 1);

  // demo bank
  db.prepare(`INSERT OR IGNORE INTO banks(id,tenant_id,firm_id,account_name,bank_name,opening_balance,created_at,updated_at,version) VALUES(?,?,?,?,?,?,?,?,1)`
  ).run(crypto.randomUUID(), tenantId, firmId, 'Main Account', 'SBI', 50000, now(), now());

  // online store settings
  db.prepare(`INSERT OR IGNORE INTO store_settings(id,tenant_id,firm_id,slug,title,theme,is_enabled,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)`
  ).run(crypto.randomUUID(), tenantId, firmId, 'demo', 'Demo Retail Store', 'default', 1, now(), now());

  console.log('âœ… Seed data inserted.');
  console.log('   Login: admin@retailone.app / demo1234');
  console.log('   Tenant slug: demo');
}

seed();

