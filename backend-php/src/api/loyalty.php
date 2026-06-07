<?php
// ── Loyalty Rules ─────────────────────────────────────────────

route('GET','/loyalty/rules', function() {
    $auth = requireAuth();
    $rows = DB::all("SELECT * FROM loyalty_rules WHERE tenant_id=? ORDER BY name",[$auth['tenant_id']]);
    ok($rows);
});

route('POST','/loyalty/rules', function() {
    $auth = requireAuth();
    $tid  = $auth['tenant_id'];
    $b    = json_decode(file_get_contents('php://input'), true) ?? [];
    $id = uuid();
    DB::run("INSERT INTO loyalty_rules(id,tenant_id,firm_id,name,earn_points_per_rupee,redeem_value_per_point,min_purchase,is_active)
             VALUES(?,?,?,?,?,?,?,?)",
        [$id,$tid,$b['firm_id']??($auth['firm_id']??null),
         $b['name']??'Default',
         (float)($b['earn_points_per_rupee']??1),
         (float)($b['redeem_value_per_point']??0.5),
         (float)($b['min_purchase']??0),
         nb($b['is_active']??1)]);
    ok(DB::one("SELECT * FROM loyalty_rules WHERE id=?",[$id]), 201);
});

route('PUT','/loyalty/rules/:id', function($p) {
    $auth = requireAuth();
    $b    = json_decode(file_get_contents('php://input'), true) ?? [];
    DB::run("UPDATE loyalty_rules SET name=?,earn_points_per_rupee=?,redeem_value_per_point=?,min_purchase=?,is_active=?
             WHERE id=? AND tenant_id=?",
        [$b['name']??'Default',(float)($b['earn_points_per_rupee']??1),
         (float)($b['redeem_value_per_point']??0.5),(float)($b['min_purchase']??0),
         nb($b['is_active']??1),$p['id'],$auth['tenant_id']]);
    ok(DB::one("SELECT * FROM loyalty_rules WHERE id=?",[$p['id']]));
});

route('DELETE','/loyalty/rules/:id', function($p) {
    $auth = requireAuth();
    DB::run("DELETE FROM loyalty_rules WHERE id=? AND tenant_id=?",[$p['id'],$auth['tenant_id']]);
    ok(['deleted'=>true]);
});

// ── Loyalty Transactions ──────────────────────────────────────

route('GET','/loyalty/transactions', function() {
    $auth = requireAuth();
    $tid  = $auth['tenant_id'];
    [$page,$perPage,$offset] = pagParams();
    $where  = 'lt.tenant_id=?';
    $params = [$tid];
    if (!empty($_GET['party_id'])) { $where .= ' AND lt.party_id=?'; $params[] = $_GET['party_id']; }
    [$rows,$total] = DB::paginate(
        "SELECT COUNT(*) FROM loyalty_transactions lt WHERE $where",
        "SELECT lt.*,p.name as party_name FROM loyalty_transactions lt
         LEFT JOIN parties p ON p.id=lt.party_id
         WHERE $where ORDER BY lt.created_at DESC",
        $params, $perPage, $offset
    );
    paginated($rows, $total, $page, $perPage);
});

route('POST','/loyalty/transactions', function() {
    $auth = requireAuth();
    $tid  = $auth['tenant_id'];
    $b    = json_decode(file_get_contents('php://input'), true) ?? [];
    validate($b,['party_id','points','transaction_type']);

    $id = uuid();
    DB::run("INSERT INTO loyalty_transactions(id,tenant_id,party_id,points,transaction_type,doc_id,note)
             VALUES(?,?,?,?,?,?,?)",
        [$id,$tid,$b['party_id'],(float)$b['points'],$b['transaction_type'],
         n($b['doc_id']??null),n($b['note']??null)]);

    // Update party balance
    $delta = in_array($b['transaction_type'],['earn','adjust']) ? (float)$b['points'] : -(float)$b['points'];
    DB::run("UPDATE party_balances SET points=points+? WHERE party_id=? AND tenant_id=?",
        [$delta,$b['party_id'],$tid]);

    ok(DB::one("SELECT * FROM loyalty_transactions WHERE id=?",[$id]), 201);
});

// GET /loyalty/parties/:id/balance  — points balance for a party
route('GET','/loyalty/parties/:id/balance', function($p) {
    $auth = requireAuth();
    $pb   = DB::one("SELECT points FROM party_balances WHERE party_id=? AND tenant_id=?",
        [$p['id'],$auth['tenant_id']]);
    $rule = DB::one("SELECT * FROM loyalty_rules WHERE tenant_id=? AND is_active=1 LIMIT 1",[$auth['tenant_id']]);
    $points = (float)($pb['points'] ?? 0);
    $value  = $rule ? round($points * (float)$rule['redeem_value_per_point'], 2) : 0;
    ok(['points'=>$points,'redeemable_value'=>$value,'rule'=>$rule]);
});
