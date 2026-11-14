/**
 * Journal transaction types, named as iBOS names them. Vouchers posted
 * automatically carry their source document type (src/lib/accounting/posting.service.ts),
 * shown as "<type> (Auto)"; manual vouchers carry the voucher type the user picked.
 */

/** The iBOS transaction type of each automatic source document type. */
export const AUTO_TRANS_TYPES: Record<string, string> = {
  PURCHASE_RECEIPT: "Purchase",
  PURCHASE_RETURN: "Purchase Return",
  SUPPLIER_BILL: "Expense",
  SUPPLIER_PAYMENT: "Due Payment",
  SALES_DELIVERY: "Sales",
  SALES_RETURN: "Sales Return",
  SALES_COLLECTION: "Due Receive",
  POS_SALE: "POS Accounting",
  INVENTORY: "Inventory Movement",
  PAYROLL: "Payroll",
};

/** Voucher types of a manual journal (iBOS Journal › Voucher Type). */
export const MANUAL_TRANS_TYPES = ["Cash Receive", "Cash Payment", "Bank Receive", "Bank Payment", "Journal Voucher", "Contra Voucher"] as const;

/** iBOS Accounting Journal › Transaction Type filter (its hospital-only HMS types left out). */
export const IBOS_TRANS_TYPES = [
  "Purchase",
  "Sales",
  "Due Payment",
  "Due Receive",
  "Advance Against Purchase",
  "Advance Against Sales",
  "Inventory Movement",
  "Sales Return",
  "Purchase Return",
  "Income",
  "Expense",
  "Loan Taken",
  "Loan Taken Repayment",
  "Loan Given",
  "Loan Given Repayment",
  "Adjustment Journal",
  "Opening Journal",
  "New Investment",
  "Cash Receive",
  "Cash Payment",
  "Return Due Payment",
  "Return Due Receive",
  "Bank Receive",
  "Bank Payment",
  "Bad Debt",
  "Stock Increment",
  "Assets Depreciation",
  "Asset Disposal",
  "Asset Maintenance",
  "Internal Advance",
  "Purchase Bill Payment",
  "Rental Bill",
  "Project Accounting",
  "Fund Transfer Out",
  "Fund Transfer In",
  "POS Accounting",
  "In Transit Transfer Return",
  "Closing Journal",
  "LC Margin",
  "Payroll",
  "Salary Disbursement",
  "PO Advance Payment",
  "Tender",
  "Long Terms Loan",
  "Short Terms Loan",
  "Security Deposit",
  "Bank Guarantee",
  "FDR",
  "Bonus Disbursement",
  "Fund Transfer Return",
  "Asset ReEvaluation",
  "Commision Payment",
] as const;

const CANCEL = "_CANCEL";

/** The transaction type a voucher is filtered by: the iBOS type of an automatic voucher (or its reversal), else its own. */
export function transTypeBase(transType: string | null | undefined, journalType?: string | null): string {
  if (!transType) return journalType || "";
  if (AUTO_TRANS_TYPES[transType]) return AUTO_TRANS_TYPES[transType];
  if (transType.endsWith(CANCEL) && AUTO_TRANS_TYPES[transType.slice(0, -CANCEL.length)]) return AUTO_TRANS_TYPES[transType.slice(0, -CANCEL.length)];
  return transType;
}

/** Screen name of a voucher's transaction type: "Purchase (Auto)", "Due Payment Reversal (Auto)" or the manual type. */
export function transTypeLabel(transType: string | null | undefined, journalType?: string | null): string {
  if (!transType) return journalType || "—";
  if (AUTO_TRANS_TYPES[transType]) return `${AUTO_TRANS_TYPES[transType]} (Auto)`;
  if (transType.endsWith(CANCEL)) {
    const base = AUTO_TRANS_TYPES[transType.slice(0, -CANCEL.length)];
    if (base) return `${base} Reversal (Auto)`;
  }
  return transType;
}

/** Filter choices: the iBOS list in its order, then manual voucher types and any other type found on the vouchers. */
export function transTypeFilterOptions(vouchers: Array<{ transType?: string | null; journalType?: string | null }>): string[] {
  const options: string[] = [...IBOS_TRANS_TYPES];
  const seen = new Set(options);
  const add = (t: string) => {
    if (t && !seen.has(t)) {
      seen.add(t);
      options.push(t);
    }
  };
  MANUAL_TRANS_TYPES.forEach(add);
  for (const v of vouchers) add(transTypeBase(v.transType, v.journalType));
  return options;
}
