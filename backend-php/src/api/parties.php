<?php
// ── Party Groups ──────────────────────────────────────────────

route('GET','/party-groups', function() {
    $auth = requireAuth();
    ok(DB::all("SELECT * FROM party_groups WHERE tenant_id=? ORDER BY name",[$auth['tenant_id']]));
});

route('POST','/party-groups', function() {
    $auth = requireAuth();
    $b    = json_decode(file_get_contents('php://input'), true) ?? [];
    validate($b,['name']);
    $id = uuid();
    DB::run("INSERT INTO party_groups(id,tenant_id,name) VALUES(?,?,?)",[$id,$auth['tenant_id'],trim($b['name'])]);
    ok(DB::one("SELECT * FROM party_groups WHERE id=?",[$id]), 201);
});

route('DELETE','/party-groups/:id', function($p) {
    $auth = requireAuth();
    DB::run("DELETE FROM party_groups WHERE id=? AND tenant_id=?",[$p['id'],$auth['tenant_id']]);
    ok(['deleted'=>true]);
});

// ── Parties ───────────────────────────────────────────────────

route('GET','/parties', function() {
    $auth = requireAuth();
    $tid  = $auth['tenant_id'];
    [$page,$perPage,$offset] = pagParams();

    $where  = 'p.tenant_id=? AND p.deleted_at IS NULL';
    $params = [$tid];
    $search = trim($_GET['search'] ?? '');
    $role   = $_GET['role'] ?? null;

    if ($search) { $where .= ' AND (p.name LIKE ? OR p.phone LIKE ?)'; $params[] = "%$search%"; $params[] = "%$search%"; }
    if ($role)   { $where .= ' AND p.role=?'; $params[] = $role; }

    [$rows,$total] = DB::paginate(
        "SELECT COUNT(*) FROM parties p WHERE $where",
        "SELECT p.*,
                COALESCE(pb.receivable,0) as receivable,
                COALESCE(pb.payable,0) as payable,
                COALESCE(pb.points,0) as loyalty_points
         FROM parties p
         LEFT JOIN party_balances pb ON pb.party_id=p.id
         WHERE $where ORDER BY p.name",
        $params, $perPage, $offset
    );
    paginated($rows, $total, $page, $perPage);
});

route('GET','/parties/:id', function($p) {
    $auth  = requireAuth();
    $party = DB::one(
        "SELECT p.*,
                COALESCE(pb.receivable,0) as receivable,
                COALESCE(pb.payable,0) as payable,
                COALESCE(pb.points,0) as loyalty_points
         FROM parties p
         LEFT JOIN party_balances pb ON pb.party_id=p.id
         WHERE p.id=? AND p.tenant_id=? AND p.deleted_at IS NULL",
        [$p['id'],$auth['tenant_id']]
    );
    if (!$party) err(404,'NOT_FOUND','Party not found');
    ok($party);
});

route('POST','/parties', function() {
    $auth = requireAuth();
    $tid  = $auth['tenant_id'];
    $b    = json_decode(file_get_contents('php://input'), true) ?? [];
    validate($b,['name']);
    $id = uuid();
    DB::beginTransaction();
    try {
        DB::run("INSERT INTO parties(id,tenant_id,role,name,gstin,gst_type,phone,email,
                    billing_address,shipping_address,area,city,state,state_code,
                    party_group_id,customer_type,opening_balance,credit_limit,due_days,loyalty_card)
                 VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            [$id,$tid,$b['role']??'customer',trim($b['name']),n($b['gstin']??null),$b['gst_type']??'consumer',
             n($b['phone']??null),n($b['email']??null),n($b['billing_address']??null),n($b['shipping_address']??null),
             n($b['area']??null),n($b['city']??null),n($b['state']??null),n($b['state_code']??null),
             n($b['party_group_id']??null),n($b['customer_type']??null),(float)($b['opening_balance']??0),
             nf($b['credit_limit']??null),ni($b['due_days']??null),n($b['loyalty_card']??null)]);

        DB::run("INSERT INTO party_balances(id,tenant_id,party_id,receivable,payable,points) VALUES(?,?,?,0,0,0)",
            [uuid(),$tid,$id]);
        DB::commit();
    } catch (\Exception $e) { DB::rollback(); err(500,'DB_ERROR',$e->getMessage()); }
    ok(DB::one("SELECT * FROM parties WHERE id=?",[$id]), 201);
});

route('PUT','/parties/:id', function($p) {
    $auth = requireAuth();
    $b    = json_decode(file_get_contents('php://input'), true) ?? [];
    DB::run("UPDATE parties SET role=?,name=?,gstin=?,gst_type=?,phone=?,email=?,
                billing_address=?,shipping_address=?,area=?,city=?,state=?,state_code=?,
                party_group_id=?,customer_type=?,credit_limit=?,due_days=?,loyalty_card=?,updated_at=NOW()
             WHERE id=? AND tenant_id=?",
        [$b['role']??'customer',trim($b['name']??''),n($b['gstin']??null),$b['gst_type']??'consumer',
         n($b['phone']??null),n($b['email']??null),n($b['billing_address']??null),n($b['shipping_address']??null),
         n($b['area']??null),n($b['city']??null),n($b['state']??null),n($b['state_code']??null),
         n($b['party_group_id']??null),n($b['customer_type']??null),nf($b['credit_limit']??null),
         ni($b['due_days']??null),n($b['loyalty_card']??null),$p['id'],$auth['tenant_id']]);
    ok(DB::one("SELECT * FROM parties WHERE id=?",[$p['id']]));
});

route('DELETE','/parties/:id', function($p) {
    $auth = requireAuth();
    DB::run("UPDATE parties SET deleted_at=NOW() WHERE id=? AND tenant_id=?",[$p['id'],$auth['tenant_id']]);
    ok(['deleted'=>true]);
});

// GET /parties/:id/statement  — ledger of sales + purchases + payments
route('GET','/parties/:id/statement', function($p) {
    $auth = requireAuth();
    $tid  = $auth['tenant_id'];
    $from = $_GET['from'] ?? date('Y-m-01');
    $to   = $_GET['to']   ?? date('Y-m-d');

    $sales = DB::all(
        "SELECT doc_date as date, doc_no as ref, 'Invoice' as type, total as debit, 0 as credit, status
         FROM sale_documents WHERE party_id=? AND tenant_id=? AND deleted_at IS NULL
         AND doc_date BETWEEN ? AND ? ORDER BY doc_date",
        [$p['id'],$tid,$from,$to]
    );
    $purchases = DB::all(
        "SELECT doc_date as date, doc_no as ref, 'Purchase' as type, 0 as debit, total as credit, status
         FROM purchase_documents WHERE party_id=? AND tenant_id=? AND deleted_at IS NULL
         AND doc_date BETWEEN ? AND ? ORDER BY doc_date",
        [$p['id'],$tid,$from,$to]
    );
    $payments = DB::all(
        "SELECT pay_date as date, reference as ref, IF(direction='in','Receipt','Payment') as type,
                IF(direction='out',amount,0) as debit, IF(direction='in',amount,0) as credit, 'paid' as status
         FROM payments WHERE party_id=? AND tenant_id=? AND pay_date BETWEEN ? AND ? ORDER BY pay_date",
        [$p['id'],$tid,$from,$to]
    );

    $ledger = array_merge($sales, $purchases, $payments);
    usort($ledger, fn($a,$b) => strcmp($a['date'],$b['date']));

    $balance = 0;
    foreach ($ledger as &$row) {
        $balance += (float)$row['debit'] - (float)$row['credit'];
        $row['balance'] = $balance;
    }
    ok(['items'=>$ledger,'closing_balance'=>$balance]);
});
