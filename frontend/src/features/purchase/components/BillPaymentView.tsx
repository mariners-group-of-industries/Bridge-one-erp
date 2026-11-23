"use client";

import React, { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Paperclip, Plus } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/purchase/Toast";
import { fetchApi } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { round2 } from "@/lib/purchase-store/rules";
import { usePurchasePermissions } from "@/features/purchase/lib/usePurchasePermissions";
import { SearchableCombobox, type PurchaseFormOptions } from "@/features/purchase/components/PurchaseFormShared";
import type { Office, SupplierInvoiceItem, SupplierPaymentRecord } from "@bridgeone/contracts";

interface RowInputState {
  payment: string;
  vds: string;
  tds: string;
  otherAdj: string;
  discount: string;
  narration: string;
}

const emptyRowInput = (): RowInputState => ({
  payment: "",
  vds: "",
  tds: "",
  otherAdj: "",
  discount: "",
  narration: "",
});

const toNum = (val: string) => {
  const n = Number(val);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export function BillPaymentView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supplierId = searchParams.get("supplierId") || "";
  const queryClient = useQueryClient();
  const perms = usePurchasePermissions();
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  const { data: offices = [] } = useQuery<Office[]>({
    queryKey: ["offices"],
    queryFn: () => fetchApi("/master/offices"),
  });

  const { data: payables = [], isLoading: loadingPayables } = useQuery<SupplierPaymentRecord[]>({
    queryKey: ["supplierPayables"],
    queryFn: () => fetchApi("/purchase/supplier-payments"),
  });

  const { data: invoices = [], isLoading: loadingInvoices } = useQuery<SupplierInvoiceItem[]>({
    queryKey: ["supplierInvoices"],
    queryFn: () => fetchApi("/purchase/supplier-payments/invoices"),
  });

  const { data: formOptions } = useQuery<PurchaseFormOptions>({
    queryKey: ["purchase-form-options"],
    queryFn: () => fetchApi("/master/purchase-form-options"),
  });

  const supplierSummary = useMemo(
    () => payables.find((p) => p.supplierId === supplierId) ?? null,
    [payables, supplierId],
  );

  // Open/due invoices & GRNs for this supplier (oldest first for FIFO allocation)
  const openRows = useMemo(
    () =>
      invoices
        .filter((inv) => inv.supplierId === supplierId && inv.dueAmount > 0.005 && inv.status !== "PAID")
        .sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate)),
    [invoices, supplierId],
  );

  // Header payment form state
  const [paymentType, setPaymentType] = useState<"CASH" | "BANK" | "CHEQUE">("CASH");
  const [paymentDate, setPaymentDate] = useState(todayStr);
  const [pickedOfficeId, setPickedOfficeId] = useState("");
  const [cashAccountId, setCashAccountId] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [adjustmentGlId, setAdjustmentGlId] = useState("");
  const [moneyReceiptNo, setMoneyReceiptNo] = useState("");
  const [remarks, setRemarks] = useState("");

  // Allocation toolbar state
  const [employeeId, setEmployeeId] = useState("");
  const [bulkAmount, setBulkAmount] = useState("");
  const [isAdvance, setIsAdvance] = useState(false);
  const [payAll, setPayAll] = useState(false);
  const [payByGrnWise, setPayByGrnWise] = useState(true);
  const [debitAccountId, setDebitAccountId] = useState("");
  const [additionalAmount, setAdditionalAmount] = useState("");

  // Per-row edits keyed by invoice.id
  const [rowInputs, setRowInputs] = useState<Record<string, RowInputState>>({});

  const selectedOfficeId = pickedOfficeId || offices[0]?.id || "";

  const cashAccounts = useMemo(() => {
    const all = formOptions?.accounts ?? [];
    const cash = all.filter(
      (a) =>
        a.accountType.toUpperCase() === "ASSET" &&
        (a.name.toLowerCase().includes("cash") || a.accountSubtype.toLowerCase().includes("cash")),
    );
    return cash.length > 0 ? cash : all.filter((a) => a.accountType.toUpperCase() === "ASSET");
  }, [formOptions]);

  const adjustmentAccounts = useMemo(() => {
    const all = formOptions?.accounts ?? [];
    return all.filter((a) => ["EXPENSE", "LIABILITY", "EQUITY", "REVENUE"].includes(a.accountType.toUpperCase()));
  }, [formOptions]);

  const patchRow = (id: string, patch: Partial<RowInputState>) => {
    setRowInputs((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? emptyRowInput()), ...patch },
    }));
  };

  // Toggle "Pay all?" -> fills every due row with its full dueAmount (or clears)
  const handleTogglePayAll = (checked: boolean) => {
    setPayAll(checked);
    if (!checked) {
      setRowInputs({});
      return;
    }
    const next: Record<string, RowInputState> = {};
    for (const inv of openRows) {
      next[inv.id] = { ...(rowInputs[inv.id] ?? emptyRowInput()), payment: String(round2(inv.dueAmount)) };
    }
    setRowInputs(next);
  };

  // "+ Add" FIFO allocation across due GRNs/bills
  const handleAllocateFifo = () => {
    const amt = round2(Number(bulkAmount));
    if (!(amt > 0)) {
      toast.error("Enter a positive Payment Amount to allocate.");
      return;
    }
    if (isAdvance) {
      toast.info("Advance mode is checked — click SAVE to post this as a Supplier Advance.");
      return;
    }
    let remaining = amt;
    const next: Record<string, RowInputState> = { ...rowInputs };
    for (const inv of openRows) {
      if (remaining <= 0.005) {
        next[inv.id] = { ...(next[inv.id] ?? emptyRowInput()), payment: "" };
        continue;
      }
      const alloc = round2(Math.min(inv.dueAmount, remaining));
      next[inv.id] = { ...(next[inv.id] ?? emptyRowInput()), payment: String(alloc) };
      remaining = round2(remaining - alloc);
    }
    setRowInputs(next);
    if (remaining > 0.01) {
      toast.info(`Allocated ${formatCurrency(amt - remaining)}; ${formatCurrency(remaining)} exceeds open due.`);
    }
  };

  // Totals across table
  const totals = useMemo(() => {
    let netAmount = 0;
    let paidAmount = 0;
    let dueAmount = 0;
    let payment = 0;
    let vds = 0;
    let tds = 0;
    let otherAdj = 0;
    let discount = 0;

    for (const inv of openRows) {
      netAmount += inv.totalAmount;
      paidAmount += inv.paidAmount;
      dueAmount += inv.dueAmount;
      const r = rowInputs[inv.id] ?? emptyRowInput();
      payment += toNum(r.payment);
      vds += toNum(r.vds);
      tds += toNum(r.tds);
      otherAdj += toNum(r.otherAdj);
      discount += toNum(r.discount);
    }
    return {
      netAmount: round2(netAmount),
      paidAmount: round2(paidAmount),
      dueAmount: round2(dueAmount),
      payment: round2(payment),
      vds: round2(vds),
      tds: round2(tds),
      otherAdj: round2(otherAdj),
      discount: round2(discount),
    };
  }, [openRows, rowInputs]);

  const totalDueDisplay = supplierSummary?.dueAmount ?? totals.dueAmount;
  const ledgerBalanceDiff = round2(totalDueDisplay - totals.payment);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!supplierId) throw new Error("Supplier ID is missing.");
      if (!selectedOfficeId) throw new Error("Select an Office.");
      if (paymentType === "CASH" && !cashAccountId) throw new Error("Select a Cash Type account.");
      if ((paymentType === "BANK" || paymentType === "CHEQUE") && !bankAccountId) {
        throw new Error("Select a Bank Account.");
      }
      if (paymentType === "CHEQUE" && !moneyReceiptNo.trim()) {
        throw new Error("Enter the Cheque / Money Receipt No.");
      }

      const common = {
        supplierId,
        method: paymentType,
        paymentDate,
        officeId: selectedOfficeId,
        cashAccountId: paymentType === "CASH" ? cashAccountId : undefined,
        bankAccountId: paymentType !== "CASH" ? bankAccountId : undefined,
        referenceNumber: moneyReceiptNo.trim() || undefined,
      };

      if (isAdvance) {
        const advAmt = round2(Number(bulkAmount) || Number(additionalAmount));
        if (!(advAmt > 0)) throw new Error("Enter an Advance Payment Amount greater than 0.");
        await fetchApi("/purchase/supplier-payments", {
          method: "POST",
          body: JSON.stringify({
            ...common,
            amount: advAmt,
            isAdvance: true,
            narration: remarks.trim() || "Supplier Advance",
          }),
        });
        return { count: 1, total: advAmt };
      }

      const linesToPay = openRows
        .map((inv) => {
          const r = rowInputs[inv.id] ?? emptyRowInput();
          const amt = round2(toNum(r.payment));
          return { inv, r, amt };
        })
        .filter((x) => x.amt > 0);

      if (linesToPay.length === 0) {
        throw new Error("Enter a payment amount on at least one GRN/Bill (or use Payment Amount + Add / Pay all?).");
      }

      for (const line of linesToPay) {
        if (line.amt > line.inv.dueAmount + 0.005) {
          throw new Error(`Payment for ${line.inv.grnNumber || line.inv.invoiceNumber} exceeds due (${formatCurrency(line.inv.dueAmount)}).`);
        }
      }

      let totalPaid = 0;
      for (const line of linesToPay) {
        await fetchApi("/purchase/supplier-payments", {
          method: "POST",
          body: JSON.stringify({
            ...common,
            amount: line.amt,
            receiptId: line.inv.receiptId,
            billId: line.inv.billId,
            narration: line.r.narration.trim() || remarks.trim() || undefined,
          }),
        });
        totalPaid = round2(totalPaid + line.amt);
      }

      return { count: linesToPay.length, total: totalPaid };
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["supplierPayables"] });
      queryClient.invalidateQueries({ queryKey: ["supplierInvoices"] });
      queryClient.invalidateQueries({ queryKey: ["supplierPaymentHistory"] });
      queryClient.invalidateQueries({ queryKey: ["supplierAdvances"] });
      toast.success(`Posted ${res.count} payment(s) totaling BDT ${formatCurrency(res.total)}.`, {
        title: "Bill Payment Saved",
      });
      router.push("/purchase/supplier-payments");
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Could not save payment.");
    },
  });

  const isLoading = loadingPayables || loadingInvoices;

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)] bg-canvas/30">
      {/* Header Bar */}
      <div className="shrink-0 bg-surface border-b border-line px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => router.push("/purchase/supplier-payments")}
            className="p-1.5 rounded hover:bg-control text-ink-muted hover:text-ink transition"
            title="Back to Supplier Payment"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-base font-bold text-ink">Bill Payment</h1>
        </div>
        <button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || !perms.payments.create || isLoading}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-1.5 rounded text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
        >
          {saveMutation.isPending && <Spinner className="w-3.5 h-3.5" />}
          SAVE
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 flex flex-col p-3 space-y-2.5 overflow-hidden">
        {!supplierId ? (
          <div className="bg-surface border border-line rounded p-6 text-center text-xs text-ink-muted">
            Select a supplier from Due List to make a Bill Payment.
          </div>
        ) : isLoading ? (
          <div className="bg-surface border border-line rounded p-8 flex items-center justify-center gap-2 text-xs text-ink-muted">
            <Spinner className="w-4 h-4" />
            Loading supplier due invoices...
          </div>
        ) : (
          <>
            {/* Top 3-Column Supplier Summary */}
            <div className="shrink-0 bg-surface border border-line rounded px-4 py-2.5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="space-y-1">
                <div className="flex gap-2">
                  <span className="text-ink-muted w-32 shrink-0">Supplier Name</span>
                  <span className="font-semibold text-ink">: {supplierSummary?.supplierName || openRows[0]?.supplierName || "—"}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-ink-muted w-32 shrink-0">Supplier Mobile No</span>
                  <span className="font-mono text-ink">: {supplierSummary?.mobileNumber || "—"}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-ink-muted w-32 shrink-0">Total Amount</span>
                  <span className="font-mono font-semibold text-ink">: {formatCurrency(supplierSummary?.totalPurchasedAmount ?? totals.netAmount)}</span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex gap-2">
                  <span className="text-ink-muted w-32 shrink-0">Return Amount</span>
                  <span className="font-mono text-ink">: {formatCurrency(supplierSummary?.returnedAmount ?? 0)}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-ink-muted w-32 shrink-0">Payment Amount</span>
                  <span className="font-mono text-ink">: {formatCurrency(supplierSummary?.paidAmount ?? totals.paidAmount)}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-ink-muted w-32 shrink-0">Total Due</span>
                  <span className="font-mono font-bold text-ink">: {formatCurrency(totalDueDisplay)}</span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex gap-2">
                  <span className="text-ink-muted w-36 shrink-0">Ledger Balance</span>
                  <span className="font-mono font-semibold text-ink">: {formatCurrency(totalDueDisplay)}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-ink-muted w-36 shrink-0">Ledger Balance Diff.</span>
                  <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">: {formatCurrency(ledgerBalanceDiff)}</span>
                </div>
              </div>
            </div>

            {/* Header Payment Card */}
            <div className="shrink-0 bg-surface border border-line rounded px-4 py-3 text-xs space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="block text-[11px] font-medium text-ink-muted mb-1">
                    Payment Type<span className="text-danger">*</span>
                  </label>
                  <select
                    value={paymentType}
                    onChange={(e) => setPaymentType(e.target.value as "CASH" | "BANK" | "CHEQUE")}
                    className="w-full h-8 px-2 bg-surface border border-line rounded text-xs text-ink outline-none focus:border-blue-500"
                  >
                    <option value="CASH">Cash</option>
                    <option value="BANK">Bank Transfer</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-ink-muted mb-1">Date</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full h-8 px-2 bg-surface border border-line rounded text-xs text-ink outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-ink-muted mb-1">
                    Office<span className="text-danger">*</span>
                  </label>
                  <select
                    value={selectedOfficeId}
                    onChange={(e) => setPickedOfficeId(e.target.value)}
                    className="w-full h-8 px-2 bg-surface border border-line rounded text-xs text-ink outline-none focus:border-blue-500"
                  >
                    <option value="">Select Office</option>
                    {offices.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center h-8 text-ink-muted">
                  <span className="inline-flex items-center gap-1 text-[11px]">
                    <Paperclip className="w-3.5 h-3.5" />
                    Attachment
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="block text-[11px] font-medium text-ink-muted mb-1">
                    {paymentType === "CASH" ? "Cash Type" : "Bank Account"}
                    <span className="text-danger">*</span>
                  </label>
                  {paymentType === "CASH" ? (
                    <SearchableCombobox
                      value={cashAccountId}
                      onChange={setCashAccountId}
                      placeholder="Cash Type"
                      options={cashAccounts.map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }))}
                    />
                  ) : (
                    <SearchableCombobox
                      value={bankAccountId}
                      onChange={setBankAccountId}
                      placeholder="Select Bank Account"
                      options={(formOptions?.bankAccounts ?? []).map((b) => ({
                        value: b.id,
                        label: `${b.bankName} — ${b.accountNumber}`,
                      }))}
                    />
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-ink-muted mb-1">Adjustment GL</label>
                  <SearchableCombobox
                    value={adjustmentGlId}
                    onChange={setAdjustmentGlId}
                    placeholder="Adjustment"
                    options={adjustmentAccounts.map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }))}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-ink-muted mb-1">
                    {paymentType === "CHEQUE" ? "Cheque / Money Receipt No*" : "Money Receipt No"}
                  </label>
                  <input
                    type="text"
                    value={moneyReceiptNo}
                    onChange={(e) => setMoneyReceiptNo(e.target.value)}
                    placeholder="Money Receipt No"
                    className="w-full h-8 px-2 bg-surface border border-line rounded text-xs text-ink outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-ink-muted mb-1">Remarks</label>
                  <input
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Remarks"
                    className="w-full h-8 px-2 bg-surface border border-line rounded text-xs text-ink outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Allocation Toolbar + GRN/Bill Table */}
            <div className="flex-1 min-h-0 bg-surface border border-line rounded flex flex-col overflow-hidden">
              <div className="shrink-0 p-3 border-b border-line flex flex-wrap items-end gap-3 text-xs bg-canvas/30">
                <div className="w-44">
                  <label className="block text-[11px] font-medium text-ink-muted mb-1">Employee Name</label>
                  <SearchableCombobox
                    value={employeeId}
                    onChange={setEmployeeId}
                    placeholder="Employee Name"
                    options={(formOptions?.employees ?? []).map((e) => ({
                      value: e.id,
                      label: `${e.employeeCode} — ${e.name}`,
                    }))}
                  />
                </div>

                <div className="w-36">
                  <label className="block text-[11px] font-medium text-ink-muted mb-1">Payment Amount</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={bulkAmount}
                    onChange={(e) => setBulkAmount(e.target.value)}
                    placeholder="Payment Amount"
                    className="w-full h-8 px-2 bg-surface border border-line rounded text-xs text-ink outline-none focus:border-blue-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleAllocateFifo}
                  className="h-8 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold inline-flex items-center gap-1 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>

                <label className="inline-flex items-center gap-1.5 h-8 cursor-pointer select-none text-ink">
                  <input
                    type="checkbox"
                    checked={isAdvance}
                    onChange={(e) => setIsAdvance(e.target.checked)}
                    className="rounded border-line-strong accent-blue-600"
                  />
                  Advance
                </label>

                <label className="inline-flex items-center gap-1.5 h-8 cursor-pointer select-none text-ink">
                  <input
                    type="checkbox"
                    checked={payAll}
                    onChange={(e) => handleTogglePayAll(e.target.checked)}
                    className="rounded border-line-strong accent-blue-600"
                  />
                  Pay all?
                </label>

                <label className="inline-flex items-center gap-1.5 h-8 cursor-pointer select-none text-ink">
                  <input
                    type="checkbox"
                    checked={payByGrnWise}
                    onChange={(e) => setPayByGrnWise(e.target.checked)}
                    className="rounded border-line-strong accent-blue-600"
                  />
                  Pay By GRN Wise
                </label>

                <div className="w-44">
                  <label className="block text-[11px] font-medium text-ink-muted mb-1">Debit Account (GL)</label>
                  <SearchableCombobox
                    value={debitAccountId}
                    onChange={setDebitAccountId}
                    placeholder="Debit Account (GL)"
                    options={(formOptions?.accounts ?? []).map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }))}
                  />
                </div>

                <div className="w-32">
                  <label className="block text-[11px] font-medium text-ink-muted mb-1">Additional Amount</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={additionalAmount}
                    onChange={(e) => setAdditionalAmount(e.target.value)}
                    placeholder="Additional Amount"
                    className="w-full h-8 px-2 bg-surface border border-line rounded text-xs text-ink outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Scrollable GRN/Invoice Table */}
              <div className="flex-1 min-h-0 overflow-auto">
                <table className="w-full border-collapse text-left text-[11px]">
                  <thead className="sticky top-0 z-10 bg-sky-100/90 dark:bg-sky-950/90 text-ink font-semibold">
                    <tr>
                      <th className="p-2 border border-line-strong w-10 text-center">SL</th>
                      <th className="p-2 border border-line-strong min-w-28">PO NO</th>
                      <th className="p-2 border border-line-strong min-w-28">GRN</th>
                      <th className="p-2 border border-line-strong min-w-24">Challan No</th>
                      <th className="p-2 border border-line-strong w-24">Invoice Date</th>
                      <th className="p-2 border border-line-strong w-24 text-right">Net Amount</th>
                      <th className="p-2 border border-line-strong w-20 text-right">Return Amount</th>
                      <th className="p-2 border border-line-strong w-24 text-right">Paid Amount</th>
                      <th className="p-2 border border-line-strong w-24 text-right">Due Amount</th>
                      <th className="p-2 border border-line-strong w-28 text-right">Payment</th>
                      <th className="p-2 border border-line-strong w-24 text-right">VDS(BDT)</th>
                      <th className="p-2 border border-line-strong w-24 text-right">VAT(BDT)</th>
                      <th className="p-2 border border-line-strong w-24 text-right">TDS(BDT)</th>
                      <th className="p-2 border border-line-strong w-24 text-right">Other Adjustment</th>
                      <th className="p-2 border border-line-strong w-24 text-right">Discount</th>
                      <th className="p-2 border border-line-strong min-w-28">Narration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openRows.length === 0 ? (
                      <tr>
                        <td colSpan={16} className="p-8 text-center text-ink-muted">
                          No open due GRNs or Bills for this supplier.
                        </td>
                      </tr>
                    ) : (
                      openRows.map((inv, idx) => {
                        const r = rowInputs[inv.id] ?? emptyRowInput();
                        return (
                          <tr key={inv.id} className="hover:bg-canvas/70 transition-colors">
                            <td className="p-2 border border-line text-center font-mono text-ink-muted">{idx + 1}</td>
                            <td className="p-2 border border-line font-mono text-ink-muted">{inv.poNumber || "N/A"}</td>
                            <td className="p-2 border border-line font-mono text-blue-600 dark:text-blue-400">
                              {inv.grnNumber || inv.billNumber || inv.invoiceNumber}
                            </td>
                            <td className="p-2 border border-line text-ink-muted">{inv.invoiceNumber || "—"}</td>
                            <td className="p-2 border border-line font-mono text-ink-muted whitespace-nowrap">{inv.invoiceDate}</td>
                            <td className="p-2 border border-line text-right font-mono text-ink">{formatCurrency(inv.totalAmount)}</td>
                            <td className="p-2 border border-line text-right font-mono text-ink-faint">0.00</td>
                            <td className="p-2 border border-line text-right font-mono text-ink">{formatCurrency(inv.paidAmount)}</td>
                            <td className="p-2 border border-line text-right font-mono font-semibold text-ink">{formatCurrency(inv.dueAmount)}</td>
                            <td className="p-1 border border-line">
                              <input
                                type="number"
                                min="0"
                                max={inv.dueAmount}
                                step="0.01"
                                disabled={!payByGrnWise}
                                value={r.payment}
                                onChange={(e) => patchRow(inv.id, { payment: e.target.value })}
                                className="w-full h-7 px-1.5 text-right font-mono bg-canvas/50 disabled:opacity-60 border border-line rounded text-ink outline-none focus:border-blue-500"
                              />
                            </td>
                            <td className="p-1 border border-line">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={r.vds}
                                onChange={(e) => patchRow(inv.id, { vds: e.target.value })}
                                className="w-full h-7 px-1.5 text-right font-mono bg-surface border border-line rounded text-ink outline-none focus:border-blue-500"
                              />
                            </td>
                            <td className="p-2 border border-line text-right font-mono text-ink-muted">0.00</td>
                            <td className="p-1 border border-line">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={r.tds}
                                onChange={(e) => patchRow(inv.id, { tds: e.target.value })}
                                className="w-full h-7 px-1.5 text-right font-mono bg-surface border border-line rounded text-ink outline-none focus:border-blue-500"
                              />
                            </td>
                            <td className="p-1 border border-line">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={r.otherAdj}
                                onChange={(e) => patchRow(inv.id, { otherAdj: e.target.value })}
                                className="w-full h-7 px-1.5 text-right font-mono bg-surface border border-line rounded text-ink outline-none focus:border-blue-500"
                              />
                            </td>
                            <td className="p-1 border border-line">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={r.discount}
                                onChange={(e) => patchRow(inv.id, { discount: e.target.value })}
                                className="w-full h-7 px-1.5 text-right font-mono bg-surface border border-line rounded text-ink outline-none focus:border-blue-500"
                              />
                            </td>
                            <td className="p-1 border border-line">
                              <input
                                type="text"
                                value={r.narration}
                                onChange={(e) => patchRow(inv.id, { narration: e.target.value })}
                                className="w-full h-7 px-1.5 bg-surface border border-line rounded text-ink outline-none focus:border-blue-500"
                              />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  <tfoot className="sticky bottom-0 bg-canvas font-bold border-t-2 border-line-strong text-ink">
                    <tr>
                      <td colSpan={5} className="p-2 border border-line-strong text-left">
                        Total:
                      </td>
                      <td className="p-2 border border-line-strong text-right font-mono">{formatCurrency(totals.netAmount)}</td>
                      <td className="p-2 border border-line-strong text-right font-mono">0.00</td>
                      <td className="p-2 border border-line-strong text-right font-mono">{formatCurrency(totals.paidAmount)}</td>
                      <td className="p-2 border border-line-strong text-right font-mono">{formatCurrency(totals.dueAmount)}</td>
                      <td className="p-2 border border-line-strong text-right font-mono text-blue-600 dark:text-blue-400">
                        {formatCurrency(totals.payment)}
                      </td>
                      <td className="p-2 border border-line-strong text-right font-mono">{formatCurrency(totals.vds)}</td>
                      <td className="p-2 border border-line-strong text-right font-mono">0.00</td>
                      <td className="p-2 border border-line-strong text-right font-mono">{formatCurrency(totals.tds)}</td>
                      <td className="p-2 border border-line-strong text-right font-mono">{formatCurrency(totals.otherAdj)}</td>
                      <td className="p-2 border border-line-strong text-right font-mono">{formatCurrency(totals.discount)}</td>
                      <td className="p-2 border border-line-strong" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
