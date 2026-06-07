<?php
// ── Units ─────────────────────────────────────────────────────

route('GET','/units', function() {
    $auth = requireAuth();
    $tid  = $auth['tenant_id'];
    $rows = DB::all("SELECT * FROM units WHERE tenant_id=? AND deleted_at IS NULL ORDER BY name", [$tid]);
    ok($rows);
});

route('POST','/units', function() {
    $auth = requireAuth();
    $b    = json_decode(file_get_contents('php://input'), true) ?? [];
    validate($b,['name']);
    $id = uuid();
    DB::run("INSERT INTO units(id,tenant_id,name,short_name,uqc) VALUES(?,?,?,?,?)",
        [$id,$auth['tenant_id'],trim($b['name']),n($b['short_name']??null),n($b['uqc']??null)]);
    ok(DB::one("SELECT * FROM units WHERE id=?",[$id]), 201);
});

route('PUT','/units/:id', function($p) {
    $auth = requireAuth();
    $b    = json_decode(file_get_contents('php://input'), true) ?? [];
    DB::run("UPDATE units SET name=?,short_name=?,uqc=?,updated_at=NOW() WHERE id=? AND tenant_id=?",
        [trim($b['name']??''),n($b['short_name']??null),n($b['uqc']??null),$p['id'],$auth['tenant_id']]);
    ok(DB::one("SELECT * FROM units WHERE id=?",[$p['id']]));
});

route('DELETE','/units/:id', function($p) {
    $auth = requireAuth();
    DB::run("UPDATE units SET deleted_at=NOW() WHERE id=? AND tenant_id=?",[$p['id'],$auth['tenant_id']]);
    ok(['deleted'=>true]);
});

// ── Categories ────────────────────────────────────────────────

route('GET','/categories', function() {
    $auth = requireAuth();
    $rows = DB::all("SELECT * FROM categories WHERE tenant_id=? AND deleted_at IS NULL ORDER BY name",[$auth['tenant_id']]);
    ok($rows);
});

route('POST','/categories', function() {
    $auth = requireAuth();
    $b    = json_decode(file_get_contents('php://input'), true) ?? [];
    validate($b,['name']);
    $id = uuid();
    DB::run("INSERT INTO categories(id,tenant_id,name,parent_id) VALUES(?,?,?,?)",
        [$id,$auth['tenant_id'],trim($b['name']),n($b['parent_id']??null)]);
    ok(DB::one("SELECT * FROM categories WHERE id=?",[$id]), 201);
});

route('PUT','/categories/:id', function($p) {
    $auth = requireAuth();
    $b    = json_decode(file_get_contents('php://input'), true) ?? [];
    DB::run("UPDATE categories SET name=?,parent_id=?,updated_at=NOW() WHERE id=? AND tenant_id=?",
        [trim($b['name']??''),n($b['parent_id']??null),$p['id'],$auth['tenant_id']]);
    ok(DB::one("SELECT * FROM categories WHERE id=?",[$p['id']]));
});

route('DELETE','/categories/:id', function($p) {
    $auth = requireAuth();
    DB::run("UPDATE categories SET deleted_at=NOW() WHERE id=? AND tenant_id=?",[$p['id'],$auth['tenant_id']]);
    ok(['deleted'=>true]);
});

// ── Tax Rates ─────────────────────────────────────────────────

route('GET','/tax-rates', function() {
    $auth = requireAuth();
    $rows = DB::all("SELECT * FROM tax_rates WHERE tenant_id=? AND deleted_at IS NULL ORDER BY rate",[$auth['tenant_id']]);
    ok($rows);
});

route('POST','/tax-rates', function() {
    $auth = requireAuth();
    $b    = json_decode(file_get_contents('php://input'), true) ?? [];
    validate($b,['name']);
    $rate  = (float)($b['rate'] ?? 0);
    $cgst  = nf($b['cgst_rate'] ?? null) ?? round($rate/2, 4);
    $sgst  = nf($b['sgst_rate'] ?? null) ?? round($rate/2, 4);
    $igst  = nf($b['igst_rate'] ?? null) ?? $rate;
    $id    = uuid();
    DB::run("INSERT INTO tax_rates(id,tenant_id,name,rate,cgst_rate,sgst_rate,igst_rate,cess_rate,hsn_sac) VALUES(?,?,?,?,?,?,?,?,?)",
        [$id,$auth['tenant_id'],$b['name'],$rate,$cgst,$sgst,$igst,nf($b['cess_rate']??null),n($b['hsn_sac']??null)]);
    ok(DB::one("SELECT * FROM tax_rates WHERE id=?",[$id]), 201);
});

route('PUT','/tax-rates/:id', function($p) {
    $auth = requireAuth();
    $b    = json_decode(file_get_contents('php://input'), true) ?? [];
    DB::run("UPDATE tax_rates SET name=?,rate=?,cgst_rate=?,sgst_rate=?,igst_rate=?,cess_rate=?,updated_at=NOW()
             WHERE id=? AND tenant_id=?",
        [$b['name']??'',$b['rate']??0,$b['cgst_rate']??null,$b['sgst_rate']??null,
         $b['igst_rate']??null,$b['cess_rate']??null,$p['id'],$auth['tenant_id']]);
    ok(DB::one("SELECT * FROM tax_rates WHERE id=?",[$p['id']]));
});

route('DELETE','/tax-rates/:id', function($p) {
    $auth = requireAuth();
    DB::run("UPDATE tax_rates SET deleted_at=NOW() WHERE id=? AND tenant_id=?",[$p['id'],$auth['tenant_id']]);
    ok(['deleted'=>true]);
});

// ── Items ─────────────────────────────────────────────────────

route('GET','/items', function() {
    $auth = requireAuth();
    $tid  = $auth['tenant_id'];
    [$page,$perPage,$offset] = pagParams();

    $search = trim($_GET['search'] ?? '');
    $catId  = $_GET['category_id'] ?? null;

    $where = 'i.tenant_id=? AND i.deleted_at IS NULL';
    $params = [$tid];

    if ($search) { $where .= ' AND (i.name LIKE ? OR i.sku LIKE ?)'; $params[] = "%$search%"; $params[] = "%$search%"; }
    if ($catId)  { $where .= ' AND i.category_id=?'; $params[] = $catId; }

    $base = "FROM items i
             LEFT JOIN units u ON u.id=i.unit_id
             LEFT JOIN categories c ON c.id=i.category_id
             LEFT JOIN tax_rates tr ON tr.id=i.tax_rate_id
             LEFT JOIN item_prices ip ON ip.item_id=i.id
             WHERE $where";

    [$rows,$total] = DB::paginate(
        "SELECT COUNT(*) $base",
        "SELECT i.*,
                u.short_name as unit_name, u.name as unit_full_name,
                c.name as category_name,
                tr.rate as tax_rate, tr.name as tax_name,
                ip.sale_price, ip.mrp, ip.purchase_price, ip.wholesale_price, ip.online_price,
                COALESCE((SELECT SUM(qty) FROM stock_movements sm WHERE sm.item_id=i.id AND sm.tenant_id=?),0) as current_stock
         $base ORDER BY i.name",
        array_merge([$tid], $params),
        $perPage, $offset
    );
    paginated($rows, $total, $page, $perPage);
});

route('GET','/items/:id', function($p) {
    $auth = requireAuth();
    $item = DB::one(
        "SELECT i.*,
                u.short_name as unit_name,
                c.name as category_name,
                tr.rate as tax_rate, tr.name as tax_name,
                ip.sale_price, ip.mrp, ip.purchase_price, ip.wholesale_price, ip.online_price,
                COALESCE((SELECT SUM(qty) FROM stock_movements sm WHERE sm.item_id=i.id),0) as current_stock
         FROM items i
         LEFT JOIN units u ON u.id=i.unit_id
         LEFT JOIN categories c ON c.id=i.category_id
         LEFT JOIN tax_rates tr ON tr.id=i.tax_rate_id
         LEFT JOIN item_prices ip ON ip.item_id=i.id
         WHERE i.id=? AND i.tenant_id=? AND i.deleted_at IS NULL",
        [$p['id'], $auth['tenant_id']]
    );
    if (!$item) err(404,'NOT_FOUND','Item not found');
    // barcodes
    $item['barcodes'] = DB::all("SELECT barcode FROM barcodes WHERE item_id=?",[$p['id']]);
    ok($item);
});

route('POST','/items', function() {
    $auth = requireAuth();
    $tid  = $auth['tenant_id'];
    $b    = json_decode(file_get_contents('php://input'), true) ?? [];
    validate($b,['name']);
    $id = uuid();
    DB::beginTransaction();
    try {
        DB::run("INSERT INTO items(id,tenant_id,name,sku,hsn_sac,description,category_id,unit_id,tax_rate_id,
                    type,track_inventory,low_stock_alert,opening_stock,opening_stock_rate)
                 VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            [$id,$tid,trim($b['name']),n($b['sku']??null),n($b['hsn_sac']??null),n($b['description']??null),
             n($b['category_id']??null),n($b['unit_id']??null),n($b['tax_rate_id']??null),
             $b['type']??'product', nb($b['track_inventory']??1),
             nf($b['low_stock_alert']??null),nf($b['opening_stock']??0),nf($b['opening_stock_rate']??null)]);

        DB::run("INSERT INTO item_prices(id,tenant_id,item_id,sale_price,mrp,purchase_price,wholesale_price,online_price)
                 VALUES(?,?,?,?,?,?,?,?)",
            [uuid(),$tid,$id,nf($b['sale_price']??null),nf($b['mrp']??null),nf($b['purchase_price']??null),
             nf($b['wholesale_price']??null),nf($b['online_price']??null)]);

        if (!empty($b['opening_stock']) && (float)$b['opening_stock'] != 0) {
            DB::run("INSERT INTO stock_movements(id,tenant_id,item_id,movement_type,qty,rate,reason,moved_at)
                     VALUES(?,?,?,'opening',?,?,'Opening stock',NOW())",
                [uuid(),$tid,$id,(float)$b['opening_stock'],nf($b['opening_stock_rate']??null)]);
        }
        // barcodes
        foreach (($b['barcodes'] ?? []) as $bc) {
            if (!empty($bc)) DB::run("INSERT IGNORE INTO barcodes(id,tenant_id,item_id,barcode) VALUES(?,?,?,?)",[uuid(),$tid,$id,$bc]);
        }
        DB::commit();
    } catch (\Exception $e) { DB::rollback(); err(500,'DB_ERROR',$e->getMessage()); }
    ok(DB::one("SELECT * FROM items WHERE id=?",[$id]), 201);
});

route('PUT','/items/:id', function($p) {
    $auth = requireAuth();
    $tid  = $auth['tenant_id'];
    $b    = json_decode(file_get_contents('php://input'), true) ?? [];

    DB::beginTransaction();
    try {
        DB::run("UPDATE items SET name=?,sku=?,hsn_sac=?,description=?,category_id=?,unit_id=?,tax_rate_id=?,
                    type=?,track_inventory=?,low_stock_alert=?,updated_at=NOW()
                 WHERE id=? AND tenant_id=?",
            [trim($b['name']??''),n($b['sku']??null),n($b['hsn_sac']??null),n($b['description']??null),
             n($b['category_id']??null),n($b['unit_id']??null),n($b['tax_rate_id']??null),
             $b['type']??'product',nb($b['track_inventory']??1),nf($b['low_stock_alert']??null),
             $p['id'],$tid]);

        DB::run("UPDATE item_prices SET sale_price=?,mrp=?,purchase_price=?,wholesale_price=?,online_price=?,updated_at=NOW()
                 WHERE item_id=? AND tenant_id=?",
            [nf($b['sale_price']??null),nf($b['mrp']??null),nf($b['purchase_price']??null),
             nf($b['wholesale_price']??null),nf($b['online_price']??null),$p['id'],$tid]);

        DB::commit();
    } catch (\Exception $e) { DB::rollback(); err(500,'DB_ERROR',$e->getMessage()); }
    ok(DB::one("SELECT * FROM items WHERE id=?",[$p['id']]));
});

route('DELETE','/items/:id', function($p) {
    $auth = requireAuth();
    DB::run("UPDATE items SET deleted_at=NOW() WHERE id=? AND tenant_id=?",[$p['id'],$auth['tenant_id']]);
    ok(['deleted'=>true]);
});

// POST /items/:id/stock-adjustment
route('POST','/items/:id/stock-adjustment', function($p) {
    $auth = requireAuth();
    $tid  = $auth['tenant_id'];
    $b    = json_decode(file_get_contents('php://input'), true) ?? [];
    validate($b,['qty']);
    $smId = uuid();
    DB::run("INSERT INTO stock_movements(id,tenant_id,item_id,movement_type,qty,rate,reason,moved_at)
             VALUES(?,?,?,'adjustment',?,?,?,NOW())",
        [$smId,$tid,$p['id'],(float)$b['qty'],nf($b['rate']??null),n($b['reason']??null)]);
    ok(DB::one("SELECT * FROM stock_movements WHERE id=?",[$smId]), 201);
});

// GET /items/:id/stock-movements
route('GET','/items/:id/stock-movements', function($p) {
    $auth = requireAuth();
    $rows = DB::all(
        "SELECT * FROM stock_movements WHERE item_id=? AND tenant_id=? ORDER BY created_at DESC LIMIT 100",
        [$p['id'],$auth['tenant_id']]
    );
    ok($rows);
});
