"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Inbox, Trash2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/purchase/Toast";
import { fetchApi } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { round2 } from "@/lib/purchase-store/rules";
import { SearchableCombobox, type PurchaseFormOptions } from "@/features/purchase/components/PurchaseFormShared";
import type { Office, Supplier, SupplierInvoiceItem } from "@bridgeone/contracts";

interface QueuedGrnPayment {
  key: string;
  supplierId: string;
  supplierName: string;
  receiptId: string;
  grnNumber: string;
  grnDate: string;
  outstandingDue: number;
  amount: number;
}

export function PaymentByGrnView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  const { data: offices = [] } = useQuery<Office[]>({
    queryKey: ["offices"],
    queryFn: () => fetchApi("/master/offices"),
  });
  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["suppliers"],
    queryFn: () => fetchApi("/master/suppliers"),
  });
  const { data: invoices = [] } = useQuery<SupplierInvoiceItem[]>({
    queryKey: ["supplierInvoices"],
    queryFn: () => fetchApi("/purchase/supplier-payments/invoices"),
  });
  const { data: formOptions } = useQuery<PurchaseFormOptions>({
    queryKey: ["purchase-form-options"],
    queryFn: () => fetchApi("/master/purchase-form-options"),
  });

  // Header fields
  const [paymentDate, setPaymentDate] = useState(todayStr);
  const [pickedOfficeId, setPickedOfficeId] = useState("");
  const [paymentMode, setPaymentMode] = useState<"CASH" | "BANK">("CASH");
  const [cashAccountId, setCashAccountId] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [adjustmentName, setAdjustmentName] = useState("");
  const [moneyReceiptNo, setMoneyReceiptNo] = useState("");
  const [remarks, setRemarks] = useState("");

  // Row builder fields
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [selectedGrnId, setSelectedGrnId] = useState("");
  const [payAllFlag, setPayAllFlag] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");

  // Added GRN payment lines
  const [queuedLines, setQueuedLines] = useState<QueuedGrnPayment[]>([]);

  const selectedOfficeId = pickedOfficeId || offices[0]?.id || "";

  const cashAccounts = useMemo(() => {
    const all = formOptions?.accounts ?? [];
    const cash = all.filter(
      (a) =>
        a.accountType.toUpperCase() === "ASSET" &&
        (a.name.toLowerCase().includes("cash") || a.accountSubtype.toLowerCase().includes("cash"))
    );
    return cash.length > 0 ? cash : all.filter((a) => a.accountType.toUpperCase() === "ASSET");
  }, [formOptions]);

  const adjustmentAccounts = useMemo(() => {
    const all = formOptions?.accounts ?? [];
    return all.filter((a) => ["EXPENSE", "LIABILITY", "EQUITY", "REVENUE"].includes(a.accountType.toUpperCase()));
  }, [formOptions]);

  const openGrnInvoices = useMemo(() => {
    const queuedIds = new Set(queuedLines.map((q) => q.receiptId));
    return invoices.filter(
      (inv) =>
        Boolean(inv.receiptId || !inv.billId) &&
        inv.status !== "PAID" &&
        inv.dueAmount > 0.005 &&
        !queuedIds.has(inv.receiptId ?? inv.id) &&
        (!selectedSupplierId || inv.supplierId === selectedSupplierId)
    );
  }, [invoices, selectedSupplierId, queuedLines]);

  const selectedGrn = useMemo(
    () => invoices.find((inv) => inv.id === selectedGrnId) ?? null,
    [invoices, selectedGrnId]
  );

  const handleSelectSupplier = (supId: string) => {
    setSelectedSupplierId(supId);
    setSelectedGrnId("");
    setPayAllFlag(false);
    setPaymentAmount("");
  };

  const handleSelectGrn = (grnId: string) => {
    setSelectedGrnId(grnId);
    const inv = invoices.find((i) => i.id === grnId);
    if (inv) {
      if (!selectedSupplierId && inv.supplierId) setSelectedSupplierId(inv.supplierId);
      if (payAllFlag) {
        setPaymentAmount(String(round2(inv.dueAmount)));
      }
    }
  };

  const handleToggleAll = (checked: boolean) => {
    setPayAllFlag(checked);
    if (checked && selectedGrn) {
      setPaymentAmount(String(round2(selectedGrn.dueAmount)));
    }
  };

  const handleAddLine = () => {
    if (!selectedGrn) return toast.error("Select a GRN first.");
    const amt = round2(Number(paymentAmount));
    if (!(amt > 0)) return toast.error("Enter a payment amount greater than 0.");
    if (amt > selectedGrn.dueAmount + 0.01) {
      return toast.error(
        `Payment (${formatCurrency(amt)}) cannot exceed GRN due (${formatCurrency(selectedGrn.dueAmount)}).`
      );
    }

    const receiptTargetId = selectedGrn.receiptId || selectedGrn.id;
    const resolvedSupplierId =
      selectedGrn.supplierId ||
      suppliers.find((s) => s.name === selectedGrn.supplierName)?.id ||
      selectedSupplierId;

    setQueuedLines((prev) => [
      ...prev,
      {
        key: `grn_${receiptTargetId}`,
        supplierId: resolvedSupplierId,
        supplierName: selectedGrn.supplierName,
        receiptId: receiptTargetId,
        grnNumber: selectedGrn.grnNumber || selectedGrn.invoiceNumber,
        grnDate: selectedGrn.invoiceDate,
        outstandingDue: selectedGrn.dueAmount,
        amount: amt,
      },
    ]);
    setSelectedGrnId("");
    setPayAllFlag(false);
    setPaymentAmount("");
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOfficeId) throw new Error("Office is required.");
      if (paymentMode === "BANK" && !bankAccountId && (formOptions?.bankAccounts.length ?? 0) > 0) {
        throw new Error("Select a Bank Account.");
      }
      if (paymentMode === "CASH" && !cashAccountId && cashAccounts.length > 0) {
        throw new Error("Select Cash Type.");
      }
      if (queuedLines.length === 0) throw new Error("Add at least one GRN line before saving.");

      const cashLabel = cashAccounts.find((a) => a.id === cashAccountId)?.name;
      const bankObj = formOptions?.bankAccounts.find((b) => b.id === bankAccountId);
      const bankLabel = bankObj ? `${bankObj.bankName} (${bankObj.accountNumber})` : "";
      const officeName = offices.find((o) => o.id === selectedOfficeId)?.name || "";

      const narrationParts = [
        `Office: ${officeName}`,
        paymentMode === "CASH" && cashLabel ? `Cash: ${cashLabel}` : "",
        paymentMode === "BANK" && bankLabel ? `Bank: ${bankLabel}` : "",
        adjustmentName ? `Adjustment: ${adjustmentName}` : "",
        remarks.trim(),
      ].filter(Boolean);

      for (const line of queuedLines) {
        await fetchApi("/purchase/supplier-payments", {
          method: "POST",
          body: JSON.stringify({
            supplierId: line.supplierId,
            receiptId: line.receiptId,
            officeId: selectedOfficeId,
            cashAccountId: paymentMode === "CASH" && cashAccountId ? cashAccountId : undefined,
            bankAccountId: paymentMode === "BANK" && bankAccountId ? bankAccountId : undefined,
            amount: line.amount,
            paymentDate,
            method: paymentMode,
            referenceNumber: moneyReceiptNo.trim() || undefined,
            narration: narrationParts.join(" | ") || `Payment for ${line.grnNumber}`,
          }),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplierPayables"] });
      queryClient.invalidateQueries({ queryKey: ["supplierInvoices"] });
      queryClient.invalidateQueries({ queryKey: ["supplierPaymentHistory"] });
      queryClient.invalidateQueries({ queryKey: ["supplierBills"] });
      toast.success(`Posted ${queuedLines.length} GRN payment(s) and updated Accounting GL.`);
      router.push("/purchase/supplier-payments");
    },
    onError: (err: Error) => toast.error(err.message, { title: "Payment By GRN Error" }),
  });

  const totalQueuedAmount = useMemo(
    () => round2(queuedLines.reduce((s, l) => s + l.amount, 0)),
    [queuedLines]
  );

  const inputCls =
    "h-8 w-full rounded border border-slate-300 bg-white px-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none";

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-12">
      {/* Top Sticky Bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => router.push("/purchase/supplier-payments")}
            className="rounded-full p-1 text-slate-600 transition hover:bg-slate-100"
            title="Back to Supplier Payments"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-base font-semibold text-slate-900">Payment By GRN</h1>
        </div>
        <button
          type="button"
          disabled={saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
          className="flex h-8 items-center gap-1.5 rounded bg-blue-600 px-5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {saveMutation.isPending && <Spinner className="h-3.5 w-3.5" />}
          SAVE
        </button>
      </div>

      <div className="space-y-4 p-3.5">
        {/* Form Card Matching Screenshot #4 */}
        <div className="rounded-md border border-slate-200 bg-white p-4 shadow-2xs">
          {/* Row 1: Date | Office | Cash / Bank Radio */}
          <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-700">Date</label>
              <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className={inputCls} />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-700">
                Office<span className="text-red-500">*</span>
              </label>
              <select value={selectedOfficeId} onChange={(e) => setPickedOfficeId(e.target.value)} className={inputCls}>
                <option value="">Office</option>
                {offices.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex h-8 items-center gap-6 px-1 text-xs font-medium text-slate-800">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="grnPayMode"
                  checked={paymentMode === "CASH"}
                  onChange={() => setPaymentMode("CASH")}
                  className="h-4 w-4 text-blue-600"
                />
                <span>Cash</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="grnPayMode"
                  checked={paymentMode === "BANK"}
                  onChange={() => setPaymentMode("BANK")}
                  className="h-4 w-4 text-blue-600"
                />
                <span>Bank</span>
              </label>
            </div>
          </div>

          {/* Row 2: Cash Type OR Bank Account | Adjustment Name | Money Receipt / Cheque No | Remarks */}
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {paymentMode === "CASH" ? (
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-700">
                  Cash Type<span className="text-red-500">*</span>
                </label>
                <select value={cashAccountId} onChange={(e) => setCashAccountId(e.target.value)} className={inputCls}>
                  <option value="">Cash Type</option>
                  {cashAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.code} — {acc.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-700">
                  Bank Account<span className="text-red-500">*</span>
                </label>
                <select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} className={inputCls}>
                  <option value="">Select Bank Account</option>
                  {(formOptions?.bankAccounts ?? []).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bankName} — {b.accountNumber}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-700">Adjustment Name</label>
              <select value={adjustmentName} onChange={(e) => setAdjustmentName(e.target.value)} className={inputCls}>
                <option value="">Adjustment Name</option>
                {adjustmentAccounts.map((acc) => (
                  <option key={acc.id} value={`${acc.code} - ${acc.name}`}>
                    {acc.code} — {acc.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-700">
                {paymentMode === "CASH" ? "Money Receipt No" : "Cheque / Instrument No"}
              </label>
              <input
                type="text"
                value={moneyReceiptNo}
                onChange={(e) => setMoneyReceiptNo(e.target.value)}
                placeholder={paymentMode === "CASH" ? "Money Receipt No" : "Cheque / Reference No"}
                className={inputCls}
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-700">Remarks</label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Remarks"
                className={inputCls}
              />
            </div>
          </div>

          {/* Row 3: Supplier | GRN * <due> | All | Payment Amount | Add */}
          <div className="mt-4 grid grid-cols-1 items-end gap-3 border-t border-slate-100 pt-3.5 lg:grid-cols-12">
            <div className="lg:col-span-3">
              <label className="mb-1 block text-[11px] font-semibold text-slate-700">Supplier</label>
              <SearchableCombobox
                value={selectedSupplierId}
                onChange={handleSelectSupplier}
                placeholder="Select/Search Supplier"
                options={suppliers.map((s) => ({
                  value: s.id,
                  label: s.name,
                  sublabel: `${s.code}${s.balance ? ` • Due: ${formatCurrency(s.balance)}` : ""}`,
                }))}
              />
            </div>

            <div className="lg:col-span-4">
              <div className="mb-1 flex items-center justify-between">
                <label className="text-[11px] font-semibold text-slate-700">
                  GRN<span className="text-red-500">*</span>{" "}
                  <span className="ml-1 font-mono text-slate-600">
                    {(selectedGrn?.dueAmount ?? 0).toFixed(2)}
                  </span>
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-slate-700">
                  <span>All</span>
                  <input
                    type="checkbox"
                    checked={payAllFlag}
                    onChange={(e) => handleToggleAll(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600"
                  />
                </label>
              </div>
              <SearchableCombobox
                value={selectedGrnId}
                onChange={handleSelectGrn}
                placeholder="Select/Search GRN"
                options={openGrnInvoices.map((inv) => ({
                  value: inv.id,
                  label: `${inv.grnNumber || inv.invoiceNumber} — ${inv.supplierName}`,
                  sublabel: `Date: ${inv.invoiceDate} • Due: ${formatCurrency(inv.dueAmount)}`,
                }))}
              />
            </div>

            <div className="lg:col-span-2">
              <label className="mb-1 block text-[11px] font-semibold text-slate-700">Payment Amount</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={paymentAmount}
                onChange={(e) => {
                  setPayAllFlag(false);
                  setPaymentAmount(e.target.value);
                }}
                placeholder="0.00"
                className={inputCls}
              />
            </div>

            <div className="lg:col-span-3 flex items-end">
              <button
                type="button"
                onClick={handleAddLine}
                className="h-8 rounded bg-blue-600 px-5 text-xs font-semibold text-white transition hover:bg-blue-700"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Queued GRN Payments Table / Empty State */}
        {queuedLines.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-md border border-slate-200 bg-white py-16 text-center shadow-2xs">
            <Inbox className="mb-2 h-10 w-10 text-slate-300" />
            <p className="text-sm font-semibold text-slate-500">No Data Found</p>
            <p className="mt-0.5 text-xs text-slate-400">Select an open GRN above and click Add to queue it for payment.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                    <th className="px-3 py-2">SL</th>
                    <th className="px-3 py-2">Supplier Name</th>
                    <th className="px-3 py-2">GRN Number</th>
                    <th className="px-3 py-2">GRN Date</th>
                    <th className="px-3 py-2 text-right">Due Amount (BDT)</th>
                    <th className="px-3 py-2 text-right">Payment Amount (BDT)</th>
                    <th className="px-3 py-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {queuedLines.map((row, idx) => (
                    <tr key={row.key} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-500">{idx + 1}</td>
                      <td className="px-3 py-2 font-medium text-slate-800">{row.supplierName}</td>
                      <td className="px-3 py-2 font-mono text-sky-700">{row.grnNumber}</td>
                      <td className="px-3 py-2 text-slate-600">{row.grnDate}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatCurrency(row.outstandingDue)}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-blue-700">
                        {formatCurrency(row.amount)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => setQueuedLines((prev) => prev.filter((l) => l.key !== row.key))}
                          className="rounded p-1 text-red-500 hover:bg-red-50"
                          title="Remove row"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-end gap-6 border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-xs">
              <span className="text-slate-600">
                GRN Count: <strong className="font-mono text-slate-900">{queuedLines.length}</strong>
              </span>
              <span className="text-slate-700">
                Total Payment: <strong className="font-mono text-sm text-blue-700">{formatCurrency(totalQueuedAmount)}</strong>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

