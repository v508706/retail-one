<?php
/**
 * RetailOne — Seed script
 * Usage: php database/seed.php
 */

define('DB_HOST', 'localhost');
define('DB_PORT', 3306);
define('DB_NAME', 'retail_one');
define('DB_USER', 'root');
define('DB_PASS', '');

$dsn = 'mysql:host='.DB_HOST.';port='.DB_PORT.';dbname='.DB_NAME.';charset=utf8mb4';
try {
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (Exception $e) {
    die("DB connection failed: ".$e->getMessage()."\n");
}

function uuid(): string {
    $data = random_bytes(16);
    $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
    $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function ins(PDO $pdo, string $table, array $row): void {
    $cols = implode(',', array_keys($row));
    $plh  = implode(',', array_fill(0, count($row), '?'));
    $pdo->prepare("INSERT IGNORE INTO $table ($cols) VALUES ($plh)")
        ->execute(array_values($row));
}

echo "Seeding retail_one...\n";

// ── IDs ───────────────────────────────────────────────────────
$tenantId = 'tenant-0001-0000-0000-000000000001';
$userId   = 'user-0001-0000-0000-000000000001';
$firmId   = 'firm-0001-0000-0000-000000000001';
$storeId  = 'store-001-0000-0000-000000000001';
$termId   = 'term-0001-0000-0000-000000000001';
$roleId   = 'role-0001-0000-0000-000000000001';

// ── Tenant ────────────────────────────────────────────────────
ins($pdo,'tenants',[
    'id'   => $tenantId,
    'slug' => 'demo',
    'name' => 'Demo Company',
]);

// ── User (admin / admin@demo.com / password: admin123) ────────
$hash = password_hash('admin123', PASSWORD_BCRYPT);
ins($pdo,'users',[
    'id'            => $userId,
    'tenant_id'     => $tenantId,
    'name'          => 'Admin User',
    'email'         => 'admin@demo.com',
    'phone'         => '9999900000',
    'password_hash' => $hash,
    'status'        => 'active',
]);

// ── Role & Permission ─────────────────────────────────────────
ins($pdo,'roles',['id'=>$roleId,'tenant_id'=>$tenantId,'name'=>'Admin']);
ins($pdo,'user_roles',['id'=>uuid(),'tenant_id'=>$tenantId,'user_id'=>$userId,'role_id'=>$roleId]);

foreach (['catalog','parties','sales','purchases','expenses','accounting','reports','staff','loyalty','settings'] as $mod) {
    ins($pdo,'role_permissions',[
        'id'        => uuid(),
        'tenant_id' => $tenantId,
        'role_id'   => $roleId,
        'module'    => $mod,
        'can_view'  => 1, 'can_create' => 1, 'can_edit' => 1,
        'can_share' => 1, 'can_delete' => 1,
    ]);
}

// ── Firm ──────────────────────────────────────────────────────
ins($pdo,'firms',[
    'id'         => $firmId,
    'tenant_id'  => $tenantId,
    'name'       => 'My Retail Shop',
    'currency'   => 'INR',
    'decimals'   => 2,
    'fy_start_month' => 4,
]);

ins($pdo,'stores',[
    'id'        => $storeId,
    'tenant_id' => $tenantId,
    'firm_id'   => $firmId,
    'name'      => 'Main Store',
]);

ins($pdo,'terminals',[
    'id'        => $termId,
    'tenant_id' => $tenantId,
    'store_id'  => $storeId,
    'name'      => 'POS Terminal 1',
    'doc_prefix'=> 'T1',
]);

// ── Units ─────────────────────────────────────────────────────
$units = [
    ['NOS','Nos','NOS'],
    ['KGS','Kg','KGS'],
    ['GMS','Gm','GMS'],
    ['LTR','Ltr','LTR'],
    ['MLT','Ml','MLT'],
    ['PCS','Pcs','PCS'],
    ['BOX','Box','BOX'],
    ['PKT','Pkt','PKT'],
];
$unitIds = [];
foreach ($units as [$short,$name,$uqc]) {
    $id = uuid();
    $unitIds[$short] = $id;
    ins($pdo,'units',[
        'id'         => $id,
        'tenant_id'  => $tenantId,
        'name'       => $name,
        'short_name' => $short,
        'uqc'        => $uqc,
    ]);
}

// ── Categories ────────────────────────────────────────────────
$cats = ['Beverages','Snacks','Dairy','Bakery','Personal Care','Household','Electronics','Apparel'];
$catIds = [];
foreach ($cats as $cat) {
    $id = uuid();
    $catIds[$cat] = $id;
    ins($pdo,'categories',['id'=>$id,'tenant_id'=>$tenantId,'name'=>$cat]);
}

// ── Tax Rates ─────────────────────────────────────────────────
$taxes = [
    ['GST 0%',0,0,0,0,0],
    ['GST 5%',5,2.5,2.5,5,0],
    ['GST 12%',12,6,6,12,0],
    ['GST 18%',18,9,9,18,0],
    ['GST 28%',28,14,14,28,0],
];
$taxIds = [];
foreach ($taxes as [$name,$rate,$cgst,$sgst,$igst,$cess]) {
    $id = uuid();
    $taxIds[$name] = $id;
    ins($pdo,'tax_rates',[
        'id'        => $id,
        'tenant_id' => $tenantId,
        'name'      => $name,
        'rate'      => $rate,
        'cgst_rate' => $cgst,
        'sgst_rate' => $sgst,
        'igst_rate' => $igst,
        'cess_rate' => $cess,
    ]);
}

// ── Items ─────────────────────────────────────────────────────
$items = [
    ['Coca Cola 500ml',     'BEV-001', $catIds['Beverages'],     $unitIds['NOS'], $taxIds['GST 12%'], 40,   45,   25,  100],
    ['Pepsi 500ml',         'BEV-002', $catIds['Beverages'],     $unitIds['NOS'], $taxIds['GST 12%'], 35,   40,   22,  80],
    ['Lay\'s Classic 50g',  'SNK-001', $catIds['Snacks'],        $unitIds['PKT'], $taxIds['GST 12%'], 20,   20,   12,  200],
    ['Kurkure 40g',         'SNK-002', $catIds['Snacks'],        $unitIds['PKT'], $taxIds['GST 12%'], 18,   18,   10,  180],
    ['Amul Milk 500ml',     'DAI-001', $catIds['Dairy'],         $unitIds['MLT'], $taxIds['GST 5%'],  28,   28,   22,  60],
    ['Amul Butter 100g',    'DAI-002', $catIds['Dairy'],         $unitIds['GMS'], $taxIds['GST 12%'], 55,   58,   40,  50],
    ['Britannia Bread',     'BAK-001', $catIds['Bakery'],        $unitIds['PCS'], $taxIds['GST 0%'],  42,   42,   28,  40],
    ['Colgate Toothpaste',  'PC-001',  $catIds['Personal Care'], $unitIds['GMS'], $taxIds['GST 18%'], 90,   95,   60,  80],
    ['Dettol Soap 75g',     'PC-002',  $catIds['Personal Care'], $unitIds['PCS'], $taxIds['GST 18%'], 35,   38,   22,  120],
    ['Surf Excel 1Kg',      'HH-001',  $catIds['Household'],    $unitIds['KGS'], $taxIds['GST 12%'], 195,  200,  140, 30],
    ['Basmati Rice 1Kg',    'GRO-001', $catIds['Household'],    $unitIds['KGS'], $taxIds['GST 5%'],  90,   95,   65,  50],
    ['Tata Salt 1Kg',       'GRO-002', $catIds['Household'],    $unitIds['KGS'], $taxIds['GST 0%'],  22,   22,   16,  100],
];

foreach ($items as [$name, $sku, $catId, $unitId, $taxId, $saleP, $mrp, $purchP, $stock]) {
    $iid = uuid();
    ins($pdo,'items',[
        'id'              => $iid,
        'tenant_id'       => $tenantId,
        'name'            => $name,
        'sku'             => $sku,
        'category_id'     => $catId,
        'unit_id'         => $unitId,
        'tax_rate_id'     => $taxId,
        'type'            => 'product',
        'track_inventory' => 1,
        'low_stock_alert' => 10,
        'opening_stock'   => $stock,
        'opening_stock_rate' => $purchP,
    ]);
    ins($pdo,'item_prices',[
        'id'             => uuid(),
        'tenant_id'      => $tenantId,
        'item_id'        => $iid,
        'sale_price'     => $saleP,
        'mrp'            => $mrp,
        'purchase_price' => $purchP,
    ]);
    // opening stock movement
    ins($pdo,'stock_movements',[
        'id'            => uuid(),
        'tenant_id'     => $tenantId,
        'item_id'       => $iid,
        'store_id'      => $storeId,
        'movement_type' => 'opening',
        'qty'           => $stock,
        'rate'          => $purchP,
        'reason'        => 'Opening stock',
        'moved_at'      => date('Y-m-d H:i:s'),
    ]);
}

// ── Parties ───────────────────────────────────────────────────
$parties = [
    ['Walk-in Customer',  'customer', null,       '0000000000'],
    ['Ramesh Traders',    'supplier', '29AAACR5055K1Z5', '9876500001'],
    ['City Distributors', 'supplier', '27AAPFD1234D1Z5', '9876500002'],
    ['Priya Electronics', 'customer', null,       '9876500003'],
    ['Mohan General Store','both',    '24AABCM1234E1Z9', '9876500004'],
];
$walkInId = null;
foreach ($parties as [$name, $role, $gstin, $phone]) {
    $pid = uuid();
    if ($name === 'Walk-in Customer') $walkInId = $pid;
    ins($pdo,'parties',[
        'id'        => $pid,
        'tenant_id' => $tenantId,
        'role'      => $role,
        'name'      => $name,
        'gstin'     => $gstin,
        'phone'     => $phone,
    ]);
    ins($pdo,'party_balances',[
        'id'         => uuid(),
        'tenant_id'  => $tenantId,
        'party_id'   => $pid,
        'receivable' => 0,
        'payable'    => 0,
        'points'     => 0,
    ]);
}

// ── Document Sequences ────────────────────────────────────────
$seqs = [
    ['invoice','INV',1],
    ['pos','POS',1],
    ['estimate','EST',1],
    ['purchase','PUR',1],
    ['credit_note','CN',1],
    ['delivery_challan','DC',1],
];
foreach ($seqs as [$type,$prefix,$next]) {
    ins($pdo,'document_sequences',[
        'id'        => uuid(),
        'tenant_id' => $tenantId,
        'firm_id'   => $firmId,
        'doc_type'  => $type,
        'prefix'    => $prefix,
        'next_no'   => $next,
    ]);
}

// ── Loyalty Rule ──────────────────────────────────────────────
ins($pdo,'loyalty_rules',[
    'id'                     => uuid(),
    'tenant_id'              => $tenantId,
    'firm_id'                => $firmId,
    'name'                   => 'Default Rule',
    'earn_points_per_rupee'  => 1,
    'redeem_value_per_point' => 0.5,
    'min_purchase'           => 100,
    'is_active'              => 1,
]);

// ── Default Invoice Template ──────────────────────────────────
ins($pdo,'invoice_templates',[
    'id'          => uuid(),
    'tenant_id'   => $tenantId,
    'firm_id'     => $firmId,
    'name'        => 'Default',
    'doc_type'    => 'invoice',
    'layout'      => 'a4',
    'theme_color' => '#1a56db',
    'show_logo'   => 1,
    'is_default'  => 1,
    'footer_note' => 'Thank you for shopping with us!',
]);

// ── Default Settings ──────────────────────────────────────────
ins($pdo,'settings',[
    'id'        => uuid(),
    'tenant_id' => $tenantId,
    'firm_id'   => $firmId,
    'scope'     => 'general',
    'data'      => json_encode([
        'currency'         => 'INR',
        'currency_symbol'  => '₹',
        'date_format'      => 'DD/MM/YYYY',
        'timezone'         => 'Asia/Kolkata',
        'allow_negative_stock' => false,
    ]),
]);

echo "Done! Seeded:\n";
echo "  Tenant: demo\n";
echo "  User: admin@demo.com / admin123\n";
echo "  Firm: My Retail Shop\n";
echo "  Items: ".count($items)."\n";
echo "  Parties: ".count($parties)."\n";
