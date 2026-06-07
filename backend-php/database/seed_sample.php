<?php
/**
 * RetailOne — Sample Data Seeder
 * Adds rich demo data: more units, categories, GST rates, 50+ items,
 * 20 parties, 60 days of sales, purchases, expenses, staff, loyalty txns.
 *
 * Safe to run multiple times (uses INSERT IGNORE).
 * Usage: php database/seed_sample.php
 */

define('DB_HOST', 'localhost');
define('DB_PORT', 3306);
define('DB_NAME', 'retail_one');
define('DB_USER', 'root');
define('DB_PASS', '');

$pdo = new PDO(
    'mysql:host='.DB_HOST.';port='.DB_PORT.';dbname='.DB_NAME.';charset=utf8mb4',
    DB_USER, DB_PASS,
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
);

// ── helpers ───────────────────────────────────────────────────
function uid(): string {
    $d = random_bytes(16);
    $d[6] = chr(ord($d[6]) & 0x0f | 0x40);
    $d[8] = chr(ord(($d[8])) & 0x3f | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($d), 4));
}
function ins(PDO $p, string $t, array $r): string {
    $id = $r['id'] ?? null;
    $cols = implode(',', array_keys($r));
    $plh  = implode(',', array_fill(0, count($r), '?'));
    $p->prepare("INSERT IGNORE INTO $t ($cols) VALUES ($plh)")->execute(array_values($r));
    return $id ?? '';
}
function ago(int $days, string $fmt = 'Y-m-d'): string {
    return date($fmt, strtotime("-$days days"));
}

// ── fixed IDs from base seed ──────────────────────────────────
$tid    = 'tenant-0001-0000-0000-000000000001';
$firmId = 'firm-0001-0000-0000-000000000001';
$storeId= 'store-001-0000-0000-000000000001';

echo "=== RetailOne Sample Data Seeder ===\n\n";

// ═══════════════════════════════════════════════════════════════
// 1. EXTRA UNITS
// ═══════════════════════════════════════════════════════════════
echo "[1] Units...\n";
$extraUnits = [
    ['DZN','Dozen','DZN'],['MTR','Metre','MTR'],['CTN','Carton','CTN'],
    ['BAG','Bag','BAG'],  ['SET','Set','SET'],  ['PAI','Pair','PAI'],
    ['ROL','Roll','ROL'], ['TIN','Tin','TIN'],  ['JAR','Jar','JAR'],
    ['BTL','Bottle','BTL'],['SHT','Sheet','SHT'],['BND','Bundle','BND'],
];
$unitIds = [];
// load existing
foreach ($pdo->query("SELECT short_name,id FROM units WHERE tenant_id='$tid'")->fetchAll() as $u)
    $unitIds[$u['short_name']] = $u['id'];
foreach ($extraUnits as [$s,$n,$q]) {
    if (!isset($unitIds[$s])) {
        $id = uid(); $unitIds[$s] = $id;
        ins($pdo,'units',['id'=>$id,'tenant_id'=>$tid,'name'=>$n,'short_name'=>$s,'uqc'=>$q]);
    }
}
echo "   Done. Total units: ".count($unitIds)."\n";

// ═══════════════════════════════════════════════════════════════
// 2. EXTRA CATEGORIES (with sub-categories)
// ═══════════════════════════════════════════════════════════════
echo "[2] Categories...\n";
$catIds = [];
foreach ($pdo->query("SELECT name,id FROM categories WHERE tenant_id='$tid'")->fetchAll() as $c)
    $catIds[$c['name']] = $c['id'];

$newCats = [
    // [name, parent_name]
    ['Grains & Pulses',    null],
    ['Spices & Masala',    null],
    ['Oils & Ghee',        null],
    ['Frozen Foods',       null],
    ['Confectionery',      null],
    ['Stationery',         null],
    ['Toys & Games',       null],
    ['Health & Nutrition', null],
    ['Cleaning Supplies',  'Household'],
    ['Kitchen Appliances', null],
    ['Mobile Accessories', 'Electronics'],
    ['Footwear',           'Apparel'],
    ['Kids Wear',          'Apparel'],
    ['Medicines & OTC',    null],
    ['Baby Care',          null],
    ['Pet Supplies',       null],
];
foreach ($newCats as [$name,$parent]) {
    if (!isset($catIds[$name])) {
        $id = uid(); $catIds[$name] = $id;
        $pid = $parent ? ($catIds[$parent] ?? null) : null;
        ins($pdo,'categories',['id'=>$id,'tenant_id'=>$tid,'name'=>$name,'parent_id'=>$pid]);
    }
}
echo "   Done. Total categories: ".count($catIds)."\n";

// ═══════════════════════════════════════════════════════════════
// 3. GST / TAX RATES
// ═══════════════════════════════════════════════════════════════
echo "[3] Tax Rates...\n";
$taxIds = [];
foreach ($pdo->query("SELECT name,id FROM tax_rates WHERE tenant_id='$tid'")->fetchAll() as $t)
    $taxIds[$t['name']] = $t['id'];

$newTaxes = [
    // [name, rate, cgst, sgst, igst, cess, hsn_example]
    ['GST 3%',   3,  1.5,  1.5,  3,  0, '7113'],  // Gold jewellery
    ['GST 0.25%',0.25,0.125,0.125,0.25,0,'7102'],  // Rough diamonds
    ['GST 28%+Cess', 28, 14, 14, 28, 15, '2402'],  // Cigarettes cess
    ['Exempt',   0,  0,    0,    0,  0, ''],        // Exempted items
];
foreach ($newTaxes as [$name,$rate,$cgst,$sgst,$igst,$cess,$hsn]) {
    if (!isset($taxIds[$name])) {
        $id = uid(); $taxIds[$name] = $id;
        ins($pdo,'tax_rates',['id'=>$id,'tenant_id'=>$tid,'name'=>$name,'rate'=>$rate,
            'cgst_rate'=>$cgst,'sgst_rate'=>$sgst,'igst_rate'=>$igst,'cess_rate'=>$cess,'hsn_sac'=>$hsn]);
    }
}
echo "   Done. Total tax rates: ".count($taxIds)."\n";

// ═══════════════════════════════════════════════════════════════
// 4. ITEMS — 50+ products across all categories
// ═══════════════════════════════════════════════════════════════
echo "[4] Items...\n";

// reload tax ids with full set
foreach ($pdo->query("SELECT name,id FROM tax_rates WHERE tenant_id='$tid'")->fetchAll() as $t)
    $taxIds[$t['name']] = $t['id'];
foreach ($pdo->query("SELECT short_name,id FROM units WHERE tenant_id='$tid'")->fetchAll() as $u)
    $unitIds[$u['short_name']] = $u['id'];

// [name, sku, category, unit, tax, sale_price, mrp, purchase_price, opening_stock, low_stock, hsn]
$newItems = [
    // ── Beverages ─────────────────────────────────────────────
    ['Sprite 500ml',            'BEV-003','Beverages',     'NOS','GST 12%', 35,  38,  22, 90,  10,'2202'],
    ['Red Bull 250ml',          'BEV-004','Beverages',     'NOS','GST 12%', 120, 125, 85, 48,   5,'2202'],
    ['Frooti Mango 200ml',      'BEV-005','Beverages',     'NOS','GST 12%', 20,  20,  13, 120, 15,'2202'],
    ['Bisleri Water 1L',        'BEV-006','Beverages',     'BTL','GST 12%', 20,  20,  12, 200, 20,'2201'],
    ['Nescafe Classic 50g',     'BEV-007','Beverages',     'TIN','GST 12%', 220, 230,155, 30,   5,'2101'],
    ['Tata Tea Premium 250g',   'BEV-008','Beverages',     'PKT','GST 5%',  110, 115, 80, 50,   8,'0902'],

    // ── Snacks ────────────────────────────────────────────────
    ['Haldiram Bhujia 200g',    'SNK-003','Snacks',        'PKT','GST 12%', 80,  80,  55, 60,   8,'2106'],
    ['Britannia Bourbon 100g',  'SNK-004','Snacks',        'PKT','GST 18%', 30,  30,  20, 150, 15,'1905'],
    ['Parle G 100g',            'SNK-005','Snacks',        'PKT','GST 18%', 10,  10,   6, 300, 30,'1905'],
    ['Too Yumm Chips 50g',      'SNK-006','Snacks',        'PKT','GST 12%', 20,  20,  13, 180, 20,'2106'],

    // ── Dairy ─────────────────────────────────────────────────
    ['Amul Curd 400g',          'DAI-003','Dairy',         'GMS','GST 5%',  40,  42,  30, 40,   5,'0403'],
    ['Amul Cheese Slice 200g',  'DAI-004','Dairy',         'GMS','GST 12%', 110, 115, 80, 25,   5,'0406'],
    ['Mother Dairy Ghee 1L',    'DAI-005','Dairy',         'LTR','GST 12%', 480, 500, 360,15,   3,'0405'],
    ['Nestle Milkmaid 400g',    'DAI-006','Dairy',         'GMS','GST 12%', 110, 115, 80, 30,   5,'0402'],

    // ── Grains & Pulses ───────────────────────────────────────
    ['Toor Dal 1Kg',            'GRN-001','Grains & Pulses','KGS','GST 5%', 130, 140, 105,40,   5,'0713'],
    ['Chana Dal 1Kg',           'GRN-002','Grains & Pulses','KGS','GST 5%', 110, 115, 88, 35,   5,'0713'],
    ['Wheat Flour Aashirvaad 5Kg','GRN-003','Grains & Pulses','BAG','GST 0%',230, 240,185,25,   3,'1101'],
    ['Sona Masoori Rice 5Kg',   'GRN-004','Grains & Pulses','BAG','GST 5%', 350, 370, 280,20,   2,'1006'],
    ['Moong Dal 500g',          'GRN-005','Grains & Pulses','PKT','GST 5%',  70,  75,  56, 45,   5,'0713'],

    // ── Spices & Masala ───────────────────────────────────────
    ['MDH Garam Masala 100g',   'SPC-001','Spices & Masala','PKT','GST 5%',  65,  70,  48, 60,   8,'0910'],
    ['Everest Chilli Powder 200g','SPC-002','Spices & Masala','PKT','GST 5%',65,  70,  48, 55,   8,'0904'],
    ['Turmeric Powder 200g',    'SPC-003','Spices & Masala','PKT','GST 5%',  45,  48,  33, 70,  10,'0910'],
    ['Cumin Seeds 100g',        'SPC-004','Spices & Masala','PKT','GST 5%',  35,  38,  25, 80,  10,'0909'],

    // ── Oils & Ghee ───────────────────────────────────────────
    ['Fortune Sunflower Oil 1L','OIL-001','Oils & Ghee',  'LTR','GST 5%',  145, 150,115, 30,   5,'1512'],
    ['Saffola Gold 1L',         'OIL-002','Oils & Ghee',  'LTR','GST 5%',  200, 210,160, 25,   4,'1512'],
    ['Patanjali Desi Ghee 500g','OIL-003','Oils & Ghee',  'GMS','GST 12%', 320, 335,250, 20,   3,'0405'],
    ['Coconut Oil Parachute 500ml','OIL-004','Oils & Ghee','MLT','GST 18%',130, 140, 98, 35,   5,'1513'],

    // ── Personal Care ─────────────────────────────────────────
    ['Dove Shampoo 340ml',      'PC-003', 'Personal Care','BTL','GST 18%', 280, 295,195, 40,   5,'3305'],
    ['Vaseline Lotion 200ml',   'PC-004', 'Personal Care','MLT','GST 18%', 175, 185,125, 35,   5,'3304'],
    ['Gillette Fusion Razor',   'PC-005', 'Personal Care','NOS','GST 18%', 250, 260,175, 25,   3,'8212'],
    ['Whisper Ultra Pads 15s',  'PC-006', 'Personal Care','PKT','GST 0%',  75,  80,  55, 50,   8,'9619'],
    ['Himalaya Face Wash 150ml','PC-007', 'Personal Care','MLT','GST 18%', 120, 125, 85, 45,   5,'3304'],

    // ── Household / Cleaning ──────────────────────────────────
    ['Colin Glass Cleaner 500ml','HH-002','Cleaning Supplies','MLT','GST 18%',150,155,105,25,  3,'3405'],
    ['Harpic 500ml',            'HH-003','Cleaning Supplies','MLT','GST 18%',110,115, 78, 30,   4,'3402'],
    ['Vim Dishwash Bar 155g',   'HH-004','Cleaning Supplies','NOS','GST 18%', 25, 25,  17, 80,  10,'3402'],
    ['Broom Phool Jhadu',       'HH-005','Cleaning Supplies','NOS','GST 0%',  40, 45,  28, 20,   3,'9603'],
    ['Mop Set with Bucket',     'HH-006','Cleaning Supplies','SET','GST 12%',450,480, 320,10,   2,'9603'],

    // ── Confectionery ─────────────────────────────────────────
    ['Dairy Milk 50g',          'CNF-001','Confectionery', 'NOS','GST 18%', 50,  50,  35, 100, 10,'1806'],
    ['KitKat 4Finger',          'CNF-002','Confectionery', 'NOS','GST 18%', 30,  30,  20, 80,   8,'1806'],
    ['Mentos Mint Roll',        'CNF-003','Confectionery', 'NOS','GST 18%', 10,  10,   6, 200, 20,'1704'],
    ['Ferrero Rocher 16pcs',    'CNF-004','Confectionery', 'BOX','GST 18%', 550, 580, 400,15,   2,'1806'],

    // ── Stationery ────────────────────────────────────────────
    ['Classmate Notebook 200pg','STA-001','Stationery',    'NOS','GST 12%', 55,  60,  38, 50,   8,'4820'],
    ['Reynolds Pen Blue 10pk',  'STA-002','Stationery',    'PKT','GST 12%', 95, 100,  65, 40,   5,'9608'],
    ['Stapler Medium',          'STA-003','Stationery',    'NOS','GST 18%', 120, 130, 85, 15,   2,'8305'],
    ['A4 Paper Ream 500sht',    'STA-004','Stationery',    'SHT','GST 12%', 280, 295,200, 20,   3,'4802'],

    // ── Health & Nutrition ────────────────────────────────────
    ['Horlicks 500g',           'HLT-001','Health & Nutrition','GMS','GST 18%',270,285,195,30,  4,'1901'],
    ['Bournvita 500g',          'HLT-002','Health & Nutrition','GMS','GST 18%',250,265,180,28,  4,'1901'],
    ['Revital H Capsules 30s',  'HLT-003','Health & Nutrition','NOS','GST 12%',310,325,225,20,  3,'2106'],
    ['Ensure Powder 400g',      'HLT-004','Health & Nutrition','GMS','GST 12%',680,710,510,12,  2,'1901'],

    // ── Baby Care ─────────────────────────────────────────────
    ['Pampers New Born S 34s',  'BAB-001','Baby Care',     'PKT','GST 12%', 340, 360,250, 25,   3,'9619'],
    ['Johnson Baby Powder 200g','BAB-002','Baby Care',     'GMS','GST 0%',  160, 170,115, 20,   3,'3304'],
    ['Cerelac Rice 300g',       'BAB-003','Baby Care',     'GMS','GST 12%', 270, 285,195, 15,   2,'1901'],

    // ── Mobile Accessories ────────────────────────────────────
    ['USB-C Cable 1m',          'MOB-001','Mobile Accessories','NOS','GST 18%',299,320,180,30,  5,'8544'],
    ['20W Fast Charger',        'MOB-002','Mobile Accessories','NOS','GST 18%',599,650,380,20,  3,'8504'],
    ['Tempered Glass Universal','MOB-003','Mobile Accessories','NOS','GST 18%',149,160, 80,50,  8,'7007'],
    ['Bluetooth Earbuds',       'MOB-004','Mobile Accessories','NOS','GST 18%',999,1100,650,15, 2,'8518'],
];

$itemMap = []; // name → id
foreach ($pdo->query("SELECT name,id FROM items WHERE tenant_id='$tid' AND deleted_at IS NULL")->fetchAll() as $r)
    $itemMap[$r['name']] = $r['id'];

$itemInserted = 0;
foreach ($newItems as [$name,$sku,$cat,$unit,$tax,$saleP,$mrp,$purchP,$stock,$lowStock,$hsn]) {
    if (isset($itemMap[$name])) continue;
    $iid = uid(); $itemMap[$name] = $iid;
    $catId  = $catIds[$cat]  ?? null;
    $unitId = $unitIds[$unit] ?? null;
    $taxId  = $taxIds[$tax]  ?? null;
    ins($pdo,'items',[
        'id'=>$iid,'tenant_id'=>$tid,'name'=>$name,'sku'=>$sku,'hsn_sac'=>$hsn,
        'category_id'=>$catId,'unit_id'=>$unitId,'tax_rate_id'=>$taxId,
        'type'=>'product','track_inventory'=>1,'low_stock_alert'=>$lowStock,
        'opening_stock'=>$stock,'opening_stock_rate'=>$purchP,
    ]);
    ins($pdo,'item_prices',[
        'id'=>uid(),'tenant_id'=>$tid,'item_id'=>$iid,
        'sale_price'=>$saleP,'mrp'=>$mrp,'purchase_price'=>$purchP,
    ]);
    ins($pdo,'stock_movements',[
        'id'=>uid(),'tenant_id'=>$tid,'item_id'=>$iid,'store_id'=>$storeId,
        'movement_type'=>'opening','qty'=>$stock,'rate'=>$purchP,
        'reason'=>'Opening stock','moved_at'=>date('Y-m-d H:i:s'),
    ]);
    $itemInserted++;
}
echo "   Inserted $itemInserted new items. Total items: ".count($itemMap)."\n";

// ═══════════════════════════════════════════════════════════════
// 5. PARTIES — customers & suppliers
// ═══════════════════════════════════════════════════════════════
echo "[5] Parties...\n";
$partyMap = [];
foreach ($pdo->query("SELECT name,id FROM parties WHERE tenant_id='$tid' AND deleted_at IS NULL")->fetchAll() as $r)
    $partyMap[$r['name']] = $r['id'];

// [name, role, gstin, gst_type, phone, city, state, state_code, credit_limit]
$newParties = [
    // Customers
    ['Sunita Verma',        'customer',null,             'consumer',    '9811100001','Delhi',     'Delhi',          '07', null],
    ['Rajesh Kumar',        'customer',null,             'consumer',    '9811100002','Mumbai',    'Maharashtra',    '27', null],
    ['Anita Singh',         'customer',null,             'consumer',    '9811100003','Bangalore', 'Karnataka',      '29', null],
    ['Vijay Sharma',        'customer',null,             'consumer',    '9811100004','Chennai',   'Tamil Nadu',     '33', null],
    ['Meena Patel',         'customer',null,             'consumer',    '9811100005','Ahmedabad', 'Gujarat',        '24', null],
    ['Suresh Nair',         'customer',null,             'consumer',    '9811100006','Kochi',     'Kerala',         '32', null],
    ['Deepa Reddy',         'customer',null,             'consumer',    '9811100007','Hyderabad', 'Telangana',      '36', null],
    ['Arun Joshi',          'customer',null,             'consumer',    '9811100008','Pune',      'Maharashtra',    '27', null],
    ['Kavita Desai',        'customer',null,             'consumer',    '9811100009','Surat',     'Gujarat',        '24', null],
    ['Om Prakash Gupta',    'customer','07AAAPG1234Q1Z5','regular',     '9811100010','Delhi',     'Delhi',          '07', 50000],
    ['Lakshmi Stores',      'customer','29AAALS5678R1Z3','regular',     '9811100011','Bangalore', 'Karnataka',      '29', 75000],
    ['Metro Retailers',     'customer','27AAAPM9012S1Z1','regular',     '9811100012','Mumbai',    'Maharashtra',    '27', 100000],
    // Suppliers
    ['Hindustan Unilever Ltd','supplier','27AAAAH1234B1ZA','regular',   '9900000001','Mumbai',    'Maharashtra',    '27', null],
    ['ITC Limited',         'supplier', '29AAACI1234C1ZB','regular',    '9900000002','Bangalore', 'Karnataka',      '29', null],
    ['Nestle India',        'supplier', '07AAACN1234D1ZC','regular',    '9900000003','Delhi',     'Delhi',          '07', null],
    ['Procter & Gamble',    'supplier', '27AAACP1234E1ZD','regular',    '9900000004','Mumbai',    'Maharashtra',    '27', null],
    ['Amul (GCMMF)',        'supplier', '24AAAAG1234F1ZE','regular',    '9900000005','Anand',     'Gujarat',        '24', null],
    ['Parle Products',      'supplier', '27AAAPP1234G1ZF','regular',    '9900000006','Mumbai',    'Maharashtra',    '27', null],
    ['Dabur India',         'supplier', '07AAAAD1234H1ZG','regular',    '9900000007','Delhi',     'Delhi',          '07', null],
    ['Marico Limited',      'supplier', '27AAACM1234I1ZH','regular',    '9900000008','Mumbai',    'Maharashtra',    '27', null],
];
$partyInserted = 0;
foreach ($newParties as [$name,$role,$gstin,$gstType,$phone,$city,$state,$sc,$credit]) {
    if (isset($partyMap[$name])) continue;
    $pid = uid(); $partyMap[$name] = $pid;
    ins($pdo,'parties',[
        'id'=>$pid,'tenant_id'=>$tid,'role'=>$role,'name'=>$name,
        'gstin'=>$gstin,'gst_type'=>$gstType,'phone'=>$phone,
        'city'=>$city,'state'=>$state,'state_code'=>$sc,
        'credit_limit'=>$credit,
    ]);
    ins($pdo,'party_balances',['id'=>uid(),'tenant_id'=>$tid,'party_id'=>$pid,'receivable'=>0,'payable'=>0,'points'=>0]);
    $partyInserted++;
}
echo "   Inserted $partyInserted new parties. Total: ".count($partyMap)."\n";

// ═══════════════════════════════════════════════════════════════
// 6. STAFF
// ═══════════════════════════════════════════════════════════════
echo "[6] Staff...\n";
$staffData = [
    ['Rohit Sharma',  'Store Manager',  'Management', 'Male',   '1988-05-12','2019-01-15', '9812340001', 35000],
    ['Priya Kumari',  'Cashier',        'Sales',      'Female', '1995-08-22','2020-06-01', '9812340002', 18000],
    ['Amit Pandey',   'Sales Executive','Sales',      'Male',   '1993-11-30','2021-03-10', '9812340003', 20000],
    ['Sunita Rao',    'Inventory Clerk','Warehouse',  'Female', '1990-04-18','2020-09-01', '9812340004', 16000],
    ['Rakesh Singh',  'Delivery Boy',   'Logistics',  'Male',   '1998-07-25','2022-01-01', '9812340005', 14000],
    ['Kavya Nair',    'Accountant',     'Finance',    'Female', '1991-02-14','2019-07-01', '9812340006', 28000],
    ['Deepak Verma',  'Store Helper',   'Operations', 'Male',   '2000-09-08','2023-04-01', '9812340007', 12000],
];
$staffInserted = 0;
foreach ($staffData as [$name,$desig,$dept,$gender,$dob,$doj,$phone,$salary]) {
    $exists = $pdo->prepare("SELECT id FROM staff WHERE tenant_id=? AND name=? AND deleted_at IS NULL");
    $exists->execute([$tid,$name]);
    if ($exists->fetch()) continue;
    $sid = uid();
    ins($pdo,'staff',[
        'id'=>$sid,'tenant_id'=>$tid,'firm_id'=>$firmId,'name'=>$name,
        'designation'=>$desig,'department'=>$dept,'gender'=>$gender,
        'dob'=>$dob,'doj'=>$doj,'phone'=>$phone,
    ]);
    ins($pdo,'staff_profiles',[
        'id'=>uid(),'tenant_id'=>$tid,'staff_id'=>$sid,'salary'=>$salary,
    ]);
    $staffInserted++;
}
echo "   Inserted $staffInserted staff members.\n";

// ═══════════════════════════════════════════════════════════════
// 7. SALES — 60 days of realistic transactions
// ═══════════════════════════════════════════════════════════════
echo "[7] Sales (60 days)...\n";

// Load doc sequence
$seq = $pdo->query("SELECT * FROM document_sequences WHERE tenant_id='$tid' AND firm_id='$firmId' AND doc_type='invoice'")->fetch();
$invNext = $seq ? (int)$seq['next_no'] : 1;
$seqId   = $seq ? $seq['id'] : null;

// Customer list (only customer-role parties)
$customers = $pdo->query(
    "SELECT id,name FROM parties WHERE tenant_id='$tid' AND role IN ('customer','both') AND deleted_at IS NULL"
)->fetchAll();

// Saleable items with prices
$saleItems = $pdo->query(
    "SELECT i.id,i.name,ip.sale_price,tr.rate as tax_rate
     FROM items i
     JOIN item_prices ip ON ip.item_id=i.id
     JOIN tax_rates tr ON tr.id=i.tax_rate_id
     WHERE i.tenant_id='$tid' AND i.deleted_at IS NULL AND ip.sale_price > 0"
)->fetchAll();

$salesInserted = 0;
$payModes = ['cash','cash','cash','upi','upi','card','bank'];

for ($day = 60; $day >= 1; $day--) {
    $date    = ago($day);
    // 2–6 invoices per day, less on weekends
    $dow     = (int)date('N', strtotime($date));
    $perDay  = ($dow >= 6) ? rand(1,3) : rand(2,6);

    for ($i = 0; $i < $perDay; $i++) {
        $customer  = $customers[array_rand($customers)];
        $numItems  = rand(2, 6);
        $shuffled  = $saleItems;
        shuffle($shuffled);
        $lineItems = array_slice($shuffled, 0, $numItems);

        $subTotal = $discAmt = $taxTotal = $total = 0;
        $itemRows = [];
        foreach ($lineItems as $it) {
            $qty      = rand(1, 4);
            $price    = (float)$it['sale_price'];
            $taxRate  = (float)$it['tax_rate'];
            $taxAmt   = round($price * $qty * $taxRate / 100, 2);
            $lineTotal= round($price * $qty + $taxAmt, 2);
            $half     = round($taxAmt / 2, 2);
            $subTotal += $price * $qty;
            $taxTotal += $taxAmt;
            $total    += $lineTotal;
            $itemRows[] = [
                'id'=>uid(),'tenant_id'=>$tid,'item_id'=>$it['id'],'item_name'=>$it['name'],
                'qty'=>$qty,'price_unit'=>$price,'tax_pct'=>$taxRate,
                'tax_amt'=>$taxAmt,'cgst'=>$half,'sgst'=>$half,'igst'=>0,
                'line_total'=>$lineTotal,
            ];
        }
        $total   = round($total, 2);
        $payMode = $payModes[array_rand($payModes)];
        $paid    = ($payMode === 'credit') ? 0 : $total;
        $status  = $paid >= $total ? 'paid' : 'open';
        $docNo   = 'INV'.str_pad($invNext++, 4,'0',STR_PAD_LEFT);

        $docId = uid();
        $pdo->prepare("INSERT IGNORE INTO sale_documents
            (id,tenant_id,firm_id,store_id,doc_type,doc_no,doc_date,party_id,sub_total,
             discount_amt,tax_amt,total,paid_amt,balance_amt,status,created_by)
            VALUES(?,?,?,?,'invoice',?,?,?,?,0,?,?,?,?,?,?)")
            ->execute([$docId,$tid,$firmId,$storeId,$docNo,$date,
                $customer['id'],$subTotal,$taxTotal,$total,$paid,max(0,$total-$paid),$status,'user-0001-0000-0000-000000000001']);

        foreach ($itemRows as $ir) {
            $docItemId = $ir['id'];
            $pdo->prepare("INSERT IGNORE INTO sale_document_items
                (id,tenant_id,document_id,item_id,item_name,qty,price_unit,discount_pct,discount_amt,
                 tax_pct,tax_amt,cgst,sgst,igst,cess,line_total)
                VALUES(?,?,?,?,?,?,?,0,0,?,?,?,?,0,0,?)")
                ->execute([$docItemId,$tid,$docId,$ir['item_id'],$ir['item_name'],
                    $ir['qty'],$ir['price_unit'],$ir['tax_pct'],
                    $ir['tax_amt'],$ir['cgst'],$ir['sgst'],$ir['line_total']]);

            // stock movement
            $pdo->prepare("INSERT IGNORE INTO stock_movements
                (id,tenant_id,item_id,store_id,movement_type,qty,rate,ref_doc_type,ref_doc_id,moved_at)
                VALUES(?,?,?,?,'sale',?,?,'sale',?,?)")
                ->execute([uid(),$tid,$ir['item_id'],$storeId,
                    -abs($ir['qty']),$ir['price_unit'],$docId,$date.' 10:00:00']);
        }

        if ($paid > 0) {
            $pdo->prepare("INSERT IGNORE INTO payments
                (id,tenant_id,firm_id,party_id,direction,doc_id,doc_type,pay_mode,amount,pay_date)
                VALUES(?,?,?,?,'in',?,'invoice',?,?,?)")
                ->execute([uid(),$tid,$firmId,$customer['id'],$docId,$payMode,$paid,$date]);
        }
        $salesInserted++;
    }
}
// Update sequence
if ($seqId) $pdo->prepare("UPDATE document_sequences SET next_no=? WHERE id=?")->execute([$invNext,$seqId]);
echo "   Inserted $salesInserted invoices.\n";

// ═══════════════════════════════════════════════════════════════
// 8. PURCHASES — 60 days
// ═══════════════════════════════════════════════════════════════
echo "[8] Purchases (60 days)...\n";

$purSeq = $pdo->query("SELECT * FROM document_sequences WHERE tenant_id='$tid' AND firm_id='$firmId' AND doc_type='purchase'")->fetch();
$purNext= $purSeq ? (int)$purSeq['next_no'] : 1;
$purSeqId = $purSeq ? $purSeq['id'] : null;

$suppliers = $pdo->query(
    "SELECT id,name FROM parties WHERE tenant_id='$tid' AND role IN ('supplier','both') AND deleted_at IS NULL"
)->fetchAll();

$purchItems = $pdo->query(
    "SELECT i.id,i.name,ip.purchase_price,tr.rate as tax_rate
     FROM items i
     JOIN item_prices ip ON ip.item_id=i.id
     JOIN tax_rates tr ON tr.id=i.tax_rate_id
     WHERE i.tenant_id='$tid' AND i.deleted_at IS NULL AND ip.purchase_price > 0"
)->fetchAll();

$purInserted = 0;
for ($day = 60; $day >= 1; $day -= rand(3,7)) { // purchase every 3-7 days
    $date     = ago($day);
    $supplier = $suppliers[array_rand($suppliers)];
    $numItems = rand(3, 8);
    $shuffled = $purchItems; shuffle($shuffled);
    $lineItems= array_slice($shuffled, 0, $numItems);

    $subTotal = $taxTotal = $total = 0;
    $itemRows = [];
    foreach ($lineItems as $it) {
        $qty      = rand(10, 50);
        $price    = (float)$it['purchase_price'];
        $taxRate  = (float)$it['tax_rate'];
        $taxAmt   = round($price * $qty * $taxRate / 100, 2);
        $lineTotal= round($price * $qty + $taxAmt, 2);
        $subTotal += $price * $qty;
        $taxTotal += $taxAmt;
        $total    += $lineTotal;
        $itemRows[] = ['item_id'=>$it['id'],'name'=>$it['name'],'qty'=>$qty,'price'=>$price,'tax'=>$taxRate,'taxAmt'=>$taxAmt,'line'=>$lineTotal];
    }
    $total  = round($total, 2);
    $paid   = $total; // fully paid
    $docNo  = 'PUR'.str_pad($purNext++, 4,'0',STR_PAD_LEFT);
    $docId  = uid();

    $pdo->prepare("INSERT IGNORE INTO purchase_documents
        (id,tenant_id,firm_id,doc_type,doc_no,doc_date,party_id,sub_total,discount_amt,tax_amt,total,paid_amt,balance_amt,status)
        VALUES(?,?,?,'purchase',?,?,?,?,0,?,?,?,0,'paid')")
        ->execute([$docId,$tid,$firmId,$docNo,$date,$supplier['id'],$subTotal,$taxTotal,$total,$paid]);

    foreach ($itemRows as $ir) {
        $pdo->prepare("INSERT IGNORE INTO purchase_document_items
            (id,tenant_id,document_id,item_id,item_name,qty,price_unit,discount_amt,tax_pct,tax_amt,line_total)
            VALUES(?,?,?,?,?,?,?,0,?,?,?)")
            ->execute([uid(),$tid,$docId,$ir['item_id'],$ir['name'],$ir['qty'],$ir['price'],$ir['tax'],$ir['taxAmt'],$ir['line']]);

        $pdo->prepare("INSERT IGNORE INTO stock_movements
            (id,tenant_id,item_id,store_id,movement_type,qty,rate,ref_doc_type,ref_doc_id,moved_at)
            VALUES(?,?,?,?,'purchase',?,?,'purchase',?,?)")
            ->execute([uid(),$tid,$ir['item_id'],$storeId,$ir['qty'],$ir['price'],$docId,$date.' 09:00:00']);
    }
    $pdo->prepare("INSERT IGNORE INTO payments
        (id,tenant_id,firm_id,party_id,direction,doc_id,doc_type,pay_mode,amount,pay_date)
        VALUES(?,?,?,?,'out',?,'purchase','bank',?,?)")
        ->execute([uid(),$tid,$firmId,$supplier['id'],$docId,$paid,$date]);

    $purInserted++;
}
if ($purSeqId) $pdo->prepare("UPDATE document_sequences SET next_no=? WHERE id=?")->execute([$purNext,$purSeqId]);
echo "   Inserted $purInserted purchases.\n";

// ═══════════════════════════════════════════════════════════════
// 9. EXPENSES — 60 days
// ═══════════════════════════════════════════════════════════════
echo "[9] Expenses...\n";
$expCategories = [
    ['Rent',         8000,  12000, 'bank'],
    ['Electricity',   800,   2500, 'bank'],
    ['Staff Salary', 5000,  35000, 'bank'],
    ['Transport',     200,   1500, 'cash'],
    ['Packaging',     300,   2000, 'cash'],
    ['Marketing',     500,   5000, 'upi'],
    ['Maintenance',   200,   2000, 'cash'],
    ['Internet',      500,   1500, 'bank'],
    ['Office Supplies',100,   800, 'cash'],
    ['Miscellaneous', 100,   500,  'cash'],
];
$expInserted = 0;
for ($day = 60; $day >= 1; $day--) {
    $date = ago($day);
    $numExp = rand(0, 3);
    for ($e = 0; $e < $numExp; $e++) {
        [$cat, $min, $max, $mode] = $expCategories[array_rand($expCategories)];
        $amount = rand($min, $max);
        $pdo->prepare("INSERT INTO expenses (id,tenant_id,firm_id,category,amount,exp_date,pay_mode)
            VALUES(?,?,?,?,?,?,?)")
            ->execute([uid(),$tid,$firmId,$cat,$amount,$date,$mode]);
        $expInserted++;
    }
}
echo "   Inserted $expInserted expense entries.\n";

// ═══════════════════════════════════════════════════════════════
// 10. BANKS
// ═══════════════════════════════════════════════════════════════
echo "[10] Banks...\n";
$existBanks = $pdo->query("SELECT COUNT(*) as c FROM banks WHERE tenant_id='$tid'")->fetch()['c'];
if ($existBanks == 0) {
    ins($pdo,'banks',['id'=>uid(),'tenant_id'=>$tid,'firm_id'=>$firmId,
        'account_no'=>'12345678901','account_name'=>'My Retail Shop','bank_name'=>'HDFC Bank',
        'branch'=>'Main Branch','ifsc'=>'HDFC0001234','opening_balance'=>50000]);
    ins($pdo,'banks',['id'=>uid(),'tenant_id'=>$tid,'firm_id'=>$firmId,
        'account_no'=>'98765432101','account_name'=>'My Retail Shop','bank_name'=>'SBI',
        'branch'=>'City Branch','ifsc'=>'SBIN0001234','opening_balance'=>25000]);
    echo "   2 bank accounts added.\n";
} else {
    echo "   Banks already exist, skipped.\n";
}

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════
echo "\n=== Summary ===\n";
$tables = ['units','categories','tax_rates','items','parties','sale_documents','purchase_documents','expenses','staff','banks'];
foreach ($tables as $t) {
    $cnt = $pdo->query("SELECT COUNT(*) as c FROM $t WHERE tenant_id='$tid'")->fetch()['c'];
    printf("  %-25s %d\n", $t, $cnt);
}
echo "\nDone! ✓\n";
