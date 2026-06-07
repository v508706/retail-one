<?php
// ── Online Store Settings ─────────────────────────────────────

route('GET','/online-store/settings', function() {
    $auth   = requireAuth();
    $tid    = $auth['tenant_id'];
    $firmId = $auth['firm_id'] ?? null;
    $row    = DB::one("SELECT * FROM online_store_settings WHERE tenant_id=? AND firm_id<=>?",[$tid,$firmId]);
    ok($row ?? ['store_live'=>false,'accept_orders'=>true]);
});

route('PUT','/online-store/settings', function() {
    $auth   = requireAuth();
    $tid    = $auth['tenant_id'];
    $firmId = $auth['firm_id'] ?? null;
    $b      = json_decode(file_get_contents('php://input'), true) ?? [];

    $existing = DB::one("SELECT id FROM online_store_settings WHERE tenant_id=? AND firm_id<=>?",[$tid,$firmId]);
    if ($existing) {
        DB::run("UPDATE online_store_settings SET store_live=?,accept_orders=?,store_name=?,store_url=?,updated_at=NOW()
                 WHERE id=?",
            [nb($b['store_live']??0),nb($b['accept_orders']??1),n($b['store_name']??null),n($b['store_url']??null),$existing['id']]);
    } else {
        DB::run("INSERT INTO online_store_settings(id,tenant_id,firm_id,store_live,accept_orders,store_name,store_url)
                 VALUES(?,?,?,?,?,?,?)",
            [uuid(),$tid,$firmId,nb($b['store_live']??0),nb($b['accept_orders']??1),n($b['store_name']??null),n($b['store_url']??null)]);
    }
    ok(DB::one("SELECT * FROM online_store_settings WHERE tenant_id=? AND firm_id<=>?",[$tid,$firmId]));
});

// ── Online Store Orders ───────────────────────────────────────

route('GET','/online-store/orders', function() {
    $auth = requireAuth();
    $tid  = $auth['tenant_id'];
    [$page,$perPage,$offset] = pagParams();
    $where  = 'tenant_id=?';
    $params = [$tid];
    if (!empty($_GET['status'])) { $where .= ' AND status=?'; $params[] = $_GET['status']; }
    [$rows,$total] = DB::paginate(
        "SELECT COUNT(*) FROM online_store_orders WHERE $where",
        "SELECT * FROM online_store_orders WHERE $where ORDER BY created_at DESC",
        $params, $perPage, $offset
    );
    // decode items JSON
    foreach ($rows as &$r) {
        if ($r['items']) $r['items'] = json_decode($r['items'], true);
    }
    paginated($rows, $total, $page, $perPage);
});

route('GET','/online-store/orders/:id', function($p) {
    $auth = requireAuth();
    $row  = DB::one("SELECT * FROM online_store_orders WHERE id=? AND tenant_id=?",[$p['id'],$auth['tenant_id']]);
    if (!$row) err(404,'NOT_FOUND','Order not found');
    if ($row['items']) $row['items'] = json_decode($row['items'], true);
    ok($row);
});

route('POST','/online-store/orders', function() {
    // Public endpoint — no auth required for customer order submission
    $tid  = $_GET['tenant_id'] ?? null;
    $firmId = $_GET['firm_id'] ?? null;
    if (!$tid) err(400,'MISSING_TENANT','tenant_id query param required');
    $b    = json_decode(file_get_contents('php://input'), true) ?? [];
    validate($b,['customer_name','items']);
    $id = uuid();
    DB::run("INSERT INTO online_store_orders(id,tenant_id,firm_id,customer_name,customer_phone,customer_email,
                address,items,total,status,notes)
             VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        [$id,$tid,$firmId,trim($b['customer_name']),n($b['customer_phone']??null),n($b['customer_email']??null),
         n($b['address']??null),json_encode($b['items']??[]),(float)($b['total']??0),'pending',n($b['notes']??null)]);
    ok(DB::one("SELECT * FROM online_store_orders WHERE id=?",[$id]), 201);
});

route('PUT','/online-store/orders/:id', function($p) {
    $auth = requireAuth();
    $b    = json_decode(file_get_contents('php://input'), true) ?? [];
    DB::run("UPDATE online_store_orders SET status=?,updated_at=NOW() WHERE id=? AND tenant_id=?",
        [$b['status']??'pending',$p['id'],$auth['tenant_id']]);
    $row = DB::one("SELECT * FROM online_store_orders WHERE id=?",[$p['id']]);
    if ($row['items']) $row['items'] = json_decode($row['items'], true);
    ok($row);
});
