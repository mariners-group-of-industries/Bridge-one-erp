"use client";

import React, { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Paperclip, Plus, Trash2 } from "lucide-react";
import { ModalDialog } from "@/components/purchase/ModalDialog";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/purchase/Toast";
import { fetchApi } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { round2 } from "@/lib/purchase-store/rules";
import { SearchableCombobox, type PurchaseFormOptions } from "@/features/purchase/components/PurchaseFormShared";
import type { Office, PurchaseOrder, Supplier } from "@bridgeone/contracts";

interface AdvanceVoucherRow {
  key: string;
  accountCode: string;
  accountHead: string;
  supplierId: string;
  lcNo: string;
  orderId: string;
  amount: string;
  remarks: string;
}

export function AdvancePaymentModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: offices = [] } = useQuery<Office[]>({
    queryKey: ["offices"],
    queryFn: () => fetchApi("/master/offices"),
    enabled: isOpen,
  });
  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["suppliers"],
    queryFn: () => fetchApi("/master/suppliers"),
    enabled: isOpen,
  });
  const { data: purchaseOrders = [] } = useQuery<PurchaseOrder[]>({
    queryKey: ["purchase-orders"],
    queryFn: () => fetchApi("/purchase/orders"),
    enabled: isOpen,
  });
  const { data: formOptions } = useQuery<PurchaseFormOptions>({
    queryKey: ["purchase-form-options"],
    queryFn: () => fetchApi("/master/purchase-form-options"),
    enabled: isOpen,
  });

  const [employeeName, setEmployeeName] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayStr);
  const [pickedOfficeId, setPickedOfficeId] = useState("");
  const [voucherType, setVoucherType] = useState<"Cash Payment" | "Bank Payment">("Cash Payment");
  const [projectRef, setProjectRef] = useState("");
  const [narration, setNarration] = useState("");
  const [controlAmount, setControlAmount] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [cashOrBankAccountId, setCashOrBankAccountId] = useState("");
  const [accountRemarks, setAccountRemarks] = useState("");

  const defaultPayableAccount = useMemo(() => {
    const all = formOptions?.accounts ?? [];
    return (
      all.find((a) => a.name.toLowerCase().includes("accounts payable") || a.name.toLowerCase().includes("payable")) ??
      all[0] ??
      null
    );
  }, [formOptions]);

  const [rows, setRows] = useState<AdvanceVoucherRow[]>([
    {
      key: "row_1",
      accountCode: "",
      accountHead: "",
      supplierId: "",
      lcNo: "",
      orderId: "",
      amount: "",
      remarks: "",
    },
  ]);

  const selectedOfficeId = pickedOfficeId || offices[0]?.id || "";
  const effectiveEmployee = employeeName || formOptions?.employees[0]?.name || "";

  const cashAccounts = useMemo(() => {
    const all = formOptions?.accounts ?? [];
    const cash = all.filter(
      (a) =>
        a.accountType.toUpperCase() === "ASSET" &&
        (a.name.toLowerCase().includes("cash") || a.accountSubtype.toLowerCase().includes("cash"))
    );
    return cash.length > 0 ? cash : all.filter((a) => a.accountType.toUpperCase() === "ASSET");
  }, [formOptions]);

  const addEmptyRow = () => {
    setRows((prev) => [
      ...prev,
      {
        key: `row_${Date.now()}_${prev.length + 1}`,
        accountCode: defaultPayableAccount?.code || "",
        accountHead: defaultPayableAccount?.id || "",
        supplierId: "",
        lcNo: "",
        orderId: "",
        amount: "",
        remarks: "",
      },
    ]);
  };

  const updateRow = (key: string, patch: Partial<AdvanceVoucherRow>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const totalEnteredAmount = useMemo(
    () => round2(rows.reduce((sum, r) => sum + (Number(r.amount) > 0 ? Number(r.amount) : 0), 0)),
    [rows]
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!effectiveEmployee) throw new Error("Employee is required.");
      if (!paymentDate) throw new Error("Date is required.");
      if (!selectedOfficeId) throw new Error("Office is required.");
      if (voucherType === "Cash Payment" && cashAccounts.length > 0 && !cashOrBankAccountId) {
        throw new Error("Select a Cash Account.");
      }
      if (voucherType === "Bank Payment" && (formOptions?.bankAccounts.length ?? 0) > 0 && !cashOrBankAccountId) {
        throw new Error("Select a Bank Account.");
      }

      const validRows = rows.filter((r) => r.supplierId && Number(r.amount) > 0);
      if (validRows.length === 0) {
        throw new Error("Enter Partner Name and Amount (> 0) for at least one row.");
      }

      const ctrlNum = Number(controlAmount);
      if (controlAmount.trim() && Number.isFinite(ctrlNum) && ctrlNum > 0 && Math.abs(ctrlNum - totalEnteredAmount) > 0.01) {
        throw new Error(
          `Control Amount (${formatCurrency(ctrlNum)}) does not match total line amount (${formatCurrency(totalEnteredAmount)}).`
        );
      }

      const officeName = offices.find((o) => o.id === selectedOfficeId)?.name || "";
      const accountLabel =
        voucherType === "Cash Payment"
          ? cashAccounts.find((a) => a.id === cashOrBankAccountId)?.name
          : formOptions?.bankAccounts.find((b) => b.id === cashOrBankAccountId)?.bankName;

      for (const row of validRows) {
        const acctObj =
          (formOptions?.accounts ?? []).find((a) => a.id === row.accountHead) ?? defaultPayableAccount;
        const notes = [
          `Employee: ${effectiveEmployee}`,
          `Office: ${officeName}`,
          projectRef ? `Project: ${projectRef}` : "",
          accountLabel ? `${voucherType}: ${accountLabel}` : "",
          acctObj ? `Head: ${acctObj.code} ${acctObj.name}` : "",
          narration.trim(),
          accountRemarks.trim(),
          row.remarks.trim(),
          attachedFiles.length ? `Files: ${attachedFiles.map((f) => f.name).join(", ")}` : "",
        ]
          .filter(Boolean)
          .join(" | ");

        await fetchApi("/purchase/supplier-payments", {
          method: "POST",
          body: JSON.stringify({
            supplierId: row.supplierId,
            orderId: row.orderId || undefined,
            officeId: selectedOfficeId,
            cashAccountId: voucherType === "Cash Payment" && cashOrBankAccountId ? cashOrBankAccountId : undefined,
            bankAccountId: voucherType === "Bank Payment" && cashOrBankAccountId ? cashOrBankAccountId : undefined,
            amount: round2(Number(row.amount)),
            paymentDate,
            method: voucherType === "Cash Payment" ? "CASH" : "BANK",
            referenceNumber: row.lcNo.trim() || undefined,
            narration: notes,
            isAdvance: true,
          }),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplierPayables"] });
      queryClient.invalidateQueries({ queryKey: ["supplierAdvances"] });
      queryClient.invalidateQueries({ queryKey: ["supplierPaymentHistory"] });
      toast.success("Advance payment voucher saved & posted to Accounting GL.");
      onClose();
    },
    onError: (err: Error) => toast.error(err.message, { title: "Advance Payment Error" }),
  });

  const inputCls =
    "h-8 w-full rounded border border-slate-300 bg-white px-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none";

  return (
    <ModalDialog isOpen={isOpen} onClose={onClose} title="Advance Payment" maxWidth="4xl">
      <div className="space-y-4 text-xs">
        {/* Top Metadata Grid Matching Screenshot #5 */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-700">
              <span className="text-red-500">*</span> Employee
            </label>
            <SearchableCombobox
              value={effectiveEmployee}
              onChange={setEmployeeName}
              placeholder="Select Employee"
              allowClear={false}
              options={(formOptions?.employees ?? []).map((e) => ({
                value: e.name,
                label: e.name,
                sublabel: `${e.employeeCode} • ${e.department || e.designation || "Staff"}`,
              }))}
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-700">
              <span className="text-red-500">*</span> Date
            </label>
            <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className={inputCls} />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-700">
              <span className="text-red-500">*</span> Office
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

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-700">Voucher Type</label>
            <select
              value={voucherType}
              onChange={(e) => {
                setVoucherType(e.target.value === "Bank Payment" ? "Bank Payment" : "Cash Payment");
                setCashOrBankAccountId("");
              }}
              className={inputCls}
            >
              <option value="Cash Payment">Cash Payment</option>
              <option value="Bank Payment">Bank Payment</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-700">Project</label>
            <select value={projectRef} onChange={(e) => setProjectRef(e.target.value)} className={inputCls}>
              <option value="">Project</option>
              {(formOptions?.projects ?? []).map((p) => (
                <option key={p.id} value={`${p.code} - ${p.name}`}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-700">Narration</label>
            <input
              type="text"
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              placeholder="Narration"
              className={inputCls}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-6">
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-700">Control Amount</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={controlAmount}
              onChange={(e) => setControlAmount(e.target.value)}
              placeholder="Control Amount"
              className={inputCls}
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-700">Attachment</label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={(e) => {
                if (e.target.files?.length) setAttachedFiles(Array.from(e.target.files));
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex h-8 items-center gap-1.5 rounded border border-slate-300 px-2.5 text-xs text-slate-600 hover:bg-slate-50"
            >
              <Paperclip className="h-3.5 w-3.5" />
              {attachedFiles.length > 0 ? `${attachedFiles.length} file(s)` : ""}
            </button>
          </div>
        </div>

        {/* Middle Row: Cash Account / Bank Account + Remarks */}
        <div className="grid grid-cols-1 gap-3 border-t border-slate-200 pt-3 sm:grid-cols-2 lg:w-2/3 lg:ml-auto">
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-700">
              {voucherType === "Cash Payment" ? "Cash Account" : "Bank Account"}
              <span className="text-red-500">*</span>
            </label>
            <select
              value={cashOrBankAccountId}
              onChange={(e) => setCashOrBankAccountId(e.target.value)}
              className={inputCls}
            >
              <option value="">{voucherType === "Cash Payment" ? "Cash Account" : "Bank Account"}</option>
              {voucherType === "Cash Payment"
                ? cashAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.code} — {acc.name}
                    </option>
                  ))
                : (formOptions?.bankAccounts ?? []).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bankName} — {b.accountNumber}
                    </option>
                  ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-700">
              {voucherType === "Cash Payment" ? "Cash Remarks" : "Bank Remarks"}
            </label>
            <input
              type="text"
              value={accountRemarks}
              onChange={(e) => setAccountRemarks(e.target.value)}
              placeholder={voucherType === "Cash Payment" ? "Cash Remarks" : "Bank Remarks"}
              className={inputCls}
            />
          </div>
        </div>

        {/* Bottom Editable Advance Voucher Grid */}
        <div className="overflow-x-auto rounded border border-slate-200">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-[#d6e4f7] text-[11px] font-semibold text-slate-800">
                <th className="px-2.5 py-2 w-24">A/C Code</th>
                <th className="px-2.5 py-2 min-w-[160px]">Accounts Head</th>
                <th className="px-2.5 py-2 min-w-[180px]">Partner Name</th>
                <th className="px-2.5 py-2 w-28">LC NO</th>
                <th className="px-2.5 py-2 min-w-[130px]">PO No</th>
                <th className="px-2.5 py-2 w-28">Amount</th>
                <th className="px-2.5 py-2 min-w-[120px]">Remarks</th>
                <th className="px-2.5 py-2 w-16 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {rows.map((row, idx) => {
                const resolvedAccountId = row.accountHead || defaultPayableAccount?.id || "";
                const resolvedAccountObj =
                  (formOptions?.accounts ?? []).find((a) => a.id === resolvedAccountId) ?? defaultPayableAccount;
                const supplierOrders = purchaseOrders.filter(
                  (po) => po.status !== "CANCELLED" && (!row.supplierId || po.supplierId === row.supplierId)
                );

                return (
                  <tr key={row.key}>
                    <td className="px-2 py-1.5 font-mono text-[11px] text-slate-600">
                      {row.accountCode || resolvedAccountObj?.code || "-"}
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        value={resolvedAccountId}
                        onChange={(e) => {
                          const found = (formOptions?.accounts ?? []).find((a) => a.id === e.target.value);
                          updateRow(row.key, {
                            accountHead: e.target.value,
                            accountCode: found?.code || "",
                          });
                        }}
                        className="h-8 w-full rounded border border-slate-300 bg-white px-2 text-xs focus:border-blue-500 focus:outline-none"
                      >
                        {(formOptions?.accounts ?? []).map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} [{a.code}]
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <SearchableCombobox
                        value={row.supplierId}
                        onChange={(val) => updateRow(row.key, { supplierId: val, orderId: "" })}
                        placeholder="Select/Search Supplier (min..."
                        minCharsHint={3}
                        options={suppliers.map((s) => ({
                          value: s.id,
                          label: s.name,
                          sublabel: s.code,
                        }))}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={row.lcNo}
                        onChange={(e) => updateRow(row.key, { lcNo: e.target.value })}
                        placeholder="LC NO"
                        className={inputCls}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        value={row.orderId}
                        onChange={(e) => updateRow(row.key, { orderId: e.target.value })}
                        className="h-8 w-full rounded border border-slate-300 bg-white px-2 text-xs focus:border-blue-500 focus:outline-none"
                      >
                        <option value="">PO No</option>
                        {supplierOrders.map((po) => (
                          <option key={po.id} value={po.id}>
                            {po.poNumber} ({formatCurrency(po.totalAmount)})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={row.amount}
                        onChange={(e) => updateRow(row.key, { amount: e.target.value })}
                        placeholder="Amount"
                        className={inputCls}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={row.remarks}
                        onChange={(e) => updateRow(row.key, { remarks: e.target.value })}
                        placeholder="Remarks"
                        className={inputCls}
                      />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {idx === rows.length - 1 ? (
                          <button
                            type="button"
                            onClick={addEmptyRow}
                            className="rounded p-1 text-slate-600 hover:bg-blue-50 hover:text-blue-600"
                            title="Add another advance row"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
                            className="rounded p-1 text-red-500 hover:bg-red-50"
                            title="Remove row"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer matching Screenshot #5: CLOSE (red) | SAVE (blue) */}
        <div className="flex items-center justify-between border-t border-slate-200 pt-3">
          <div className="text-xs text-slate-600">
            Total Advance: <strong className="font-mono text-slate-900">{formatCurrency(totalEnteredAmount)}</strong>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-red-500 hover:text-red-600"
            >
              CLOSE
            </button>
            <button
              type="button"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
              className="inline-flex items-center gap-1.5 rounded bg-blue-600 px-5 py-1.5 text-xs font-semibold uppercase tracking-wide text-white shadow-2xs transition hover:bg-blue-700 disabled:opacity-60"
            >
              {saveMutation.isPending && <Spinner className="h-3.5 w-3.5" />}
              SAVE
            </button>
          </div>
        </div>
      </div>
    </ModalDialog>
  );
}

