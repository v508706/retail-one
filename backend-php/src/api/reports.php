<?php
// ── Report helpers ────────────────────────────────────────────

function rptDateRange(): array {
    $from = $_GET['from'] ?? date('Y-m-01');
    $to   = $_GET['to']   ?? date('Y-m-d');
    return [$from, $to];
}

// GET /reports/sales-summary
route('GET','/reports/sales-summary', function() {
    $auth = requireAuth();
    $tid  = $auth['tenant_id'];
    [$from,$to] = rptDateRange();

    $summary = DB::one(
        "SELECT COUNT(*) as total_docs,
                COALESCE(SUM(total),0) as total_amount,
                COALESCE(SUM(tax_amt),0) as total_tax,
                COALESCE(SUM(paid_amt),0) as total_paid,
                COALESCE(SUM(balance_amt),0) as total_outstanding
         FROM sale_documents
         WHERE tenant_id=? AND doc_date BETWEEN ? AND ?
           AND status != 'cancelled' AND deleted_at IS NULL",
        [$tid,$from,$to]
    );

    $byType = DB::all(
        "SELECT doc_type,COUNT(*) as count,COALESCE(SUM(total),0) as amount
         FROM sale_documents
         WHERE tenant_id=? AND doc_date BETWEEN ? AND ? AND status != 'cancelled' AND deleted_at IS NULL
         GROUP BY doc_type",
        [$tid,$from,$to]
    );

    $daily = DB::all(
        "SELECT doc_date as date,COUNT(*) as count,COALESCE(SUM(total),0) as amount
         FROM sale_documents
         WHERE tenant_id=? AND doc_date BETWEEN ? AND ? AND status != 'cancelled' AND deleted_at IS NULL
         GROUP BY doc_date ORDER BY doc_date",
        [$tid,$from,$to]
    );

    ok(['summary'=>$summary,'by_type'=>$byType,'daily'=>$daily,'from'=>$from,'to'=>$to]);
});

// GET /reports/purchases-summary
route('GET','/reports/purchases-summary', function() {
    $auth = requireAuth();
    $tid  = $auth['tenant_id'];
    [$from,$to] = rptDateRange();

    $summary = DB::one(
        "SELECT COUNT(*) as total_docs,
                COALESCE(SUM(total),0) as total_amount,
                COALESCE(SUM(tax_amt),0) as total_tax,
                COALESCE(SUM(paid_amt),0) as total_paid,
                COALESCE(SUM(balance_amt),0) as total_outstanding
         FROM purchase_documents
         WHERE tenant_id=? AND doc_date BETWEEN ? AND ? AND status != 'cancelled' AND deleted_at IS NULL",
        [$tid,$from,$to]
    );

    $daily = DB::all(
        "SELECT doc_date as date,COUNT(*) as count,COALESCE(SUM(total),0) as amount
         FROM purchase_documents
         WHERE tenant_id=? AND doc_date BETWEEN ? AND ? AND status != 'cancelled' AND deleted_at IS NULL
         GROUP BY doc_date ORDER BY doc_date",
        [$tid,$from,$to]
    );

    ok(['summary'=>$summary,'daily'=>$daily,'from'=>$from,'to'=>$to]);
});

// GET /reports/expenses-summary
route('GET','/reports/expenses-summary', function() {
    $auth = requireAuth();
    $tid  = $auth['tenant_id'];
    [$from,$to] = rptDateRange();

    $summary = DB::one(
        "SELECT COUNT(*) as total_count,COALESCE(SUM(amount),0) as total_amount
         FROM expenses WHERE tenant_id=? AND exp_date BETWEEN ? AND ? AND deleted_at IS NULL",
        [$tid,$from,$to]
    );
    $byCategory = DB::all(
        "SELECT COALESCE(category,'Uncategorized') as category,COUNT(*) as count,COALESCE(SUM(amount),0) as amount
         FROM expenses WHERE tenant_id=? AND exp_date BETWEEN ? AND ? AND deleted_at IS NULL
         GROUP BY category ORDER BY amount DESC",
        [$tid,$from,$to]
    );
    ok(['summary'=>$summary,'by_category'=>$byCategory,'from'=>$from,'to'=>$to]);
});

// GET /reports/stock
route('GET','/reports/stock', function() {
    $auth = requireAuth();
    $tid  = $auth['tenant_id'];

    $rows = DB::all(
        "SELECT i.id,i.name,i.sku,i.low_stock_alert,
                u.short_name as unit,
                c.name as category,
                ip.sale_price, ip.purchase_price,
                COALESCE((SELECT SUM(qty) FROM stock_movements sm WHERE sm.item_id=i.id AND sm.tenant_id=?),0) as current_stock,
                COALESCE((SELECT SUM(qty) FROM stock_movements sm WHERE sm.item_id=i.id AND sm.tenant_id=? AND sm.movement_type='sale'),0) as sold_qty
         FROM items i
         LEFT JOIN units u ON u.id=i.unit_id
         LEFT JOIN categories c ON c.id=i.category_id
         LEFT JOIN item_prices ip ON ip.item_id=i.id
         WHERE i.tenant_id=? AND i.deleted_at IS NULL AND i.track_inventory=1
         ORDER BY i.name",
        [$tid,$tid,$tid]
    );
    ok($rows);
});

// GET /reports/top-items
route('GET','/reports/top-items', function() {
    $auth = requireAuth();
    $tid  = $auth['tenant_id'];
    [$from,$to] = rptDateRange();
    $limit = (int)($_GET['limit'] ?? 10);

    $rows = DB::all(
        "SELECT sdi.item_id,COALESCE(sdi.item_name,i.name) as item_name,
                SUM(sdi.qty) as total_qty,
                SUM(sdi.line_total) as total_revenue,
                COUNT(DISTINCT sdi.document_id) as invoice_count
         FROM sale_document_items sdi
         LEFT JOIN items i ON i.id=sdi.item_id
         INNER JOIN sale_documents sd ON sd.id=sdi.document_id
         WHERE sdi.tenant_id=? AND sd.doc_date BETWEEN ? AND ?
           AND sd.status != 'cancelled' AND sd.deleted_at IS NULL
         GROUP BY sdi.item_id,item_name
         ORDER BY total_revenue DESC
         LIMIT $limit",
        [$tid,$from,$to]
    );
    ok(['items'=>$rows,'from'=>$from,'to'=>$to]);
});

// GET /reports/profit-loss
route('GET','/reports/profit-loss', function() {
    $auth = requireAuth();
    $tid  = $auth['tenant_id'];
    [$from,$to] = rptDateRange();

    $revenue = (float)(DB::one(
        "SELECT COALESCE(SUM(total),0) as v FROM sale_documents
         WHERE tenant_id=? AND doc_date BETWEEN ? AND ? AND status != 'cancelled' AND deleted_at IS NULL
         AND doc_type IN ('invoice','pos')",
        [$tid,$from,$to]
    )['v'] ?? 0);

    $taxCollected = (float)(DB::one(
        "SELECT COALESCE(SUM(tax_amt),0) as v FROM sale_documents
         WHERE tenant_id=? AND doc_date BETWEEN ? AND ? AND status != 'cancelled' AND deleted_at IS NULL",
        [$tid,$from,$to]
    )['v'] ?? 0);

    $cogs = (float)(DB::one(
        "SELECT COALESCE(SUM(sdi.qty * sdi.cost_rate),0) as v
         FROM sale_document_items sdi
         INNER JOIN sale_documents sd ON sd.id=sdi.document_id
         WHERE sdi.tenant_id=? AND sd.doc_date BETWEEN ? AND ?
           AND sd.status != 'cancelled' AND sd.deleted_at IS NULL",
        [$tid,$from,$to]
    )['v'] ?? 0);

    $purchases = (float)(DB::one(
        "SELECT COALESCE(SUM(total),0) as v FROM purchase_documents
         WHERE tenant_id=? AND doc_date BETWEEN ? AND ? AND status != 'cancelled' AND deleted_at IS NULL",
        [$tid,$from,$to]
    )['v'] ?? 0);

    $expenses = (float)(DB::one(
        "SELECT COALESCE(SUM(amount),0) as v FROM expenses
         WHERE tenant_id=? AND exp_date BETWEEN ? AND ? AND deleted_at IS NULL",
        [$tid,$from,$to]
    )['v'] ?? 0);

    $grossProfit = $revenue - $cogs;
    $netProfit   = $grossProfit - $expenses;

    ok([
        'from'            => $from,
        'to'              => $to,
        'revenue'         => $revenue,
        'tax_collected'   => $taxCollected,
        'cogs'            => $cogs,
        'gross_profit'    => $grossProfit,
        'gross_margin_pct'=> $revenue > 0 ? round($grossProfit / $revenue * 100, 2) : 0,
        'expenses'        => $expenses,
        'net_profit'      => $netProfit,
        'net_margin_pct'  => $revenue > 0 ? round($netProfit / $revenue * 100, 2) : 0,
        'total_purchases' => $purchases,
    ]);
});

// GET /reports/gst
route('GET','/reports/gst', function() {
    $auth = requireAuth();
    $tid  = $auth['tenant_id'];
    [$from,$to] = rptDateRange();

    // Output tax (from sales)
    $outputTax = DB::all(
        "SELECT sdi.tax_pct,
                SUM(sdi.qty * (sdi.price_unit - sdi.discount_amt/NULLIF(sdi.qty,0))) as taxable_value,
                SUM(sdi.cgst) as cgst, SUM(sdi.sgst) as sgst, SUM(sdi.igst) as igst, SUM(sdi.tax_amt) as total_tax
         FROM sale_document_items sdi
         INNER JOIN sale_documents sd ON sd.id=sdi.document_id
         WHERE sdi.tenant_id=? AND sd.doc_date BETWEEN ? AND ?
           AND sd.status != 'cancelled' AND sd.deleted_at IS NULL
         GROUP BY sdi.tax_pct ORDER BY sdi.tax_pct",
        [$tid,$from,$to]
    );

    // Input tax (from purchases)
    $inputTax = DB::all(
        "SELECT pdi.tax_pct,
                SUM(pdi.qty * pdi.price_unit - pdi.discount_amt) as taxable_value,
                SUM(pdi.tax_amt) as total_tax
         FROM purchase_document_items pdi
         INNER JOIN purchase_documents pd ON pd.id=pdi.document_id
         WHERE pdi.tenant_id=? AND pd.doc_date BETWEEN ? AND ?
           AND pd.status != 'cancelled' AND pd.deleted_at IS NULL
         GROUP BY pdi.tax_pct ORDER BY pdi.tax_pct",
        [$tid,$from,$to]
    );

    $totalOutput = array_sum(array_column($outputTax,'total_tax'));
    $totalInput  = array_sum(array_column($inputTax,'total_tax'));

    ok([
        'from'          => $from,
        'to'            => $to,
        'output_tax'    => $outputTax,
        'input_tax'     => $inputTax,
        'total_output'  => $totalOutput,
        'total_input'   => $totalInput,
        'net_payable'   => max(0, $totalOutput - $totalInput),
    ]);
});

// GET /reports/cash-flow
route('GET','/reports/cash-flow', function() {
    $auth = requireAuth();
    $tid  = $auth['tenant_id'];
    [$from,$to] = rptDateRange();

    $daily = DB::all(
        "SELECT pay_date as date,
                SUM(IF(direction='in',amount,0)) as cash_in,
                SUM(IF(direction='out',amount,0)) as cash_out,
                SUM(IF(direction='in',amount,-amount)) as net
         FROM payments WHERE tenant_id=? AND pay_date BETWEEN ? AND ?
         GROUP BY pay_date ORDER BY pay_date",
        [$tid,$from,$to]
    );

    $totalIn  = array_sum(array_column($daily,'cash_in'));
    $totalOut = array_sum(array_column($daily,'cash_out'));

    ok(['daily'=>$daily,'total_in'=>$totalIn,'total_out'=>$totalOut,'net'=>$totalIn-$totalOut,'from'=>$from,'to'=>$to]);
});

// GET /reports/party-outstanding
route('GET','/reports/party-outstanding', function() {
    $auth = requireAuth();
    $tid  = $auth['tenant_id'];

    $rows = DB::all(
        "SELECT p.id,p.name,p.phone,p.role,
                COALESCE(pb.receivable,0) as receivable,
                COALESCE(pb.payable,0) as payable
         FROM parties p
         LEFT JOIN party_balances pb ON pb.party_id=p.id
         WHERE p.tenant_id=? AND p.deleted_at IS NULL
           AND (COALESCE(pb.receivable,0) != 0 OR COALESCE(pb.payable,0) != 0)
         ORDER BY pb.receivable DESC",
        [$tid]
    );
    ok($rows);
});
