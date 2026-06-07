<?php
// ── Banks ─────────────────────────────────────────────────────

route('GET','/banks', function() {
    $auth = requireAuth();
    $rows = DB::all("SELECT * FROM banks WHERE tenant_id=? AND deleted_at IS NULL ORDER BY account_name",[$auth['tenant_id']]);
    ok($rows);
});

route('GET','/banks/:id', function($p) {
    $auth = requireAuth();
    $row  = DB::one("SELECT * FROM banks WHERE id=? AND tenant_id=?",[$p['id'],$auth['tenant_id']]);
    if (!$row) err(404,'NOT_FOUND','Bank not found');
    ok($row);
});

route('POST','/banks', function() {
    $auth = requireAuth();
    $tid  = $auth['tenant_id'];
    $b    = json_decode(file_get_contents('php://input'), true) ?? [];
    validate($b,['account_name']);
    $id = uuid();
    DB::run("INSERT INTO banks(id,tenant_id,firm_id,account_no,account_name,bank_name,branch,ifsc,opening_balance,remarks)
             VALUES(?,?,?,?,?,?,?,?,?,?)",
        [$id,$tid,$b['firm_id']??($auth['firm_id']??null),n($b['account_no']??null),trim($b['account_name']),
         n($b['bank_name']??null),n($b['branch']??null),n($b['ifsc']??null),
         (float)($b['opening_balance']??0),n($b['remarks']??null)]);
    ok(DB::one("SELECT * FROM banks WHERE id=?",[$id]), 201);
});

route('PUT','/banks/:id', function($p) {
    $auth = requireAuth();
    $b    = json_decode(file_get_contents('php://input'), true) ?? [];
    DB::run("UPDATE banks SET account_no=?,account_name=?,bank_name=?,branch=?,ifsc=?,opening_balance=?,remarks=?,updated_at=NOW()
             WHERE id=? AND tenant_id=?",
        [n($b['account_no']??null),trim($b['account_name']??''),n($b['bank_name']??null),n($b['branch']??null),
         n($b['ifsc']??null),(float)($b['opening_balance']??0),n($b['remarks']??null),$p['id'],$auth['tenant_id']]);
    ok(DB::one("SELECT * FROM banks WHERE id=?",[$p['id']]));
});

route('DELETE','/banks/:id', function($p) {
    $auth = requireAuth();
    DB::run("UPDATE banks SET deleted_at=NOW() WHERE id=? AND tenant_id=?",[$p['id'],$auth['tenant_id']]);
    ok(['deleted'=>true]);
});

// GET /banks/:id/balance  — computed from payments + opening
route('GET','/banks/:id/balance', function($p) {
    $auth = requireAuth();
    $bank = DB::one("SELECT * FROM banks WHERE id=? AND tenant_id=?",[$p['id'],$auth['tenant_id']]);
    if (!$bank) err(404,'NOT_FOUND','Bank not found');
    $inAmt  = DB::count("SELECT COALESCE(SUM(amount),0) FROM payments WHERE bank_id=? AND direction='in'",[$p['id']]);
    $outAmt = DB::count("SELECT COALESCE(SUM(amount),0) FROM payments WHERE bank_id=? AND direction='out'",[$p['id']]);
    ok(['bank'=>$bank,'balance'=>(float)$bank['opening_balance'] + $inAmt - $outAmt]);
});

// ── Cheques ───────────────────────────────────────────────────

route('GET','/cheques', function() {
    $auth = requireAuth();
    $tid  = $auth['tenant_id'];
    [$page,$perPage,$offset] = pagParams();
    $where = 'c.tenant_id=?';
    $params = [$tid];
    if (!empty($_GET['status']))    { $where .= ' AND c.status=?';    $params[] = $_GET['status'];    }
    if (!empty($_GET['direction'])) { $where .= ' AND c.direction=?'; $params[] = $_GET['direction']; }
    [$rows,$total] = DB::paginate(
        "SELECT COUNT(*) FROM cheques c WHERE $where",
        "SELECT c.*,p.name as party_name,b.account_name as bank_name FROM cheques c
         LEFT JOIN parties p ON p.id=c.party_id
         LEFT JOIN banks b ON b.id=c.bank_id
         WHERE $where ORDER BY c.due_date DESC",
        $params, $perPage, $offset
    );
    paginated($rows, $total, $page, $perPage);
});

route('POST','/cheques', function() {
    $auth = requireAuth();
    $tid  = $auth['tenant_id'];
    $b    = json_decode(file_get_contents('php://input'), true) ?? [];
    validate($b,['amount','direction']);
    $id = uuid();
    DB::run("INSERT INTO cheques(id,tenant_id,bank_id,party_id,cheque_no,amount,direction,status,due_date)
             VALUES(?,?,?,?,?,?,?,?,?)",
        [$id,$tid,n($b['bank_id']??null),n($b['party_id']??null),n($b['cheque_no']??null),
         (float)$b['amount'],$b['direction'],$b['status']??'open',n($b['due_date']??null)]);
    ok(DB::one("SELECT * FROM cheques WHERE id=?",[$id]), 201);
});

route('PUT','/cheques/:id', function($p) {
    $auth = requireAuth();
    $b    = json_decode(file_get_contents('php://input'), true) ?? [];
    DB::run("UPDATE cheques SET status=?,updated_at=NOW() WHERE id=? AND tenant_id=?",
        [$b['status']??'open',$p['id'],$auth['tenant_id']]);
    ok(DB::one("SELECT * FROM cheques WHERE id=?",[$p['id']]));
});

route('DELETE','/cheques/:id', function($p) {
    $auth = requireAuth();
    DB::run("DELETE FROM cheques WHERE id=? AND tenant_id=?",[$p['id'],$auth['tenant_id']]);
    ok(['deleted'=>true]);
});

// ── Vouchers ──────────────────────────────────────────────────

route('GET','/vouchers', function() {
    $auth = requireAuth();
    $tid  = $auth['tenant_id'];
    [$page,$perPage,$offset] = pagParams();
    [$rows,$total] = DB::paginate(
        "SELECT COUNT(*) FROM vouchers WHERE tenant_id=? AND deleted_at IS NULL",
        "SELECT * FROM vouchers WHERE tenant_id=? AND deleted_at IS NULL ORDER BY voucher_date DESC",
        [$tid], $perPage, $offset
    );
    paginated($rows, $total, $page, $perPage);
});

route('POST','/vouchers', function() {
    $auth = requireAuth();
    $tid  = $auth['tenant_id'];
    $b    = json_decode(file_get_contents('php://input'), true) ?? [];
    validate($b,['voucher_type','amount']);
    $id = uuid();
    DB::run("INSERT INTO vouchers(id,tenant_id,firm_id,voucher_type,voucher_no,voucher_date,narration,amount)
             VALUES(?,?,?,?,?,?,?,?)",
        [$id,$tid,$b['firm_id']??($auth['firm_id']??null),$b['voucher_type'],
         n($b['voucher_no']??null),$b['voucher_date']??date('Y-m-d'),
         n($b['narration']??null),(float)$b['amount']]);
    ok(DB::one("SELECT * FROM vouchers WHERE id=?",[$id]), 201);
});

route('DELETE','/vouchers/:id', function($p) {
    $auth = requireAuth();
    DB::run("UPDATE vouchers SET deleted_at=NOW() WHERE id=? AND tenant_id=?",[$p['id'],$auth['tenant_id']]);
    ok(['deleted'=>true]);
});

// ── Payments (general ledger view) ────────────────────────────

route('GET','/payments', function() {
    $auth = requireAuth();
    $tid  = $auth['tenant_id'];
    [$page,$perPage,$offset] = pagParams();
    $where  = 'pm.tenant_id=?';
    $params = [$tid];
    if (!empty($_GET['direction'])) { $where .= ' AND pm.direction=?'; $params[] = $_GET['direction']; }
    if (!empty($_GET['from']))      { $where .= ' AND pm.pay_date>=?'; $params[] = $_GET['from'];       }
    if (!empty($_GET['to']))        { $where .= ' AND pm.pay_date<=?'; $params[] = $_GET['to'];         }
    [$rows,$total] = DB::paginate(
        "SELECT COUNT(*) FROM payments pm WHERE $where",
        "SELECT pm.*,p.name as party_name FROM payments pm
         LEFT JOIN parties p ON p.id=pm.party_id
         WHERE $where ORDER BY pm.pay_date DESC,pm.created_at DESC",
        $params, $perPage, $offset
    );
    paginated($rows, $total, $page, $perPage);
});
