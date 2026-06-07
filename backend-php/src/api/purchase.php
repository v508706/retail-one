<?php
// ── Purchases ─────────────────────────────────────────────────

route('GET','/purchases', function() {
    $auth = requireAuth();
    $tid  = $auth['tenant_id'];
    [$page,$perPage,$offset] = pagParams();

    $where  = 'pd.tenant_id=? AND pd.deleted_at IS NULL';
    $params = [$tid];

    if (!empty($_GET['doc_type'])) { $where .= ' AND pd.doc_type=?';   $params[] = $_GET['doc_type']; }
    if (!empty($_GET['party_id'])) { $where .= ' AND pd.party_id=?';   $params[] = $_GET['party_id']; }
    if (!empty($_GET['status']))   { $where .= ' AND pd.status=?';     $params[] = $_GET['status'];   }
    if (!empty($_GET['from']))     { $where .= ' AND pd.doc_date>=?';  $params[] = $_GET['from'];     }
    if (!empty($_GET['to']))       { $where .= ' AND pd.doc_date<=?';  $params[] = $_GET['to'];       }

    [$rows,$total] = DB::paginate(
        "SELECT COUNT(*) FROM purchase_documents pd WHERE $where",
        "SELECT pd.*,p.name as party_name FROM purchase_documents pd
         LEFT JOIN parties p ON p.id=pd.party_id
         WHERE $where ORDER BY pd.doc_date DESC",
        $params, $perPage, $offset
    );
    paginated($rows, $total, $page, $perPage);
});

route('GET','/purchases/:id', function($p) {
    $auth = requireAuth();
    $doc  = DB::one(
        "SELECT pd.*,pa.name as party_name FROM purchase_documents pd
         LEFT JOIN parties pa ON pa.id=pd.party_id
         WHERE pd.id=? AND pd.tenant_id=? AND pd.deleted_at IS NULL",
        [$p['id'],$auth['tenant_id']]
    );
    if (!$doc) err(404,'NOT_FOUND','Purchase not found');
    $doc['items']    = DB::all("SELECT * FROM purchase_document_items WHERE document_id=?",[$p['id']]);
    $doc['payments'] = DB::all("SELECT * FROM payments WHERE doc_id=? ORDER BY pay_date",[$p['id']]);
    ok($doc);
});

route('POST','/purchases', function() {
    $auth = requireAuth();
    $tid  = $auth['tenant_id'];
    $b    = json_decode(file_get_contents('php://input'), true) ?? [];
    validate($b,['items']);
    if (empty($b['items'])) err(422,'VALIDATION_FAILED','items cannot be empty');

    $firmId  = $b['firm_id'] ?? ($auth['firm_id'] ?? null);
    $docType = $b['doc_type'] ?? 'purchase';

    DB::beginTransaction();
    try {
        $seq = DB::one(
            "SELECT * FROM document_sequences WHERE tenant_id=? AND firm_id=? AND doc_type='purchase' FOR UPDATE",
            [$tid,$firmId]
        );
        $docNo = $seq ? $seq['prefix'].str_pad($seq['next_no'],4,'0',STR_PAD_LEFT) : 'PUR-0001';
        if ($seq) DB::run("UPDATE document_sequences SET next_no=next_no+1 WHERE id=?",[$seq['id']]);

        $subTotal = $discAmt = $taxAmt = 0;
        foreach ($b['items'] as $it) {
            $qty  = (float)($it['qty']??1);
            $price= (float)($it['price_unit']??0);
            $disc = (float)($it['discount_amt']??0);
            $tax  = (float)($it['tax_pct']??0);
            $afterDisc = $qty * $price - $disc;
            $tAmt = round($afterDisc * $tax / 100, 4);
            $lineTotal = $afterDisc + $tAmt;
            $it['_line_total'] = $lineTotal;
            $it['_tax_amt']    = $tAmt;
            $subTotal += $qty * $price;
            $discAmt  += $disc;
            $taxAmt   += $tAmt;
        }
        $total = $subTotal - $discAmt + $taxAmt + (float)($b['round_off']??0);

        $id = uuid();
        DB::run("INSERT INTO purchase_documents(id,tenant_id,firm_id,doc_type,doc_no,doc_date,party_id,grn_no,
                    sub_total,discount_amt,tax_amt,round_off,total,paid_amt,balance_amt,status)
                 VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?)",
            [$id,$tid,$firmId,$docType,$docNo,$b['doc_date']??date('Y-m-d'),n($b['party_id']??null),
             n($b['grn_no']??null),$subTotal,$discAmt,$taxAmt,(float)($b['round_off']??0),$total,$total,'open']);

        foreach ($b['items'] as $it) {
            $iid = n($it['id']??null) ?? n($it['item_id']??null);
            DB::run("INSERT INTO purchase_document_items(id,tenant_id,document_id,item_id,item_name,hsn_sac,
                        qty,unit,price_unit,discount_amt,tax_pct,tax_amt,line_total,mrp,sale_price)
                     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                [uuid(),$tid,$id,$iid,$it['item_name']??($it['name']??''),n($it['hsn_sac']??null),
                 (float)($it['qty']??1),n($it['unit']??null),(float)($it['price_unit']??0),
                 (float)($it['discount_amt']??0),(float)($it['tax_pct']??0),$it['_tax_amt']??0,$it['_line_total']??0,
                 nf($it['mrp']??null),nf($it['sale_price']??null)]);

            if ($docType === 'purchase' && $iid) {
                $qty = (float)($it['qty']??1);
                DB::run("INSERT INTO stock_movements(id,tenant_id,item_id,movement_type,qty,rate,ref_doc_type,ref_doc_id,moved_at)
                         VALUES(?,?,?,'purchase',?,?,'purchase',?,NOW())",
                    [uuid(),$tid,$iid,$qty,(float)($it['price_unit']??0),$id]);
                // Update purchase price on item
                DB::run("UPDATE item_prices SET purchase_price=?,updated_at=NOW() WHERE item_id=? AND tenant_id=?",
                    [(float)($it['price_unit']??0),$iid,$tid]);
            }
        }

        // Inline payment
        if (!empty($b['payment']) && (float)($b['payment']['amount']??0) > 0) {
            $paid = (float)$b['payment']['amount'];
            DB::run("INSERT INTO payments(id,tenant_id,firm_id,party_id,direction,doc_id,doc_type,pay_mode,amount,pay_date)
                     VALUES(?,?,?,?,'out',?,?,?,?,?)",
                [uuid(),$tid,$firmId,n($b['party_id']??null),$id,$docType,$b['payment']['pay_mode']??'cash',$paid,$b['doc_date']??date('Y-m-d')]);
            $balance = max(0,$total - $paid);
            DB::run("UPDATE purchase_documents SET paid_amt=?,balance_amt=?,status=? WHERE id=?",
                [$paid,$balance,($balance==0?'paid':'partial'),$id]);
        }

        DB::commit();
    } catch (\Exception $e) { DB::rollback(); err(500,'DB_ERROR',$e->getMessage()); }

    $doc = DB::one("SELECT * FROM purchase_documents WHERE id=?",[$id]);
    $doc['items'] = DB::all("SELECT * FROM purchase_document_items WHERE document_id=?",[$id]);
    ok($doc, 201);
});

route('POST','/purchases/:id/payment', function($p) {
    $auth = requireAuth();
    $tid  = $auth['tenant_id'];
    $b    = json_decode(file_get_contents('php://input'), true) ?? [];
    validate($b,['amount']);

    $doc = DB::one("SELECT * FROM purchase_documents WHERE id=? AND tenant_id=?",[$p['id'],$tid]);
    if (!$doc) err(404,'NOT_FOUND','Purchase not found');

    $paid    = (float)$doc['paid_amt'] + (float)$b['amount'];
    $balance = max(0,(float)$doc['total'] - $paid);
    $status  = $balance == 0 ? 'paid' : 'partial';

    DB::beginTransaction();
    try {
        DB::run("INSERT INTO payments(id,tenant_id,firm_id,party_id,direction,doc_id,doc_type,pay_mode,amount,pay_date)
                 VALUES(?,?,?,?,'out',?,'purchase',?,?,?)",
            [uuid(),$tid,$doc['firm_id'],$doc['party_id'],$p['id'],
             $b['pay_mode']??'cash',(float)$b['amount'],$b['pay_date']??date('Y-m-d')]);
        DB::run("UPDATE purchase_documents SET paid_amt=?,balance_amt=?,status=? WHERE id=?",[$paid,$balance,$status,$p['id']]);
        DB::commit();
    } catch (\Exception $e) { DB::rollback(); err(500,'DB_ERROR',$e->getMessage()); }
    ok(DB::one("SELECT * FROM purchase_documents WHERE id=?",[$p['id']]));
});

route('POST','/purchases/:id/cancel', function($p) {
    $auth = requireAuth();
    $doc  = DB::one("SELECT * FROM purchase_documents WHERE id=? AND tenant_id=?",[$p['id'],$auth['tenant_id']]);
    if (!$doc) err(404,'NOT_FOUND','Purchase not found');
    DB::beginTransaction();
    try {
        DB::run("UPDATE purchase_documents SET status='cancelled' WHERE id=?",[$p['id']]);
        if ($doc['doc_type'] === 'purchase') {
            $items = DB::all("SELECT * FROM purchase_document_items WHERE document_id=?",[$p['id']]);
            foreach ($items as $it) {
                if ($it['item_id']) {
                    DB::run("INSERT INTO stock_movements(id,tenant_id,item_id,movement_type,qty,rate,ref_doc_type,ref_doc_id,moved_at)
                             VALUES(?,?,?,'return_out',?,?,'purchase_cancel',?,NOW())",
                        [uuid(),$auth['tenant_id'],$it['item_id'],-abs($it['qty']),$it['price_unit'],$p['id']]);
                }
            }
        }
        DB::commit();
    } catch (\Exception $e) { DB::rollback(); err(500,'DB_ERROR',$e->getMessage()); }
    ok(['cancelled'=>true]);
});

// ── Expenses ──────────────────────────────────────────────────

route('GET','/expenses', function() {
    $auth = requireAuth();
    $tid  = $auth['tenant_id'];
    [$page,$perPage,$offset] = pagParams();
    $where = 'tenant_id=? AND deleted_at IS NULL';
    $params = [$tid];
    if (!empty($_GET['from'])) { $where .= ' AND exp_date>=?'; $params[] = $_GET['from']; }
    if (!empty($_GET['to']))   { $where .= ' AND exp_date<=?'; $params[] = $_GET['to'];   }
    [$rows,$total] = DB::paginate(
        "SELECT COUNT(*) FROM expenses WHERE $where",
        "SELECT * FROM expenses WHERE $where ORDER BY exp_date DESC",
        $params, $perPage, $offset
    );
    paginated($rows, $total, $page, $perPage);
});

route('GET','/expenses/:id', function($p) {
    $auth = requireAuth();
    $row  = DB::one("SELECT * FROM expenses WHERE id=? AND tenant_id=?",[$p['id'],$auth['tenant_id']]);
    if (!$row) err(404,'NOT_FOUND','Expense not found');
    ok($row);
});

route('POST','/expenses', function() {
    $auth = requireAuth();
    $tid  = $auth['tenant_id'];
    $b    = json_decode(file_get_contents('php://input'), true) ?? [];
    validate($b,['amount']);
    $id = uuid();
    DB::run("INSERT INTO expenses(id,tenant_id,firm_id,category,amount,tax_amt,exp_date,party_id,pay_mode,notes)
             VALUES(?,?,?,?,?,?,?,?,?,?)",
        [$id,$tid,$b['firm_id']??($auth['firm_id']??null),n($b['category']??null),
         (float)$b['amount'],(float)($b['tax_amt']??0),$b['exp_date']??date('Y-m-d'),
         n($b['party_id']??null),$b['pay_mode']??'cash',n($b['notes']??null)]);
    ok(DB::one("SELECT * FROM expenses WHERE id=?",[$id]), 201);
});

route('PUT','/expenses/:id', function($p) {
    $auth = requireAuth();
    $b    = json_decode(file_get_contents('php://input'), true) ?? [];
    DB::run("UPDATE expenses SET category=?,amount=?,tax_amt=?,exp_date=?,pay_mode=?,notes=?,updated_at=NOW()
             WHERE id=? AND tenant_id=?",
        [n($b['category']??null),(float)($b['amount']??0),(float)($b['tax_amt']??0),
         $b['exp_date']??date('Y-m-d'),$b['pay_mode']??'cash',n($b['notes']??null),
         $p['id'],$auth['tenant_id']]);
    ok(DB::one("SELECT * FROM expenses WHERE id=?",[$p['id']]));
});

route('DELETE','/expenses/:id', function($p) {
    $auth = requireAuth();
    DB::run("UPDATE expenses SET deleted_at=NOW() WHERE id=? AND tenant_id=?",[$p['id'],$auth['tenant_id']]);
    ok(['deleted'=>true]);
});

// ── Purchase Orders ───────────────────────────────────────────

route('GET','/purchase-orders', function() {
    $auth = requireAuth();
    $tid  = $auth['tenant_id'];
    [$page,$perPage,$offset] = pagParams();
    [$rows,$total] = DB::paginate(
        "SELECT COUNT(*) FROM purchase_orders WHERE tenant_id=? AND deleted_at IS NULL",
        "SELECT po.*,p.name as party_name FROM purchase_orders po
         LEFT JOIN parties p ON p.id=po.party_id
         WHERE po.tenant_id=? AND po.deleted_at IS NULL ORDER BY po.po_date DESC",
        [$tid], $perPage, $offset
    );
    paginated($rows, $total, $page, $perPage);
});

route('POST','/purchase-orders', function() {
    $auth = requireAuth();
    $tid  = $auth['tenant_id'];
    $b    = json_decode(file_get_contents('php://input'), true) ?? [];
    $id   = uuid();
    DB::run("INSERT INTO purchase_orders(id,tenant_id,firm_id,po_date,due_date,party_id,status,total,items)
             VALUES(?,?,?,?,?,?,?,?,?)",
        [$id,$tid,$b['firm_id']??null,$b['po_date']??date('Y-m-d'),n($b['due_date']??null),
         n($b['party_id']??null),$b['status']??'draft',(float)($b['total']??0),
         json_encode($b['items']??[])]);
    ok(DB::one("SELECT * FROM purchase_orders WHERE id=?",[$id]), 201);
});

route('PUT','/purchase-orders/:id', function($p) {
    $auth = requireAuth();
    $b    = json_decode(file_get_contents('php://input'), true) ?? [];
    DB::run("UPDATE purchase_orders SET status=?,items=?,updated_at=NOW() WHERE id=? AND tenant_id=?",
        [$b['status']??'draft',json_encode($b['items']??[]),$p['id'],$auth['tenant_id']]);
    ok(DB::one("SELECT * FROM purchase_orders WHERE id=?",[$p['id']]));
});

route('DELETE','/purchase-orders/:id', function($p) {
    $auth = requireAuth();
    DB::run("UPDATE purchase_orders SET deleted_at=NOW() WHERE id=? AND tenant_id=?",[$p['id'],$auth['tenant_id']]);
    ok(['deleted'=>true]);
});
