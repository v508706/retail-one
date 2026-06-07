<?php
/**
 * Pricing helpers — port of services/pricing.js
 */

/**
 * Compute line-level totals.
 * @return array [discount_amt, tax_amt, line_total]
 */
function calcLineTotal(
    float $price_unit,
    float $qty,
    float $discount_pct = 0,
    float $discount_amt = 0,
    float $tax_pct = 0,
    int   $price_tax_incl = 0
): array {
    $gross = $price_unit * $qty;

    // discount
    if ($discount_pct > 0 && $discount_amt == 0) {
        $discount_amt = round($gross * $discount_pct / 100, 4);
    }
    $after_disc = $gross - $discount_amt;

    // tax
    if ($price_tax_incl) {
        // price already includes tax — extract it
        $tax_amt   = round($after_disc - $after_disc / (1 + $tax_pct / 100), 4);
        $line_total = $after_disc;
    } else {
        $tax_amt   = round($after_disc * $tax_pct / 100, 4);
        $line_total = $after_disc + $tax_amt;
    }

    return [
        'discount_amt' => round($discount_amt, 4),
        'tax_amt'      => round($tax_amt, 4),
        'line_total'   => round($line_total, 4),
    ];
}

/**
 * GST split for intra-state (CGST+SGST) vs inter-state (IGST).
 * state_of_supply vs firm_state comparison would go here;
 * for simplicity we always split 50/50 (CGST+SGST).
 */
function calcGSTSplit(float $tax_pct, float $tax_amt): array {
    $half = round($tax_amt / 2, 4);
    return ['cgst' => $half, 'sgst' => $half, 'igst' => 0.0];
}

/**
 * Sum across all line items.
 * @return array [sub_total, discount_amt, tax_amt]
 */
function calcDocTotals(array $items): array {
    $sub = $disc = $tax = 0;
    foreach ($items as $it) {
        $sub  += ($it['price_unit'] ?? 0) * ($it['qty'] ?? 0);
        $disc += $it['discount_amt'] ?? 0;
        $tax  += $it['tax_amt'] ?? 0;
    }
    return [
        'sub_total'    => round($sub, 4),
        'discount_amt' => round($disc, 4),
        'tax_amt'      => round($tax, 4),
    ];
}
