// Shared pricing & tax calculation service — single source of truth

export function calcLineTotal(priceUnit, qty, discountPct, discountAmt, taxPct, priceTaxIncl) {
  const gross = priceUnit * qty;
  const disc = discountAmt > 0 ? discountAmt : (gross * discountPct) / 100;
  const taxable = gross - disc;

  let tax, lineTotal;
  if (priceTaxIncl) {
    tax = taxable - taxable / (1 + taxPct / 100);
    lineTotal = taxable;
  } else {
    tax = (taxable * taxPct) / 100;
    lineTotal = taxable + tax;
  }
  return {
    discount_amt: round2(disc),
    tax_amt: round2(tax),
    line_total: round2(lineTotal),
  };
}

export function calcGSTSplit(taxPct, taxAmt, fromState, toState) {
  if (fromState && toState && fromState !== toState) {
    return { cgst: 0, sgst: 0, igst: round2(taxAmt) };
  }
  const half = round2(taxAmt / 2);
  return { cgst: half, sgst: round2(taxAmt - half), igst: 0 };
}

export function calcDocTotals(items) {
  let sub_total = 0, discount_amt = 0, tax_amt = 0;
  for (const it of items) {
    const gross = it.price_unit * it.qty;
    sub_total += gross;
    discount_amt += it.discount_amt || 0;
    tax_amt += it.tax_amt || 0;
  }
  return {
    sub_total: round2(sub_total),
    discount_amt: round2(discount_amt),
    tax_amt: round2(tax_amt),
  };
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
