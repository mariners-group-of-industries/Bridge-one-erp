"use client";

import { toast } from "@/components/purchase/Toast";
import { usePending } from "@/hooks/use-pending";
import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Eye,
  Paperclip,
  Pencil,
  Plus,
  Printer,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { ModalDialog } from "@/components/purchase/ModalDialog";
import { useAccountingStore } from "@/features/accounts/store/accounting-store";
import { MANUAL_TRANS_TYPES, transTypeBase, transTypeFilterOptions, transTypeLabel } from "@/features/accounts/transaction-types";
import type { JournalLineItem, JournalType, JournalVoucher, VoucherStatus } from "@/features/accounts/types";
import { localDate, localDaysFromToday, localToday } from "@/features/purchase/lib/client";
import { useSession } from "@/lib/auth/session";
import { Spinner } from "@/components/ui/spinner";

const blankLine = (): JournalLineItem => ({
  id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  accountId: "",
  accountCode: "",
  accountName: "",
  debit: 0,
  credit: 0,
  narration: "",
});

/** "2026-11-14", or the date part of "2026-11-14 - 1:12 PM". */
const dayOf = (value: string | undefined) => (value ?? "").slice(0, 10);

/** Fiscal year July–June, as "2026-2027". */
function fiscalYearOf(day: string) {
  const d = new Date(`${day}T00:00:00`);
  const start = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
  return `${start}-${start + 1}`;
}

export default function AccountingJournalPage() {
  const { pending, run } = usePending();
  const vouchers = useAccountingStore((s) => s.vouchers);
  const accounts = useAccountingStore((s) => s.accounts);
  const dbOffices = useAccountingStore((s) => s.offices);
  const createVoucher = useAccountingStore((s) => s.createVoucher);
  const postVoucher = useAccountingStore((s) => s.postVoucher);
  const { user } = useSession();
  const employees = useAccountingStore((s) => s.employees);
  const costCenters = useAccountingStore((s) => s.costCenters);

  // Header choices iBOS asks for: the employee the voucher is for, a project, one attachment.
  const [voucherEmployeeId, setVoucherEmployeeId] = useState("");
  const [voucherProjectId, setVoucherProjectId] = useState("");
  const [attachment, setAttachment] = useState<{ id: string; name: string } | null>(null);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const uploadAttachment = async (file: File | undefined) => {
    if (!file) return;
    setAttachmentBusy(true);
    setFormError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/accounts/journal/attachments", { method: "POST", body });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message ?? "The file could not be attached.");
      setAttachment({ id: json.data.id, name: json.data.originalName });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "The file could not be attached.");
    } finally {
      setAttachmentBusy(false);
    }
  };

  // Customers and suppliers for the line column, loaded the first time that type is picked.
  const [partyLists, setPartyLists] = useState<{ CUSTOMER?: Array<{ id: string; code: string; name: string }>; SUPPLIER?: Array<{ id: string; code: string; name: string }> }>({});
  const ensureParties = (type: "CUSTOMER" | "SUPPLIER" | "EMPLOYEE") => {
    if (type === "EMPLOYEE" || partyLists[type]) return;
    void fetch(`/api/accounts/parties?type=${type}`)
      .then((r) => r.json())
      .then((json) => json?.success && setPartyLists((prev) => ({ ...prev, [type]: json.data })));
  };
  const partyOptions = (type: string | null | undefined) =>
    type === "EMPLOYEE"
      ? employees.map((e) => ({ id: e.id, label: `${e.employeeCode} - ${e.name}` }))
      : (partyLists[type as "CUSTOMER" | "SUPPLIER"] ?? []).map((p) => ({ id: p.id, label: `${p.code} - ${p.name}` }));

  // Tabs: "ACCOUNTING_JOURNAL" | "PENDING_VOUCHER" | "VOUCHER_REPOSITORY"
  const [activeTab, setActiveTab] = useState<"ACCOUNTING_JOURNAL" | "PENDING_VOUCHER" | "VOUCHER_REPOSITORY">("ACCOUNTING_JOURNAL");

  // Common Filters
  const [search, setSearch] = useState("");
  const [selectedOffice, setSelectedOffice] = useState<string>("ALL");
  const [selectedTransType, setSelectedTransType] = useState<string>("ALL");
  // Last seven days, as iBOS opens the journal.
  const [fromDate, setFromDate] = useState(() => localDaysFromToday(-7));
  const [toDate, setToDate] = useState(() => localToday());

  // Repository-specific filters
  const [repoStatus, setRepoStatus] = useState<string>("ALL");
  const [prepareBy, setPrepareBy] = useState<string>("ALL");

  // Pagination
  const [rowsPerPage, setRowsPerPage] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [viewingVoucher, setViewingVoucher] = useState<JournalVoucher | null>(null);
  const [approveConfirmTarget, setApproveConfirmTarget] = useState<JournalVoucher | null>(null);
  const [isJvBasicCollapsed, setIsJvBasicCollapsed] = useState(false);

  // New Voucher Form
  const emptyHeader = () => ({
    transactionDate: localToday(),
    officeId: "",
    officeName: "",
    journalType: "GENERAL" as JournalType,
    transType: MANUAL_TRANS_TYPES[0] as string,
    narration: "",
    referenceNumber: "",
    status: "APPROVED" as VoucherStatus,
  });
  const [newVoucherHeader, setNewVoucherHeader] = useState(emptyHeader);
  const [controlAmount, setControlAmount] = useState("");
  // The first office the user can pick until they choose one.
  const voucherOffice = dbOffices.find((o) => o.id === newVoucherHeader.officeId) ?? dbOffices[0];

  const [lines, setLines] = useState<JournalLineItem[]>(() => [blankLine(), blankLine()]);

  const totalDebit = useMemo(() => lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0), [lines]);
  const totalCredit = useMemo(() => lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0), [lines]);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  // Office List for Filter (live DB)
  const officeOptions = useMemo(
    () => [
      { id: "ALL", name: "All Office" },
      ...dbOffices.map((o) => ({ id: o.name, name: o.name })),
    ],
    [dbOffices]
  );

  // Transaction types: manual and automatic, plus any other type on the vouchers.
  const transTypeOptions = useMemo(() => transTypeFilterOptions(vouchers), [vouchers]);

  // Everyone who prepared a voucher.
  const prepareByOptions = useMemo(
    () => ["ALL", ...[...new Set(vouchers.map((v) => v.preparedBy || v.createdBy).filter(Boolean))].sort()],
    [vouchers],
  );

  // Filtered dataset per tab
  const tabVouchers = useMemo(() => {
    return vouchers.filter((v) => {
      // Tab 1: Accounting Journal - only approved/posted records
      if (activeTab === "ACCOUNTING_JOURNAL") {
        if (v.status !== "APPROVED" && v.status !== "POSTED") return false;
      }
      // Tab 2: Pending Voucher - pending or in progress
      else if (activeTab === "PENDING_VOUCHER") {
        if (v.status !== "PENDING" && v.status !== "IN_PROGRESS" && v.status !== "DRAFT") return false;
      }
      // Tab 3: Voucher Repository - shows everything (optionally filtered by repoStatus)
      else if (activeTab === "VOUCHER_REPOSITORY") {
        if (repoStatus !== "ALL") {
          if (repoStatus === "APPROVED" && v.status !== "APPROVED" && v.status !== "POSTED") return false;
          if (repoStatus === "PENDING" && v.status !== "PENDING") return false;
          if (repoStatus === "IN_PROGRESS" && v.status !== "IN_PROGRESS") return false;
        }
        if (prepareBy !== "ALL" && (v.preparedBy || v.createdBy) !== prepareBy) return false;
      }

      // Office Filter
      if (selectedOffice !== "ALL" && v.officeName !== selectedOffice) return false;

      // Transaction Type Filter
      if (selectedTransType !== "ALL" && transTypeBase(v.transType, v.journalType) !== selectedTransType) return false;

      // Transaction date range
      const day = dayOf(v.transactionDate);
      if (fromDate && day < fromDate) return false;
      if (toDate && day > toDate) return false;

      // Search Query
      if (search.trim()) {
        const q = search.toLowerCase();
        const matches =
          v.voucherNumber.toLowerCase().includes(q) ||
          v.narration.toLowerCase().includes(q) ||
          v.officeName.toLowerCase().includes(q) ||
          (v.transType && v.transType.toLowerCase().includes(q)) ||
          (v.preparedBy && v.preparedBy.toLowerCase().includes(q)) ||
          (v.createDate && v.createDate.toLowerCase().includes(q)) ||
          v.lines.some((l) => l.accountName.toLowerCase().includes(q) || l.accountCode.includes(q));
        if (!matches) return false;
      }

      return true;
    });
  }, [vouchers, activeTab, selectedOffice, selectedTransType, repoStatus, prepareBy, search, fromDate, toDate]);

  // Paginated Slicing
  const totalRows = tabVouchers.length;
  const totalPages = Math.ceil(totalRows / rowsPerPage) || 1;
  const paginatedVouchers = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return tabVouchers.slice(start, start + rowsPerPage);
  }, [tabVouchers, currentPage, rowsPerPage]);

  const handleAddLine = () => {
    setLines([...lines, blankLine()]);
  };

  const handleRemoveLine = (id: string) => {
    if (lines.length <= 2) return;
    setLines(lines.filter((l) => l.id !== id));
  };

  const handleLineChange = (id: string, updates: Partial<JournalLineItem>) => {
    setLines(
      lines.map((l) => {
        if (l.id !== id) return l;
        if (updates.accountId) {
          const acc = accounts.find((a) => a.id === updates.accountId);
          return {
            ...l,
            ...updates,
            accountCode: acc ? acc.code : l.accountCode,
            accountName: acc ? acc.name : l.accountName,
          };
        }
        return { ...l, ...updates };
      }),
    );
  };

  const handleSubmitVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!voucherOffice) {
      setFormError("Select the office.");
      return;
    }
    const missing = lines.findIndex((l) => !l.accountId);
    if (missing >= 0) {
      setFormError(`Line ${missing + 1}: select the GL account.`);
      return;
    }
    if (lines.some((l) => (Number(l.debit) || 0) > 0 && (Number(l.credit) || 0) > 0)) {
      setFormError("A line is either a debit or a credit, not both.");
      return;
    }
    if (!isBalanced) {
      setFormError(`Cannot save: Total Debit (৳${totalDebit.toLocaleString()}) must equal Total Credit (৳${totalCredit.toLocaleString()}).`);
      return;
    }
    const voucherEmployee = employees.find((e) => e.id === voucherEmployeeId);
    if (!voucherEmployee) {
      setFormError("Select the employee.");
      return;
    }
    const unpicked = lines.findIndex((l) => l.partnerType && !l.partnerId);
    if (unpicked >= 0) {
      setFormError(`Line ${unpicked + 1}: pick the ${(lines[unpicked].partnerType ?? "").toLowerCase()} from the list.`);
      return;
    }
    if (controlAmount.trim() !== "" && Math.abs(Number(controlAmount) - totalDebit) > 0.005) {
      setFormError(`The voucher total (৳${totalDebit.toLocaleString()}) does not match the control amount (৳${Number(controlAmount).toLocaleString()}).`);
      return;
    }

    const preparedBy = user?.name ?? "";
    const res = await run("voucher", () => createVoucher({
      ...newVoucherHeader,
      officeId: voucherOffice.id,
      officeName: voucherOffice.name,
      fiscalYear: fiscalYearOf(newVoucherHeader.transactionDate),
      lines,
      preparedBy,
      createdBy: preparedBy,
      amount: totalDebit,
      createDate: localDate(new Date()),
      employeeId: voucherEmployee.id,
      employeeName: voucherEmployee.name,
      projectId: voucherProjectId || null,
      projectName: costCenters.find((c) => c.id === voucherProjectId)?.name ?? null,
      attachmentId: attachment?.id ?? null,
    }));

    if (!res.success) {
      setFormError(res.message);
      return;
    }

    setFormSuccess(res.message);
    setTimeout(() => {
      setIsCreateOpen(false);
      setFormSuccess("");
      setNewVoucherHeader(emptyHeader());
      setLines([blankLine(), blankLine()]);
      setControlAmount("");
      setVoucherEmployeeId("");
      setVoucherProjectId("");
      setAttachment(null);
    }, 800);
  };

  const handleApproveVoucher = (voucher: JournalVoucher) => {
    setApproveConfirmTarget(voucher);
  };

  const confirmApproval = async () => {
    if (!approveConfirmTarget) return;
    const res = await run("approve", () => postVoucher(approveConfirmTarget.id));
    // Keep the dialog open when the server refuses, so the user sees why.
    if (!res.success) {
      toast.error(res.message, { title: "Not posted" });
      return;
    }
    toast.success(res.message);
    setApproveConfirmTarget(null);
  };

  const handleExportExcel = () => {
    let csv = "SL,Date,Trans Number,Office Name,Trans. Type,Narration,Prepare By,Amount,Status\n";
    tabVouchers.forEach((v, i) => {
      csv += `"${i + 1}","${v.createDate || v.transactionDate}","${v.voucherNumber}","${v.officeName}","${transTypeLabel(v.transType, v.journalType)}","${(v.narration || "").replace(/"/g, '""')}","${v.preparedBy || v.createdBy}","${v.amount || v.totalDebit}","${v.status}"\n`;
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Accounting_Vouchers_${activeTab}_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  // -------------------------------------------------------------
  // FULL-PAGE MANAGERIUM VIEW: Journal Voucher Create (Screenshot 1)
  // -------------------------------------------------------------
  if (isCreateOpen) {
    const inputCls =
      "h-8 w-full border border-slate-300 rounded px-2.5 text-xs text-slate-800 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500";
    return (
      <div className="min-h-screen bg-[#f8fafc] p-3 md:p-6 text-slate-800">
        {/* Top Header Card */}
        <div className="bg-white border border-slate-200/90 rounded px-4 py-2.5 flex items-center justify-between shadow-2xs mb-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="h-8 w-8 rounded border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-base font-bold text-slate-900 tracking-tight">Journal Voucher Create</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pending === "voucher"}
              onClick={(e) => {
                void handleSubmitVoucher(e);
              }}
              className="h-8 px-4 border border-[#2563eb] text-[#2563eb] hover:bg-blue-50 font-semibold text-xs rounded transition flex items-center gap-1.5"
            >
              Save & New
            </button>
            <button
              type="submit"
              form="create-jv-form"
              disabled={pending === "voucher"}
              className="h-8 px-5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded transition flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
            >
              {pending === "voucher" && <Spinner className="size-3.5" />}
              Save
            </button>
          </div>
        </div>

        {formError && (
          <div className="mb-3 p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}
        {formSuccess && (
          <div className="mb-3 p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{formSuccess}</span>
          </div>
        )}

        <form id="create-jv-form" onSubmit={handleSubmitVoucher} className="space-y-3">
          {/* Card 1: Basic Information */}
          <div className="bg-white border border-slate-200/90 rounded shadow-2xs overflow-hidden mb-3">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 pt-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="px-4 py-2 text-xs font-semibold rounded-t bg-[#e6f2fb] text-blue-700 border-b-2 border-blue-600 transition"
                >
                  Basic Information
                </button>
              </div>
              <button
                type="button"
                onClick={() => setIsJvBasicCollapsed(!isJvBasicCollapsed)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded transition"
              >
                {isJvBasicCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            </div>

            {!isJvBasicCollapsed && (
              <div className="p-4 space-y-3.5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      <span className="text-red-500 font-bold mr-0.5">*</span>Employee
                    </label>
                    <select
                      required
                      value={voucherEmployeeId}
                      onChange={(e) => setVoucherEmployeeId(e.target.value)}
                      className={inputCls}
                    >
                      <option value="">Select Employee</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} ({emp.employeeCode})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      <span className="text-red-500 font-bold mr-0.5">*</span>Date
                    </label>
                    <input
                      type="date"
                      required
                      value={newVoucherHeader.transactionDate}
                      onChange={(e) => setNewVoucherHeader({ ...newVoucherHeader, transactionDate: e.target.value })}
                      className={inputCls}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      <span className="text-red-500 font-bold mr-0.5">*</span>Office
                    </label>
                    <select
                      value={voucherOffice?.id ?? ""}
                      onChange={(e) => {
                        const office = dbOffices.find((o) => o.id === e.target.value);
                        setNewVoucherHeader({ ...newVoucherHeader, officeId: office?.id ?? "", officeName: office?.name ?? "" });
                      }}
                      className={inputCls}
                    >
                      <option value="">Office</option>
                      {dbOffices.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Voucher Type</label>
                    <select
                      value={newVoucherHeader.transType}
                      onChange={(e) => setNewVoucherHeader({ ...newVoucherHeader, transType: e.target.value })}
                      className={inputCls}
                    >
                      {MANUAL_TRANS_TYPES.map((tt) => (
                        <option key={tt} value={tt}>
                          {tt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Project</label>
                    <select
                      value={voucherProjectId}
                      onChange={(e) => setVoucherProjectId(e.target.value)}
                      className={inputCls}
                    >
                      <option value="">Project</option>
                      {costCenters
                        .filter((c) => c.status === "ACTIVE")
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.code} - {c.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      <span className="text-red-500 font-bold mr-0.5">*</span>Narration
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Narration"
                      value={newVoucherHeader.narration}
                      onChange={(e) => setNewVoucherHeader({ ...newVoucherHeader, narration: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 max-w-xl pt-1">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Control Amount</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Control Amount"
                      value={controlAmount}
                      onChange={(e) => setControlAmount(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700 flex items-center">
                      <Paperclip className="w-3.5 h-3.5 mr-1 text-slate-400" />
                      Attachment
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept="application/pdf,image/png,image/jpeg,image/webp"
                        disabled={attachmentBusy}
                        onChange={(e) => {
                          void uploadAttachment(e.target.files?.[0]);
                          e.target.value = "";
                        }}
                        className="text-xs file:mr-2 file:h-8 file:rounded file:border file:border-slate-300 file:bg-white file:px-2.5 file:text-xs file:font-medium file:text-slate-700"
                      />
                      {attachment && (
                        <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-700">
                          {attachment.name}
                          <button type="button" onClick={() => setAttachment(null)} className="text-rose-500 font-bold">
                            ×
                          </button>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Card 2: Line Items Table */}
          <div className="bg-white border border-slate-200/90 rounded shadow-2xs overflow-hidden mb-3">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5">
              <span className="text-xs font-bold text-slate-800">Double-Entry Account Line Items</span>
              <button
                type="button"
                onClick={handleAddLine}
                className="inline-flex items-center gap-1 text-xs px-3 py-1 bg-[#2563eb] hover:bg-blue-700 text-white rounded font-semibold shadow-2xs transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Row</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-blue-200 bg-[#e6f2fb] text-[11px] font-semibold text-slate-800">
                    <th className="p-2.5 w-72">Chart Of Account</th>
                    <th className="p-2.5 min-w-[260px]">Customer/Supplier/Employee</th>
                    <th className="p-2.5 w-32 text-right">Debit</th>
                    <th className="p-2.5 w-32 text-right">Credit</th>
                    <th className="p-2.5 min-w-[160px]">Remarks</th>
                    <th className="p-2.5 w-10 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50">
                      <td className="p-2">
                        <select
                          value={l.accountId}
                          onChange={(e) => handleLineChange(l.id, { accountId: e.target.value })}
                          className="w-full border border-slate-300 rounded px-2 py-1 bg-white focus:ring-1 focus:ring-blue-500 text-xs"
                        >
                          <option value="">Accounts Head</option>
                          {accounts
                            .filter((a) => !a.isGroup)
                            .map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.code} - {a.name}
                              </option>
                            ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <div className="flex gap-1">
                          <select
                            value={l.partnerType ?? ""}
                            onChange={(e) => {
                              const type = (e.target.value || null) as JournalLineItem["partnerType"];
                              if (type) ensureParties(type);
                              handleLineChange(l.id, { partnerType: type, partnerId: null, partnerName: null });
                            }}
                            className="w-24 shrink-0 border border-slate-300 rounded px-1.5 py-1 bg-white text-xs focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="">—</option>
                            <option value="CUSTOMER">Customer</option>
                            <option value="SUPPLIER">Supplier</option>
                            <option value="EMPLOYEE">Employee</option>
                          </select>
                          {l.partnerType && (
                            <>
                              <input
                                list={`jv-party-${l.id}`}
                                value={l.partnerName ?? ""}
                                onChange={(e) => {
                                  const match = partyOptions(l.partnerType).find((o) => o.label === e.target.value);
                                  handleLineChange(l.id, { partnerName: e.target.value, partnerId: match?.id ?? null });
                                }}
                                placeholder="Search…"
                                className={`min-w-0 flex-1 border border-slate-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 ${
                                  l.partnerName && !l.partnerId ? "border-rose-400" : ""
                                }`}
                              />
                              <datalist id={`jv-party-${l.id}`}>
                                {partyOptions(l.partnerType).map((o) => (
                                  <option key={o.id} value={o.label} />
                                ))}
                              </datalist>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={l.debit || ""}
                          onChange={(e) => handleLineChange(l.id, { debit: parseFloat(e.target.value) || 0 })}
                          placeholder="Debit"
                          className="w-full text-right border border-slate-300 rounded px-2 py-1 font-mono text-xs focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={l.credit || ""}
                          onChange={(e) => handleLineChange(l.id, { credit: parseFloat(e.target.value) || 0 })}
                          placeholder="Credit"
                          className="w-full text-right border border-slate-300 rounded px-2 py-1 font-mono text-xs focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={l.narration || ""}
                          onChange={(e) => handleLineChange(l.id, { narration: e.target.value })}
                          placeholder="Remarks"
                          className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="p-2 text-center">
                        {lines.length > 2 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(l.id)}
                            className="text-slate-400 hover:text-rose-600 transition"
                            title="Remove line"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t border-slate-200 font-semibold text-xs">
                    <td colSpan={2} className="p-2.5 text-right text-slate-700">
                      Total:
                    </td>
                    <td className="p-2.5 text-right font-mono text-blue-700">
                      ৳{totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-2.5 text-right font-mono text-blue-700">
                      ৳{totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td colSpan={2} className="p-2.5">
                      {!isBalanced ? (
                        <span className="text-[11px] text-rose-600 font-medium">
                          Difference: ৳{Math.abs(totalDebit - totalCredit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className="text-[11px] text-emerald-600 font-medium">Balanced ✓</span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 font-sans flex flex-col md:h-[calc(100dvh-3.5rem)] md:overflow-hidden print:block print:h-auto print:overflow-visible">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP BAR: TABS ON LEFT + ACTIONS/SEARCH ON RIGHT */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-surface rounded border border-line/90 shadow-2xs p-2.5 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* TABS */}
          <div className="flex items-center gap-1.5 border-b md:border-b-0 border-line pb-2 md:pb-0 overflow-x-auto">
            <button
              onClick={() => {
                setActiveTab("ACCOUNTING_JOURNAL");
                setCurrentPage(1);
              }}
              className={`px-4 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
                activeTab === "ACCOUNTING_JOURNAL"
                  ? "bg-grid-head text-primary border border-accent-line"
                  : "text-ink-muted hover:bg-control"
              }`}
            >
              Accounting Journal
            </button>
            <button
              onClick={() => {
                setActiveTab("PENDING_VOUCHER");
                setCurrentPage(1);
              }}
              className={`px-4 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
                activeTab === "PENDING_VOUCHER"
                  ? "bg-grid-head text-primary border border-accent-line"
                  : "text-ink-muted hover:bg-control"
              }`}
            >
              Pending Voucher
            </button>
            <button
              onClick={() => {
                setActiveTab("VOUCHER_REPOSITORY");
                setCurrentPage(1);
              }}
              className={`px-4 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
                activeTab === "VOUCHER_REPOSITORY"
                  ? "bg-grid-head text-primary border border-accent-line"
                  : "text-ink-muted hover:bg-control"
              }`}
            >
              Voucher Repository
            </button>
          </div>

          {/* TOP RIGHT CONTROLS */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Box */}
            <div className="relative min-w-[180px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-8 pr-2.5 py-1 text-xs border border-line-strong rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-surface"
              />
            </div>

            {/* Extra Buttons in Voucher Repository Tab */}
            {activeTab === "VOUCHER_REPOSITORY" && (
              <>
                <button
                  onClick={handleExportExcel}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors shadow-2xs"
                >
                  Export to Excel
                </button>
                <button
                  onClick={handlePrint}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors shadow-2xs"
                >
                  PDF
                </button>
              </>
            )}

            {/* + Journal Button */}
            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Journal</span>
            </button>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* 2. FILTER TOOLBAR (Matches Screenshots 1, 2, 3) */}
        {/* ------------------------------------------------------------- */}
        <div className="mt-3 pt-3 border-t border-line">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 lg:grid-cols-6 gap-2.5 items-end">
            {/* Office Filter */}
            <div>
              <label className="block text-[11px] font-medium text-ink-muted mb-0.5">Office</label>
              <select
                value={selectedOffice}
                onChange={(e) => {
                  setSelectedOffice(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full text-xs border border-line-strong rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-surface text-ink-muted"
              >
                {officeOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Transaction Type Filter */}
            <div>
              <label className="block text-[11px] font-medium text-ink-muted mb-0.5">Transaction Type</label>
              <select
                value={selectedTransType}
                onChange={(e) => {
                  setSelectedTransType(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full text-xs border border-line-strong rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-surface text-ink-muted truncate"
              >
                <option value="ALL">Transaction Type (All)</option>
                {transTypeOptions.map((tt) => (
                  <option key={tt} value={tt}>
                    {tt}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter (Only on Voucher Repository) */}
            {activeTab === "VOUCHER_REPOSITORY" && (
              <div>
                <label className="block text-[11px] font-medium text-ink-muted mb-0.5">Status</label>
                <select
                  value={repoStatus}
                  onChange={(e) => {
                    setRepoStatus(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full text-xs border border-line-strong rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-surface text-ink-muted"
                >
                  <option value="ALL">Status (All)</option>
                  <option value="APPROVED">Approved</option>
                  <option value="PENDING">Pending</option>
                  <option value="IN_PROGRESS">In Progress</option>
                </select>
              </div>
            )}

            {/* From Date */}
            <div>
              <label className="block text-[11px] font-medium text-ink-muted mb-0.5">From Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full text-xs border border-line-strong rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-surface text-ink-muted"
                />
              </div>
            </div>

            {/* To Date */}
            <div>
              <label className="block text-[11px] font-medium text-ink-muted mb-0.5">To Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full text-xs border border-line-strong rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-surface text-ink-muted"
                />
              </div>
            </div>

            {/* Prepare By (Only on Voucher Repository) */}
            {activeTab === "VOUCHER_REPOSITORY" && (
              <div>
                <label className="block text-[11px] font-medium text-ink-muted mb-0.5">Prepare By</label>
                <select
                  value={prepareBy}
                  onChange={(e) => {
                    setPrepareBy(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full text-xs border border-line-strong rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-surface text-ink-muted truncate"
                >
                  {prepareByOptions.map((pb) => (
                    <option key={pb} value={pb}>
                      {pb === "ALL" ? "Prepare By (All)" : pb}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* View Filter Button */}
            <div>
              <button
                onClick={() => setCurrentPage(1)}
                className="w-full sm:w-auto px-5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold transition-colors shadow-2xs"
              >
                View
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. MAIN DATA TABLE (Conditional on Tab) */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-surface rounded border border-line/90 shadow-2xs overflow-hidden flex-1 min-h-0 flex flex-col print:block">
        <div className="flex-1 min-h-0 overflow-auto print:overflow-visible [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
          {/* TAB 1: ACCOUNTING JOURNAL TABLE */}
          {activeTab === "ACCOUNTING_JOURNAL" && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-canvas text-ink-muted font-semibold border-b border-line uppercase text-[11px] tracking-wider">
                  <th className="py-2 px-3 w-12 text-center">SL</th>
                  <th className="py-2 px-3 text-center w-20">Action</th>
                  <th className="py-2 px-3 w-24">Create Date</th>
                  <th className="py-2 px-3 w-36">Transaction Date</th>
                  <th className="py-2 px-3 w-36">Trans Number</th>
                  <th className="py-2 px-3 w-36">Office Name</th>
                  <th className="py-2 px-3 w-44">Trans. Type</th>
                  <th className="py-2 px-3">Narration</th>
                  <th className="py-2 px-3 text-right w-28">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-ink-muted">
                {paginatedVouchers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-ink-faint">
                      No accounting journal entries found matching criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedVouchers.map((v, index) => {
                    const sl = (currentPage - 1) * rowsPerPage + index + 1;
                    return (
                      <tr key={v.id} className="hover:bg-blue-50/40 dark:hover:bg-blue-500/10 transition-colors">
                        <td className="py-2 px-3 text-center text-ink-faint">{sl}</td>
                        <td className="py-2 px-3 text-center">
                          <div className="row-actions flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setViewingVoucher(v)}
                              title="View Voucher"
                              className="w-6 h-6 rounded-full bg-control hover:bg-blue-100 dark:hover:bg-blue-500/15 text-ink-muted hover:text-blue-700 dark:hover:text-blue-300 flex items-center justify-center transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setViewingVoucher(v)}
                              title="Print Voucher"
                              className="w-6 h-6 rounded-full bg-control hover:bg-blue-100 dark:hover:bg-blue-500/15 text-ink-muted hover:text-blue-700 dark:hover:text-blue-300 flex items-center justify-center transition-colors"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-ink-muted whitespace-nowrap">{v.createDate || v.transactionDate.split(" - ")[0]}</td>
                        <td className="py-2 px-3 text-ink-muted whitespace-nowrap font-mono text-[11px]">{v.transactionDate}</td>
                        <td className="py-2 px-3">
                          <button
                            onClick={() => setViewingVoucher(v)}
                            className="text-blue-600 dark:text-blue-400 hover:underline font-medium font-mono text-left"
                          >
                            {v.voucherNumber}
                          </button>
                        </td>
                        <td className="py-2 px-3 font-medium text-ink whitespace-nowrap">{v.officeName}</td>
                        <td className="py-2 px-3 text-ink-muted whitespace-nowrap">{transTypeLabel(v.transType, v.journalType)}</td>
                        <td className="py-2 px-3 text-ink-muted max-w-md truncate" title={v.narration}>
                          {v.narration}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-medium text-ink whitespace-nowrap">
                          {(v.amount || v.totalDebit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {/* TAB 2: PENDING VOUCHER TABLE */}
          {activeTab === "PENDING_VOUCHER" && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-canvas text-ink-muted font-semibold border-b border-line uppercase text-[11px] tracking-wider">
                  <th className="py-2 px-3 w-12 text-center">SL</th>
                  <th className="py-2 px-3 text-center w-24">Action</th>
                  <th className="py-2 px-3 w-28">Date</th>
                  <th className="py-2 px-3 w-36">Trans Number</th>
                  <th className="py-2 px-3 w-36">Office Name</th>
                  <th className="py-2 px-3 w-48">Trans. Type</th>
                  <th className="py-2 px-3">Narration</th>
                  <th className="py-2 px-3 text-right w-28">Amount</th>
                  <th className="py-2 px-3 text-center w-28">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-ink-muted">
                {paginatedVouchers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-ink-faint">
                      No pending vouchers waiting for approval.
                    </td>
                  </tr>
                ) : (
                  paginatedVouchers.map((v, index) => {
                    const sl = (currentPage - 1) * rowsPerPage + index + 1;
                    return (
                      <tr key={v.id} className="hover:bg-blue-50/40 dark:hover:bg-blue-500/10 transition-colors">
                        <td className="py-2 px-3 text-center text-ink-faint">{sl}</td>
                        <td className="py-2 px-3 text-center">
                          <div className="row-actions flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setViewingVoucher(v)}
                              title="Edit / Review Voucher"
                              className="w-6 h-6 rounded-full bg-control hover:bg-blue-100 dark:hover:bg-blue-500/15 text-ink-muted hover:text-blue-700 dark:hover:text-blue-300 flex items-center justify-center transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleApproveVoucher(v)}
                              title="Approve Voucher"
                              className="w-6 h-6 rounded-full bg-amber-50 dark:bg-amber-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/15 text-amber-600 dark:text-amber-400 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center justify-center transition-colors"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-ink-muted whitespace-nowrap">{v.createDate || v.transactionDate}</td>
                        <td className="py-2 px-3">
                          <button
                            onClick={() => setViewingVoucher(v)}
                            className="text-blue-600 dark:text-blue-400 hover:underline font-medium font-mono text-left"
                          >
                            {v.voucherNumber}
                          </button>
                        </td>
                        <td className="py-2 px-3 font-medium text-ink whitespace-nowrap">{v.officeName}</td>
                        <td className="py-2 px-3 text-ink-muted whitespace-nowrap">{transTypeLabel(v.transType, v.journalType)}</td>
                        <td className="py-2 px-3 text-ink-muted max-w-md truncate" title={v.narration}>
                          {v.narration}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-medium text-ink whitespace-nowrap">
                          {(v.amount || v.totalDebit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          {v.status === "PENDING" ? (
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30">
                              Pending
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold text-ink-muted bg-control border border-line">
                              In Progress
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {/* TAB 3: VOUCHER REPOSITORY TABLE */}
          {activeTab === "VOUCHER_REPOSITORY" && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-canvas text-ink-muted font-semibold border-b border-line uppercase text-[11px] tracking-wider">
                  <th className="py-2 px-3 w-12 text-center">SL</th>
                  <th className="py-2 px-3 text-center w-24">Action</th>
                  <th className="py-2 px-3 w-28">Date</th>
                  <th className="py-2 px-3 w-36">Trans Number</th>
                  <th className="py-2 px-3 w-36">Office Name</th>
                  <th className="py-2 px-3 w-40">Trans. Type</th>
                  <th className="py-2 px-3">Narration</th>
                  <th className="py-2 px-3 w-36">Prepare By</th>
                  <th className="py-2 px-3 text-right w-28">Amount</th>
                  <th className="py-2 px-3 text-center w-24">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-ink-muted">
                {paginatedVouchers.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-ink-faint">
                      No vouchers found in repository matching criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedVouchers.map((v, index) => {
                    const sl = (currentPage - 1) * rowsPerPage + index + 1;
                    return (
                      <tr key={v.id} className="hover:bg-blue-50/40 dark:hover:bg-blue-500/10 transition-colors">
                        <td className="py-2 px-3 text-center text-ink-faint">{sl}</td>
                        <td className="py-2 px-3 text-center">
                          <div className="row-actions flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setViewingVoucher(v)}
                              title="View Voucher"
                              className="w-6 h-6 rounded-full bg-control hover:bg-blue-100 dark:hover:bg-blue-500/15 text-ink-muted hover:text-blue-700 dark:hover:text-blue-300 flex items-center justify-center transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setViewingVoucher(v)}
                              title="Print Voucher"
                              className="w-6 h-6 rounded-full bg-control hover:bg-blue-100 dark:hover:bg-blue-500/15 text-ink-muted hover:text-blue-700 dark:hover:text-blue-300 flex items-center justify-center transition-colors"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-ink-muted whitespace-nowrap">{v.createDate || v.transactionDate.split(" - ")[0]}</td>
                        <td className="py-2 px-3">
                          <button
                            onClick={() => setViewingVoucher(v)}
                            className="text-blue-600 dark:text-blue-400 hover:underline font-medium font-mono text-left"
                          >
                            {v.voucherNumber}
                          </button>
                        </td>
                        <td className="py-2 px-3 font-medium text-ink whitespace-nowrap">{v.officeName}</td>
                        <td className="py-2 px-3 text-ink-muted whitespace-nowrap">{transTypeLabel(v.transType, v.journalType)}</td>
                        <td className="py-2 px-3 text-ink-muted max-w-sm truncate" title={v.narration}>
                          {v.narration}
                        </td>
                        <td className="py-2 px-3 text-ink-muted whitespace-nowrap">{v.preparedBy || v.createdBy}</td>
                        <td className="py-2 px-3 text-right font-mono font-medium text-ink whitespace-nowrap">
                          {(v.amount || v.totalDebit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          {v.status === "APPROVED" || v.status === "POSTED" ? (
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
                              Approved
                            </span>
                          ) : v.status === "PENDING" ? (
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
                              Pending
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold text-ink-muted bg-control border border-line">
                              In Progress
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* ------------------------------------------------------------- */}
        {/* 4. TABLE FOOTER / PAGINATION (Matches Screenshot) */}
        {/* ------------------------------------------------------------- */}
        <div className="p-3 border-t border-line bg-canvas/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-ink-muted shrink-0">
          <div className="flex items-center gap-2">
            <span>
              Showing {totalRows === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1}–
              {Math.min(currentPage * rowsPerPage, totalRows)} of {totalRows} Rows
            </span>
            <span className="text-ink-faint">|</span>
            <div className="flex items-center gap-1.5">
              <span>Rows</span>
              <select
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="text-xs border border-line-strong rounded px-1.5 py-0.5 bg-surface text-ink-muted focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button aria-label="Previous page"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="w-7 h-7 flex items-center justify-center rounded border border-line bg-surface hover:bg-control disabled:opacity-40 disabled:cursor-not-allowed text-ink-muted transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = i + 1;
              return (
                <button
                  key={p}
                  onClick={() => setCurrentPage(p)}
                  className={`w-7 h-7 flex items-center justify-center rounded text-xs font-medium transition-colors ${
                    currentPage === p
                      ? "bg-blue-600 text-white font-semibold shadow-2xs"
                      : "border border-line bg-surface hover:bg-control text-ink-muted"
                  }`}
                >
                  {p}
                </button>
              );
            })}
            <button aria-label="Next page"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="w-7 h-7 flex items-center justify-center rounded border border-line bg-surface hover:bg-control disabled:opacity-40 disabled:cursor-not-allowed text-ink-muted transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 5. MODAL: CREATE JOURNAL VOUCHER */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Journal Voucher"
        maxWidth="4xl"
      >
        <form onSubmit={handleSubmitVoucher} className="space-y-4">
          {formError && (
            <div className="p-2.5 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs rounded flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}
          {formSuccess && (
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs rounded flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{formSuccess}</span>
            </div>
          )}

          {/* Voucher Header Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-canvas p-3 rounded border border-line text-xs">
            <div>
              <label className="block text-ink-muted font-medium mb-1">Office / Branch *</label>
              <select
                value={voucherOffice?.id ?? ""}
                onChange={(e) => {
                  const office = dbOffices.find((o) => o.id === e.target.value);
                  setNewVoucherHeader({ ...newVoucherHeader, officeId: office?.id ?? "", officeName: office?.name ?? "" });
                }}
                className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface focus:ring-1 focus:ring-blue-500"
              >
                {dbOffices.length === 0 && <option value="">No office available</option>}
                {dbOffices.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-ink-muted font-medium mb-1">Transaction Date *</label>
              <input
                type="date"
                required
                value={newVoucherHeader.transactionDate}
                onChange={(e) => setNewVoucherHeader({ ...newVoucherHeader, transactionDate: e.target.value })}
                className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-ink-muted font-medium mb-1">Voucher Type *</label>
              <select
                value={newVoucherHeader.transType}
                onChange={(e) => setNewVoucherHeader({ ...newVoucherHeader, transType: e.target.value })}
                className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface focus:ring-1 focus:ring-blue-500"
              >
                {MANUAL_TRANS_TYPES.map((tt) => (
                  <option key={tt} value={tt}>
                    {tt}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-ink-muted font-medium mb-1">Prepared By</label>
              {/* Always the signed-in user. */}
              <input
                type="text"
                readOnly
                value={user?.name ?? ""}
                className="w-full border border-line rounded px-2.5 py-1.5 bg-canvas text-ink-muted"
              />
            </div>
            <div className="sm:col-span-2 md:col-span-3">
              <label className="block text-ink-muted font-medium mb-1">Narration / Description *</label>
              <input
                type="text"
                required
                placeholder="Enter complete voucher narration..."
                value={newVoucherHeader.narration}
                onChange={(e) => setNewVoucherHeader({ ...newVoucherHeader, narration: e.target.value })}
                className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="jv-control-amount" className="block text-ink-muted font-medium mb-1">Control Amount</label>
              {/* As in iBOS: when given, the voucher total must equal it before it can be saved. */}
              <input
                id="jv-control-amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="Control Amount"
                value={controlAmount}
                onChange={(e) => setControlAmount(e.target.value)}
                className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface font-mono text-right focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="jv-employee" className="block text-ink-muted font-medium mb-1">Employee *</label>
              <select
                id="jv-employee"
                required
                value={voucherEmployeeId}
                onChange={(e) => setVoucherEmployeeId(e.target.value)}
                className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select employee</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.employeeCode})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="jv-project" className="block text-ink-muted font-medium mb-1">Project</label>
              <select
                id="jv-project"
                value={voucherProjectId}
                onChange={(e) => setVoucherProjectId(e.target.value)}
                className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Project</option>
                {costCenters
                  .filter((c) => c.status === "ACTIVE")
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} - {c.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="jv-attachment" className="block text-ink-muted font-medium mb-1">Attachment</label>
              <div className="flex items-center gap-2">
                <input
                  id="jv-attachment"
                  type="file"
                  accept="application/pdf,image/png,image/jpeg,image/webp"
                  disabled={attachmentBusy}
                  onChange={(e) => {
                    void uploadAttachment(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                  className="text-xs file:mr-2 file:h-8 file:rounded file:border file:border-line-strong file:bg-surface file:px-3 file:text-xs file:font-medium file:text-ink-muted hover:file:bg-canvas"
                />
                {attachmentBusy && <Spinner className="size-3.5" />}
                {attachment && (
                  <span className="inline-flex items-center gap-1 rounded bg-control px-2 py-1 text-[11px] text-ink-muted">
                    {attachment.name}
                    <button type="button" onClick={() => setAttachment(null)} aria-label="Remove attachment" className="inline-flex size-6 items-center justify-center rounded hover:text-rose-600 dark:hover:text-rose-400">
                      ×
                    </button>
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] text-ink-faint">PDF, PNG, JPEG or WebP, up to 5 MB.</p>
            </div>
          </div>

          {/* Double-Entry Debit/Credit Table */}
          <div className="border border-line rounded overflow-hidden">
            <div className="bg-control p-2 border-b border-line flex items-center justify-between">
              <span className="text-xs font-semibold text-ink">Double-Entry Account Line Items</span>
              <button
                type="button"
                onClick={handleAddLine}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-surface border border-line-strong hover:bg-canvas text-ink-muted rounded font-medium shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Row</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-canvas border-b border-line text-ink-muted font-semibold uppercase text-[11px]">
                    <th className="p-2 w-72">GL Account</th>
                    <th className="p-2 min-w-[260px]">Customer/Supplier/Employee</th>
                    <th className="p-2 w-32 text-right">Debit (৳)</th>
                    <th className="p-2 w-32 text-right">Credit (৳)</th>
                    <th className="p-2 min-w-[160px]">Line Narration</th>
                    <th className="p-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {lines.map((l) => (
                    <tr key={l.id} className="hover:bg-canvas/50">
                      <td className="p-2">
                        <select
                          value={l.accountId}
                          onChange={(e) => handleLineChange(l.id, { accountId: e.target.value })}
                          className="w-full border border-line-strong rounded px-2 py-1 bg-surface focus:ring-1 focus:ring-blue-500 text-xs"
                        >
                          <option value="">Select account</option>
                          {accounts
                            .filter((a) => !a.isGroup)
                            .map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.code} - {a.name}
                              </option>
                            ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <div className="flex gap-1">
                          <select
                            aria-label="Partner type"
                            value={l.partnerType ?? ""}
                            onChange={(e) => {
                              const type = (e.target.value || null) as JournalLineItem["partnerType"];
                              if (type) ensureParties(type);
                              handleLineChange(l.id, { partnerType: type, partnerId: null, partnerName: null });
                            }}
                            className="w-24 shrink-0 border border-line-strong rounded px-1.5 py-1 bg-surface text-xs focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="">—</option>
                            <option value="CUSTOMER">Customer</option>
                            <option value="SUPPLIER">Supplier</option>
                            <option value="EMPLOYEE">Employee</option>
                          </select>
                          {l.partnerType && (
                            <>
                              <input
                                aria-label="Customer, supplier or employee"
                                list={`jv-party-${l.id}`}
                                value={l.partnerName ?? ""}
                                onChange={(e) => {
                                  const match = partyOptions(l.partnerType).find((o) => o.label === e.target.value);
                                  handleLineChange(l.id, { partnerName: e.target.value, partnerId: match?.id ?? null });
                                }}
                                placeholder="Search…"
                                className={`min-w-0 flex-1 border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 ${l.partnerName && !l.partnerId ? "border-rose-300 dark:border-rose-500/30" : "border-line-strong"}`}
                              />
                              <datalist id={`jv-party-${l.id}`}>
                                {partyOptions(l.partnerType).map((o) => (
                                  <option key={o.id} value={o.label} />
                                ))}
                              </datalist>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={l.debit || ""}
                          onChange={(e) => handleLineChange(l.id, { debit: parseFloat(e.target.value) || 0 })}
                          placeholder="0.00"
                          className="w-full text-right border border-line-strong rounded px-2 py-1 font-mono text-xs focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={l.credit || ""}
                          onChange={(e) => handleLineChange(l.id, { credit: parseFloat(e.target.value) || 0 })}
                          placeholder="0.00"
                          className="w-full text-right border border-line-strong rounded px-2 py-1 font-mono text-xs focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={l.narration || ""}
                          onChange={(e) => handleLineChange(l.id, { narration: e.target.value })}
                          placeholder="Particulars..."
                          className="w-full border border-line-strong rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(l.id)}
                          disabled={lines.length <= 2}
                          className="text-ink-faint hover:text-rose-600 dark:hover:text-rose-400 disabled:opacity-20 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-canvas font-semibold border-t border-line">
                    <td className="p-2 text-right text-ink-muted">Total:</td>
                    <td className="p-2 text-right font-mono text-ink">৳{totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="p-2 text-right font-mono text-ink">৳{totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td colSpan={2} className="p-2 text-left">
                      {isBalanced ? (
                        <span className="text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Balanced
                        </span>
                      ) : (
                        <span className="text-rose-700 dark:text-rose-300 text-[11px] font-semibold flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" /> Unbalanced (Diff: ৳{Math.abs(totalDebit - totalCredit).toLocaleString()})
                        </span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-1.5 border border-line-strong rounded text-xs font-medium text-ink-muted hover:bg-canvas transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isBalanced || pending === "voucher"}
              className="inline-flex items-center justify-center gap-1.5 px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-2xs"
            >{pending === "voucher" && <Spinner className="size-3.5" />}
              Post Voucher
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* ------------------------------------------------------------- */}
      {/* 6. MODAL: VIEW / PRINT VOUCHER */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={Boolean(viewingVoucher)}
        onClose={() => setViewingVoucher(null)}
        title={viewingVoucher ? `Voucher Details: ${viewingVoucher.voucherNumber}` : ""}
        maxWidth="2xl"
      >
        {viewingVoucher && (
          <div className="space-y-4 text-xs font-sans">
            {/* Header / Company Stamp */}
            <div className="p-3 bg-canvas rounded border border-line">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-sm text-ink">BridgeOne Industrial ERP</h4>
                  <p className="text-ink-faint text-[11px]">{viewingVoucher.officeName}</p>
                  <p className="text-ink-faint text-[11px]">Type: {transTypeLabel(viewingVoucher.transType, viewingVoucher.journalType)}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 block">{viewingVoucher.voucherNumber}</span>
                  <span className="text-ink-faint text-[11px]">Date: {viewingVoucher.createDate || viewingVoucher.transactionDate}</span>
                  <span className="block mt-1">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300">
                      {viewingVoucher.status}
                    </span>
                  </span>
                </div>
              </div>
              <div className="mt-2.5 pt-2 border-t border-line text-ink-muted">
                <span className="font-semibold text-ink">Narration:</span> {viewingVoucher.narration}
              </div>
            </div>

            {/* Line Items Table */}
            <div className="border border-line rounded overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-control text-ink-muted uppercase font-semibold text-[11px]">
                    <th className="p-2">Account Code & Name</th>
                    <th className="p-2 text-right">Debit (৳)</th>
                    <th className="p-2 text-right">Credit (৳)</th>
                    <th className="p-2">Particulars</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {viewingVoucher.lines.map((l) => (
                    <tr key={l.id}>
                      <td className="p-2 font-medium text-ink">
                        {l.accountCode} - {l.accountName}
                      </td>
                      <td className="p-2 text-right font-mono text-ink">
                        {l.debit > 0 ? l.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-"}
                      </td>
                      <td className="p-2 text-right font-mono text-ink">
                        {l.credit > 0 ? l.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-"}
                      </td>
                      <td className="p-2 text-ink-muted">{l.narration || "-"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-canvas font-bold border-t border-line">
                    <td className="p-2 text-right text-ink">Total:</td>
                    <td className="p-2 text-right font-mono text-ink">
                      ৳{viewingVoucher.totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2 text-right font-mono text-ink">
                      ৳{viewingVoucher.totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-3 gap-4 pt-6 text-center text-[11px] text-ink-muted">
              <div className="border-t border-line-strong pt-1">
                <p className="font-semibold">{viewingVoucher.preparedBy || viewingVoucher.createdBy}</p>
                <p className="text-ink-faint">Prepared By</p>
              </div>
              <div className="border-t border-line-strong pt-1">
                <p className="font-semibold">Accounts Officer</p>
                <p className="text-ink-faint">Verified By</p>
              </div>
              <div className="border-t border-line-strong pt-1">
                <p className="font-semibold">{viewingVoucher.approvedBy || "Finance Controller"}</p>
                <p className="text-ink-faint">Approved By</p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                onClick={() => setViewingVoucher(null)}
                className="px-4 py-1.5 border border-line-strong rounded text-xs font-medium text-ink-muted hover:bg-canvas"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-2xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Voucher</span>
              </button>
            </div>
          </div>
        )}
      </ModalDialog>

      {/* ------------------------------------------------------------- */}
      {/* 7. MODAL: APPROVE PENDING VOUCHER CONFIRMATION */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={Boolean(approveConfirmTarget)}
        onClose={() => setApproveConfirmTarget(null)}
        title="Approve Voucher"
        maxWidth="sm"
      >
        {approveConfirmTarget && (
          <div className="space-y-3 text-xs">
            <p className="text-ink-muted">
              Are you sure you want to approve voucher{" "}
              <strong className="text-blue-600 dark:text-blue-400">{approveConfirmTarget.voucherNumber}</strong> for amount{" "}
              <strong>৳{(approveConfirmTarget.amount || approveConfirmTarget.totalDebit).toLocaleString()}</strong>?
            </p>
            <p className="text-ink-faint text-[11px]">
              Upon approval, the voucher will post directly to the General Ledger and move to Accounting Journal.
            </p>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
              <button
                type="button"
                onClick={() => setApproveConfirmTarget(null)}
                className="px-4 py-1.5 border border-line-strong rounded text-xs font-medium text-ink-muted hover:bg-canvas"
              >
                Cancel
              </button>
              <button disabled={pending === "approve"}
                type="button"
                onClick={confirmApproval}
                className="inline-flex items-center justify-center gap-1.5 disabled:opacity-60 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow-2xs"
              >{pending === "approve" && <Spinner className="size-3.5" />}
                Confirm Approval
              </button>
            </div>
          </div>
        )}
      </ModalDialog>
    </div>
  );
}
