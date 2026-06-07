<?php
// ── Sale Documents ────────────────────────────────────────────

route('GET','/sales', function() {
    $auth = requireAuth();
    $tid  = $auth['tenant_id'];
    [$page,$perPage,$offset] = pagParams();

    $where  = 'sd.tenant_id=? AND sd.deleted_at IS NULL';
    $params = [$tid];

    if (!empty($_GET['doc_type']))  { $where .= ' AND sd.doc_type=?';        $params[] = $_GET['doc_type']; }
    if (!empty($_GET['status']))    { $where .= ' AND sd.status=?';          $params[] = $_GET['status'];   }
    if (!empty($_GET['party_id']))  { $where .= ' AND sd.party_id=?';        $params[] = $_GET['party_id']; }
    if (!empty($_GET['from']))      { $where .= ' AND sd.doc_date>=?';       $params[] = $_GET['from'];     }
    if (!empty($_GET['to']))        { $where .= ' AND sd.doc_date<=?';       $params[] = $_GET['to'];       }
    if (!empty($_GET['search']))    { $where .= ' AND sd.doc_no LIKE ?';     $params[] = '%'.$_GET['search'].'%'; }

    [$rows,$total] = DB::paginate(
        "SELECT COUNT(*) FROM sale_documents sd WHERE $where",
        "SELECT sd.*,p.name as party_name
         FROM sale_documents sd
         LEFT JOIN parties p ON p.id=sd.party_id
         WHERE $where ORDER BY sd.doc_date DESC, sd.created_at DESC",
        $params, $perPage, $offset
    );
    paginated($rows, $total, $page, $perPage);
});

route('GET','/sales/:id', function($p) {
    $auth = requireAuth();
    $doc  = DB::one(
        "SELECT sd.*,pa.name as party_name,pa.gstin as party_gstin,pa.phone as party_phone,
                pa.billing_address,f.name as firm_name,f.gstin as firm_gstin,f.address as firm_address
         FROM sale_documents sd
         LEFT JOIN parties pa ON pa.id=sd.party_id
         LEFT JOIN firms f ON f.id=sd.firm_id
         WHERE sd.id=? AND sd.tenant_id=? AND sd.deleted_at IS NULL",
        [$p['id'],$auth['tenant_id']]
    );
    if (!$doc) err(404,'NOT_FOUND','Sale not found');
    $doc['items']    = DB::all("SELECT * FROM sale_document_items WHERE document_id=?",[$p['id']]);
    $doc['payments'] = DB::all("SELECT * FROM payments WHERE doc_id=? ORDER BY pay_date",[$p['id']]);
    ok($doc);
});

route('POST','/sales', function() {
    $auth = requireAuth();
    $tid  = $auth['tenant_id'];
    $b    = json_decode(file_get_contents('php://input'), true) ?? [];
    validate($b,['doc_type','items']);
    if (empty($b['items'])) err(422,'VALIDATION_FAILED','items cannot be empty');

    $firmId = $b['firm_id'] ?? ($auth['firm_id'] ?? null);
    $docType = $b['doc_type'];

    DB::beginTransaction();
    try {
        // Generate doc_no
        $seq = DB::one(
            "SELECT * FROM document_sequences WHERE tenant_id=? AND firm_id=? AND doc_type=? FOR UPDATE",
            [$tid,$firmId,$docType]
        );
        $docNo = ($seq ? $seq['prefix'].str_pad($seq['next_no'],4,'0',STR_PAD_LEFT) : strtoupper($docType).'-0001');
        if ($seq) DB::run("UPDATE document_sequences SET next_no=next_no+1 WHERE id=?",[$seq['id']]);

        // Process items & totals
        $lineItems = [];
        foreach ($b['items'] as $it) {
            $priceTaxIncl = nb($it['price_tax_incl'] ?? 0);
            [$discAmt,$taxAmt,$lineTotal] = array_values(calcLineTotal(
                (float)($it['price_unit']??0),(float)($it['qty']??1),
                (float)($it['discount_pct']??0),(float)($it['discount_amt']??0),
                (float)($it['tax_pct']??0),$priceTaxIncl
            ));
            [$cgst,$sgst,$igst] = array_values(calcGSTSplit((float)($it['tax_pct']??0),$taxAmt));
            $lineItems[] = array_merge($it,[
                'discount_amt'=>$discAmt,'tax_amt'=>$taxAmt,'line_total'=>$lineTotal,
                'cgst'=>$cgst,'sgst'=>$sgst,'igst'=>$igst,'price_tax_incl'=>$priceTaxIncl,
            ]);
        }
        $totals = calcDocTotals($lineItems);
        $total  = $totals['sub_total'] - $totals['discount_amt'] + $totals['tax_amt']
                + (float)($b['other_charges']??0) + (float)($b['round_off']??0);

        $id = uuid();
        DB::run("INSERT INTO sale_documents(id,tenant_id,firm_id,store_id,terminal_id,doc_type,doc_no,doc_date,due_date,
                    party_id,state_of_supply,ref_no,orig_doc_id,price_type,sub_total,discount_amt,tax_amt,
                    other_charges,round_off,total,paid_amt,balance_amt,status,notes,terms,created_by)
                 VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            [$id,$tid,$firmId,n($b['store_id']??null),n($b['terminal_id']??null),
             $docType,$docNo,$b['doc_date']??date('Y-m-d'),n($b['due_date']??null),
             n($b['party_id']??null),n($b['state_of_supply']??null),n($b['ref_no']??null),n($b['orig_doc_id']??null),
             $b['price_type']??'retail',$totals['sub_total'],$totals['discount_amt'],$totals['tax_amt'],
             (float)($b['other_charges']??0),(float)($b['round_off']??0),$total,
             0,$total,'open',n($b['notes']??null),n($b['terms']??null),$auth['sub']??null]);

        foreach ($lineItems as $it) {
            $iid = n($it['id']??null) ?? n($it['item_id']??null);
            DB::run("INSERT INTO sale_document_items(id,tenant_id,document_id,item_id,item_name,hsn_sac,description,
                        qty,unit,price_unit,price_tax_incl,discount_pct,discount_amt,tax_pct,tax_amt,
                        cgst,sgst,igst,cess,line_total,cost_rate)
                     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                [uuid(),$tid,$id,$iid,
                 $it['item_name']??($it['name']??''),n($it['hsn_sac']??null),n($it['description']??null),
                 (float)($it['qty']??1),n($it['unit']??null),(float)($it['price_unit']??0),
                 $it['price_tax_incl'],(float)($it['discount_pct']??0),$it['discount_amt'],
                 (float)($it['tax_pct']??0),$it['tax_amt'],$it['cgst'],$it['sgst'],$it['igst'],0,$it['line_total'],
                 nf($it['cost_rate']??null)]);

            // Stock movement for invoice / pos
            if (in_array($docType,['invoice','pos']) && $iid) {
                DB::run("INSERT INTO stock_movements(id,tenant_id,item_id,movement_type,qty,rate,ref_doc_type,ref_doc_id,moved_at)
                         VALUES(?,?,?,'sale',?,?,'sale',?,NOW())",
                    [uuid(),$tid,$iid, -(float)($it['qty']??1),(float)($it['price_unit']??0),$id]);
            }
        }

        // Inline payment
        if (!empty($b['payment']) && (float)($b['payment']['amount']??0) > 0) {
            $paid = (float)$b['payment']['amount'];
            DB::run("INSERT INTO payments(id,tenant_id,firm_id,party_id,direction,doc_id,doc_type,pay_mode,amount,pay_date,reference)
                     VALUES(?,?,?,?,'in',?,?,?,?,?,?)",
                [uuid(),$tid,$firmId,n($b['party_id']??null),$id,$docType,
                 $b['payment']['pay_mode']??'cash',$paid,$b['doc_date']??date('Y-m-d'),n($b['payment']['reference']??null)]);
            $balance = max(0,$total - $paid);
            $status  = $balance == 0 ? 'paid' : ($paid > 0 ? 'partial' : 'open');
            DB::run("UPDATE sale_documents SET paid_amt=?,balance_amt=?,status=? WHERE id=?",[$paid,$balance,$status,$id]);
        }

        DB::commit();
    } catch (\Exception $e) { DB::rollback(); err(500,'DB_ERROR',$e->getMessage()); }

    $doc = DB::one("SELECT * FROM sale_documents WHERE id=?",[$id]);
    $doc['items'] = DB::all("SELECT * FROM sale_document_items WHERE document_id=?",[$id]);
    ok($doc, 201);
});

// POST /sales/:id/payment
route('POST','/sales/:id/payment', function($p) {
    $auth = requireAuth();
    $tid  = $auth['tenant_id'];
    $b    = json_decode(file_get_contents('php://input'), true) ?? [];
    validate($b,['amount']);

    $doc = DB::one("SELECT * FROM sale_documents WHERE id=? AND tenant_id=? AND deleted_at IS NULL",[$p['id'],$tid]);
    if (!$doc) err(404,'NOT_FOUND','Sale not found');
    if ($doc['status'] === 'cancelled') err(400,'CANCELLED','Cannot add payment to cancelled document');

    $paid = (float)$doc['paid_amt'] + (float)$b['amount'];
    $balance = max(0,(float)$doc['total'] - $paid);
    $status  = $balance == 0 ? 'paid' : 'partial';

    DB::beginTransaction();
    try {
        DB::run("INSERT INTO payments(id,tenant_id,firm_id,party_id,direction,doc_id,doc_type,pay_mode,amount,pay_date,reference)
                 VALUES(?,?,?,?,'in',?,?,?,?,?,?)",
            [uuid(),$tid,$doc['firm_id'],$doc['party_id'],$p['id'],$doc['doc_type'],
             $b['pay_mode']??'cash',(float)$b['amount'],$b['pay_date']??date('Y-m-d'),n($b['reference']??null)]);
        DB::run("UPDATE sale_documents SET paid_amt=?,balance_amt=?,status=? WHERE id=?",[$paid,$balance,$status,$p['id']]);
        DB::commit();
    } catch (\Exception $e) { DB::rollback(); err(500,'DB_ERROR',$e->getMessage()); }
    ok(DB::one("SELECT * FROM sale_documents WHERE id=?",[$p['id']]));
});

// POST /sales/:id/cancel
route('POST','/sales/:id/cancel', function($p) {
    $auth = requireAuth();
    $tid  = $auth['tenant_id'];
    $doc  = DB::one("SELECT * FROM sale_documents WHERE id=? AND tenant_id=?",[$p['id'],$tid]);
    if (!$doc) err(404,'NOT_FOUND','Sale not found');
    if ($doc['status'] === 'cancelled') err(400,'ALREADY_CANCELLED','Already cancelled');

    DB::beginTransaction();
    try {
        DB::run("UPDATE sale_documents SET status='cancelled',updated_at=NOW() WHERE id=?",[$p['id']]);
        // Reverse stock movements
        if (in_array($doc['doc_type'],['invoice','pos'])) {
            $items = DB::all("SELECT * FROM sale_document_items WHERE document_id=?",[$p['id']]);
            foreach ($items as $it) {
                if ($it['item_id']) {
                    DB::run("INSERT INTO stock_movements(id,tenant_id,item_id,movement_type,qty,rate,ref_doc_type,ref_doc_id,moved_at)
                             VALUES(?,?,?,'return_in',?,?,'sale_cancel',?,NOW())",
                        [uuid(),$tid,$it['item_id'],abs($it['qty']),$it['price_unit'],$p['id']]);
                }
            }
        }
        DB::commit();
    } catch (\Exception $e) { DB::rollback(); err(500,'DB_ERROR',$e->getMessage()); }
    ok(['cancelled'=>true]);
});

// POST /sales/:id/convert  — e.g. estimate → invoice
route('POST','/sales/:id/convert', function($p) {
    $auth = requireAuth();
    $tid  = $auth['tenant_id'];
    $b    = json_decode(file_get_contents('php://input'), true) ?? [];
    validate($b,['doc_type']);

    $orig = DB::one("SELECT * FROM sale_documents WHERE id=? AND tenant_id=?",[$p['id'],$tid]);
    if (!$orig) err(404,'NOT_FOUND','Document not found');

    $items = DB::all("SELECT * FROM sale_document_items WHERE document_id=?",[$p['id']]);
    // Re-use the POST /sales logic by forwarding
    $_SERVER['REQUEST_METHOD'] = 'POST';
    $payload = array_merge($orig,$b,['items'=>$items,'orig_doc_id'=>$p['id'],'payment'=>null]);

    // Mark original as converted
    DB::run("UPDATE sale_documents SET status='converted' WHERE id=?",[$p['id']]);

    // minimal inline create (re-uses the same sale creation path via another POST call would be cleaner;
    // here we do it directly to avoid recursion)
    // Simply return guidance: the frontend should POST /sales with orig_doc_id
    ok(['message'=>'Use POST /sales with orig_doc_id to create the converted document','orig_doc_id'=>$p['id']]);
});
