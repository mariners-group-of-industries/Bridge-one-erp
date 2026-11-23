"use client";

import { toast } from "@/components/purchase/Toast";
import { usePending } from "@/hooks/use-pending";
import React, { useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Eye,
  Paperclip,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { ModalDialog } from "@/components/purchase/ModalDialog";
import { useAccountingStore } from "@/features/accounts/store/accounting-store";
import { BulkUploadDialog } from "@/features/configuration/entity-master-data/components/BulkUploadDialog";
import { uploadAccountImport } from "@/features/accounts/lib/bulk-import-client";
import { localToday } from "@/features/purchase/lib/client";
import { Spinner } from "@/components/ui/spinner";
import type { PaymentMethod } from "@/features/accounts/types";
import { useFeaturePermissions, needsPermission } from "@/lib/permissions/useFeaturePermissions";
import { NativeDateInput } from "@/components/ui/date-input";

export default function ExpenseAdvancePage() {
  const perms = useFeaturePermissions("/accounts/expenses");
  const { pending, run } = usePending();
  const syncDatabase = useAccountingStore((s) => s.syncDatabase);
  // Main Tabs: "EXPENSE" | "ADVANCE" | "PROVISION" | "PAID"
  const [activeTab, setActiveTab] = useState<"EXPENSE" | "ADVANCE" | "PROVISION" | "PAID">("EXPENSE");

  // Advance Sub-Tabs: "ADVANCE" | "INVOICE_ADVANCE_COLLECTION"
  const [advanceSubTab, setAdvanceSubTab] = useState<"ADVANCE" | "INVOICE_ADVANCE_COLLECTION">("ADVANCE");

  // Store data & actions
  const expenses = useAccountingStore((s) => s.expenses);
  const advances = useAccountingStore((s) => s.advances);
  const provisions = useAccountingStore((s) => s.provisions);
  const accounts = useAccountingStore((s) => s.accounts);
  const dbOffices = useAccountingStore((s) => s.offices);
  const createExpense = useAccountingStore((s) => s.createExpense);
  const markExpensePaid = useAccountingStore((s) => s.markExpensePaid);
  const createAdvance = useAccountingStore((s) => s.createAdvance);
  const createProvision = useAccountingStore((s) => s.createProvision);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedOffice, setSelectedOffice] = useState("ALL");
  // This month until today; the lists below are limited to it.
  const [fromDate, setFromDate] = useState(() => `${localToday().slice(0, 8)}01`);
  const [toDate, setToDate] = useState(() => localToday());
  const inPeriod = (date: string | undefined) => {
    const day = (date ?? "").slice(0, 10);
    return (!fromDate || day >= fromDate) && (!toDate || day <= toDate);
  };
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterExpenseType, setFilterExpenseType] = useState("ALL");
  const [filterAccountHead, setFilterAccountHead] = useState("ALL");

  // Selection Checkboxes
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>([]);
  const [selectedProvisionIds, setSelectedProvisionIds] = useState<string[]>([]);

  // Modals
  const [isCreateExpenseOpen, setIsCreateExpenseOpen] = useState(false);
  const [isExpenseHeaderCollapsed, setIsExpenseHeaderCollapsed] = useState(false);
  const [isCreateAdvanceOpen, setIsCreateAdvanceOpen] = useState(false);
  const [isAdvanceHeaderCollapsed, setIsAdvanceHeaderCollapsed] = useState(false);
  const [isCreateProvisionOpen, setIsCreateProvisionOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [viewingRecord, setViewingRecord] = useState<any | null>(null);

  // Forms

  const [advanceForm, setAdvanceForm] = useState({
    employeeName: "",
    partnerPayee: "",
    officeId: "",
    officeName: "",
    purpose: "",
    chartOfAccounts: "105 - Advance, Deposits & Pre-Payments",
    requestedAmount: 0,
    approvedAmount: 0,
    date: localToday(),
  });

  const [provisionForm, setProvisionForm] = useState({
    officeId: "",
    officeName: "",
    expenseType: "Factory Wages Provision",
    // The server books provisions to the provisions account (303).
    accountId: "",
    accountName: "Payables, Provision And Accruals",
    partnerPayee: "",
    amount: 0,
    effectivePeriod: "October 2026",
    description: "",
  });

  // Offices list from DB
  const officeList = useMemo(
    () => [
      { id: "ALL", name: "Office (All)" },
      ...dbOffices.map((o) => ({ id: o.name, name: o.name })),
    ],
    [dbOffices]
  );

  // Expense categories (iBOS Expense › Expense Category); the list filter calls the partner one "Partner".
  const _expenseTypes = ["ALL", "Employee", "Partner/Supplier", "Project"];
  const expenseTypeFilterOptions = [
    { value: "Employee", label: "Employee" },
    { value: "Project", label: "Project" },
    { value: "Partner/Supplier", label: "Partner" },
  ];

  // Expense heads from the chart of accounts.
  const expenseAccounts = useMemo(() => accounts.filter((a) => a.accountType === "EXPENSE" && !a.isGroup && a.status === "ACTIVE"), [accounts]);
  const accountsHeads = useMemo(
    () => [{ id: "ALL", name: "Accounts Head (All)" }, ...expenseAccounts.map((a) => ({ id: a.id, name: `${a.code} - ${a.name}` }))],
    [expenseAccounts],
  );
  /** The office picked on a form (by name), or the first office. */
  const officeByName = (name: string) => dbOffices.find((o) => o.name === name) ?? dbOffices[0];

  // 1. EXPENSES TAB DATA
  const displayedExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (!inPeriod(e.date)) return false;
      if (selectedOffice !== "ALL" && e.officeName !== selectedOffice) return false;
      if (filterExpenseType !== "ALL" && e.expenseType !== filterExpenseType) return false;
      if (filterAccountHead !== "ALL" && e.accountId !== filterAccountHead) return false;
      if (filterStatus !== "ALL" && e.status !== filterStatus) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const m =
          (e.code && e.code.toLowerCase().includes(q)) ||
          e.expenseNumber.toLowerCase().includes(q) ||
          e.officeName.toLowerCase().includes(q) ||
          (e.partnerPayee && e.partnerPayee.toLowerCase().includes(q)) ||
          e.payeeName.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q);
        if (!m) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- inPeriod reads fromDate/toDate
  }, [expenses, selectedOffice, filterExpenseType, filterAccountHead, filterStatus, search, fromDate, toDate]);

  // 2. ADVANCES TAB DATA
  const displayedAdvances = useMemo(() => {
    return advances.filter((a) => {
      if (!inPeriod(a.date)) return false;
      if (selectedOffice !== "ALL" && a.officeName !== selectedOffice) return false;
      if (filterStatus !== "ALL" && a.status !== filterStatus) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const m =
          (a.code && a.code.toLowerCase().includes(q)) ||
          a.advanceNumber.toLowerCase().includes(q) ||
          a.employeeName.toLowerCase().includes(q) ||
          (a.partnerPayee && a.partnerPayee.toLowerCase().includes(q)) ||
          a.purpose.toLowerCase().includes(q);
        if (!m) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- inPeriod reads fromDate/toDate
  }, [advances, selectedOffice, filterStatus, search, fromDate, toDate]);

  // 3. PROVISIONS TAB DATA
  const displayedProvisions = useMemo(() => {
    return provisions.filter((p) => {
      if (!inPeriod(p.date)) return false;
      if (selectedOffice !== "ALL" && p.officeName !== selectedOffice) return false;
      if (filterStatus !== "ALL" && p.status !== filterStatus) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const m =
          (p.code && p.code.toLowerCase().includes(q)) ||
          p.provisionNumber.toLowerCase().includes(q) ||
          p.officeName.toLowerCase().includes(q) ||
          (p.partnerPayee && p.partnerPayee.toLowerCase().includes(q)) ||
          p.description.toLowerCase().includes(q);
        if (!m) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- inPeriod reads fromDate/toDate
  }, [provisions, selectedOffice, filterStatus, search, fromDate, toDate]);

  // 4. PAID TAB DATA (Expenses with status === 'PAID')
  const displayedPaid = useMemo(() => {
    return expenses
      .filter((e) => e.status === "PAID")
      .filter((e) => {
        if (!inPeriod(e.date)) return false;
        if (selectedOffice !== "ALL" && e.officeName !== selectedOffice) return false;
        if (filterStatus !== "ALL" && e.status !== filterStatus) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          const m =
            (e.code && e.code.toLowerCase().includes(q)) ||
            (e.transactionNo && e.transactionNo.toLowerCase().includes(q)) ||
            e.officeName.toLowerCase().includes(q) ||
            e.description.toLowerCase().includes(q);
          if (!m) return false;
        }
        return true;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- inPeriod reads fromDate/toDate
  }, [expenses, selectedOffice, filterStatus, search, fromDate, toDate]);

  // Calculations for Footer Totals
  const totalExpenseAmount = useMemo(
    () => displayedExpenses.reduce((sum, e) => sum + (e.amount || 0), 0),
    [displayedExpenses],
  );
  const totalAdvanceAmount = useMemo(
    () => displayedAdvances.reduce((sum, a) => sum + (a.amount || a.approvedAmount || 0), 0),
    [displayedAdvances],
  );
  const totalProvisionAmount = useMemo(
    () => displayedProvisions.reduce((sum, p) => sum + (p.amount || 0), 0),
    [displayedProvisions],
  );
  const totalPaidAmount = useMemo(
    () => displayedPaid.reduce((sum, p) => sum + (p.amount || 0), 0),
    [displayedPaid],
  );

  // Checkbox handlers
  const handleToggleSelectExpense = (id: string) => {
    setSelectedExpenseIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleSelectAllExpenses = () => {
    if (selectedExpenseIds.length === displayedExpenses.length) {
      setSelectedExpenseIds([]);
    } else {
      setSelectedExpenseIds(displayedExpenses.map((e) => e.id));
    }
  };

  const handleToggleSelectProvision = (id: string) => {
    setSelectedProvisionIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleSelectAllProvisions = () => {
    if (selectedProvisionIds.length === displayedProvisions.length) {
      setSelectedProvisionIds([]);
    } else {
      setSelectedProvisionIds(displayedProvisions.map((p) => p.id));
    }
  };

  // ---------- Create Expense (iBOS layout) ----------
  const blankExpLine = (date: string) => ({ key: `l-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, date, accountId: "", subGl: "", remarks: "", amount: 0 });
  const blankExpHeader = () => ({
    category: "Employee",
    date: localToday(),
    officeId: "",
    employeeId: "",
    department: "",
    salesOrderId: "",
    supplierId: "",
    description: "",
    paymentMethod: "BANK" as PaymentMethod,
  });
  const [expHeader, setExpHeader] = useState(blankExpHeader);
  const [expLines, setExpLines] = useState(() => [blankExpLine(localToday())]);
  const [expError, setExpError] = useState("");
  const [expAttachment, setExpAttachment] = useState<{ id: string; name: string } | null>(null);
  const [expAttachmentBusy, setExpAttachmentBusy] = useState(false);
  const [expSuppliers, setExpSuppliers] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [expSalesOrders, setExpSalesOrders] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const employees = useAccountingStore((s) => s.employees);
  const departments = useMemo(() => [...new Set(employees.map((e) => e.department).filter((d): d is string => Boolean(d)))].sort(), [employees]);
  const expOffice = dbOffices.find((o) => o.id === expHeader.officeId) ?? dbOffices[0];
  const expTotal = expLines.reduce((t, l) => t + (Number(l.amount) || 0), 0);

  const openCreateExpense = () => {
    setExpHeader(blankExpHeader());
    setExpLines([blankExpLine(localToday())]);
    setExpAttachment(null);
    setExpError("");
    setIsCreateExpenseOpen(true);
    // Supplier and sales order choices, loaded once.
    const load = (type: string, set: (rows: Array<{ id: string; code: string; name: string }>) => void) =>
      void fetch(`/api/accounts/parties?type=${type}`)
        .then((r) => r.json())
        .then((json) => json?.success && set(json.data));
    if (expSuppliers.length === 0) load("SUPPLIER", setExpSuppliers);
    if (expSalesOrders.length === 0) load("SALES_ORDER", setExpSalesOrders);
  };

  const uploadExpAttachment = async (file: File | undefined) => {
    if (!file) return;
    setExpAttachmentBusy(true);
    setExpError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/accounts/expenses/attachments", { method: "POST", body });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message ?? "The file could not be attached.");
      setExpAttachment({ id: json.data.id, name: json.data.originalName });
    } catch (err) {
      setExpError(err instanceof Error ? err.message : "The file could not be attached.");
    } finally {
      setExpAttachmentBusy(false);
    }
  };

  const handleCreateExpenseSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setExpError("");
    const employee = employees.find((x) => x.id === expHeader.employeeId);
    const supplier = expSuppliers.find((x) => x.id === expHeader.supplierId);
    const salesOrder = expSalesOrders.find((x) => x.id === expHeader.salesOrderId);
    if (!expOffice) return setExpError("Select the office.");
    if (expHeader.category === "Employee" && !employee) return setExpError("Select the employee.");
    if (expHeader.category === "Partner/Supplier" && !supplier) return setExpError("Select the supplier/principle.");
    const bad = expLines.findIndex((l) => !l.accountId || !(Number(l.amount) > 0));
    if (bad >= 0) return setExpError(`Line ${bad + 1}: select the account (GL) and enter an amount.`);
    const first = expenseAccounts.find((a) => a.id === expLines[0].accountId);
    const ok = await run("expense", () => createExpense({
      officeId: expOffice.id,
      officeName: expOffice.name,
      expenseType: expHeader.category,
      accountId: first?.id ?? "",
      accountName: first?.name ?? "",
      payeeName: employee?.name ?? supplier?.name ?? "",
      amount: expTotal,
      date: expHeader.date,
      paymentMethod: expHeader.paymentMethod,
      description: expHeader.description,
      status: "APPROVED",
      employeeId: employee?.id ?? null,
      employeeName: employee?.name ?? null,
      department: expHeader.department || null,
      salesOrderId: salesOrder?.id ?? null,
      salesOrderNo: salesOrder?.code ?? null,
      supplierId: supplier?.id ?? null,
      supplierName: supplier?.name ?? null,
      attachmentId: expAttachment?.id ?? null,
      lines: expLines.map((l) => ({ date: l.date, accountId: l.accountId, subGl: l.subGl || null, remarks: l.remarks || null, amount: Number(l.amount) })),
    }));
    if (!ok) return;
    toast.success("Expense saved.");
    setIsCreateExpenseOpen(false);
  };

  const handleCreateAdvanceSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const office = officeByName(advanceForm.officeName);
    if (advanceForm.requestedAmount <= 0 || !advanceForm.employeeName || !office) return;
    const count = advances.length + 1;
    const code = `ADV-MG261000${(40 + count).toString()}`;
    const ok = await run("advance", () => createAdvance({
      ...advanceForm,
      officeId: office.id,
      officeName: office.name,
      date: localToday(),
      code,
      partnerPayee: advanceForm.partnerPayee || advanceForm.employeeName,
      amount: advanceForm.requestedAmount,
      approvedAmount: advanceForm.requestedAmount,
      status: "APPROVED",
    }));
    if (!ok) return;
    toast.success("Advance saved.");
    setIsCreateAdvanceOpen(false);
  };

  const handleCreateProvisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const office = officeByName(provisionForm.officeName);
    if (provisionForm.amount <= 0 || !provisionForm.partnerPayee || !office) return;
    const count = provisions.length + 1;
    const code = `PRV-MG261000${(10 + count).toString()}`;
    const ok = await run("provision", () => createProvision({
      ...provisionForm,
      officeId: office.id,
      officeName: office.name,
      code,
      chartOfAccount: "303 - Payables, Provision And Accruals",
      status: "POSTED",
    }));
    if (!ok) return;
    toast.success("Provision saved.");
    setIsCreateProvisionOpen(false);
  };

  // Convert selected to paid
  const handleMarkSelectedPaid = async () => {
    if (selectedExpenseIds.length === 0) {
      toast.error("Select at least one expense to pay.", { title: "Nothing selected" });
      return;
    }
    // Pay one by one and report what the server accepted.
    const results = await run("pay", async () => {
      const done: boolean[] = [];
      for (const id of selectedExpenseIds) done.push(await markExpensePaid(id, "BANK"));
      return done;
    });
    const paid = results.filter(Boolean).length;
    setSelectedExpenseIds(selectedExpenseIds.filter((_, i) => !results[i]));
    if (paid) toast.success(`${paid} expense${paid === 1 ? "" : "s"} marked as paid.`);
  };

  if (isCreateExpenseOpen) {
    return (
      <div className="space-y-3 font-sans pb-10">
        {/* TOP HEADER BAR */}
        <div className="bg-white border border-slate-200/90 rounded px-4 py-2.5 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsCreateExpenseOpen(false)}
              className="h-8 w-8 rounded border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-base font-bold text-slate-900 tracking-tight">Create Expense</h1>
          </div>
          <button
            type="button"
            disabled={expAttachmentBusy || pending === "expense"}
            onClick={() => handleCreateExpenseSubmit()}
            className="h-8 px-5 bg-[#2563eb] hover:bg-blue-700 disabled:opacity-60 text-white font-semibold text-xs rounded transition flex items-center gap-1.5 shadow-2xs"
          >
            {pending === "expense" && <Spinner className="size-3.5" />}
            Save
          </button>
        </div>

        {expError && (
          <p role="alert" className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700 text-xs">
            {expError}
          </p>
        )}

        {/* MAIN CARD */}
        <div className="bg-white border border-slate-200/90 rounded shadow-2xs overflow-hidden">
          {/* Card Tab Header */}
          <div className="border-b border-slate-200 bg-white px-3 pt-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-4 py-2 text-xs font-semibold rounded-t bg-[#e6f2fb] text-blue-700 border-b-2 border-blue-600 transition"
              >
                Expense
              </button>
              <button
                type="button"
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
              >
                Compensation and Incentive
              </button>
            </div>
            <button
              type="button"
              onClick={() => setIsExpenseHeaderCollapsed(!isExpenseHeaderCollapsed)}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              {isExpenseHeaderCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>

          {!isExpenseHeaderCollapsed && (
            <div className="p-3 border-b border-slate-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    <span className="text-red-500 font-bold mr-0.5">*</span> Expense Category
                  </label>
                  <select
                    value={expHeader.category}
                    onChange={(e) => setExpHeader({ ...expHeader, category: e.target.value })}
                    className="h-8 w-full border border-slate-300 rounded px-2.5 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="Employee">Employee</option>
                    <option value="Partner/Supplier">Partner/Supplier</option>
                    <option value="Project">Project</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Expense Date
                  </label>
                  <NativeDateInput
                    type="date"
                    value={expHeader.date}
                    onChange={(e) => setExpHeader({ ...expHeader, date: e.target.value })}
                    className="h-8 w-full border border-slate-300 rounded px-2.5 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    <span className="text-red-500 font-bold mr-0.5">*</span> Office
                  </label>
                  <select
                    value={expHeader.officeId}
                    onChange={(e) => setExpHeader({ ...expHeader, officeId: e.target.value })}
                    className="h-8 w-full border border-slate-300 rounded px-2.5 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Office</option>
                    {dbOffices.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    <span className="text-red-500 font-bold mr-0.5">*</span> Employee
                  </label>
                  <select
                    value={expHeader.employeeId}
                    onChange={(e) => {
                      const emp = employees.find((x) => x.id === e.target.value);
                      setExpHeader({ ...expHeader, employeeId: e.target.value, department: emp?.department || expHeader.department });
                    }}
                    className="h-8 w-full border border-slate-300 rounded px-2.5 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select/Search Employee</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.name} ({emp.employeeCode})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Department
                  </label>
                  <select
                    value={expHeader.department}
                    onChange={(e) => setExpHeader({ ...expHeader, department: e.target.value })}
                    className="h-8 w-full border border-slate-300 rounded px-2.5 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select Department</option>
                    {departments.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Sales Order No
                  </label>
                  <select
                    value={expHeader.salesOrderId}
                    onChange={(e) => setExpHeader({ ...expHeader, salesOrderId: e.target.value })}
                    className="h-8 w-full border border-slate-300 rounded px-2.5 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select Sales Order No</option>
                    {expSalesOrders.map((so) => (
                      <option key={so.id} value={so.id}>{so.code}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                <div className="lg:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    {expHeader.category === "Partner/Supplier" ? <span className="text-red-500 font-bold mr-0.5">*</span> : null} Supplier/Principle
                  </label>
                  <select
                    value={expHeader.supplierId}
                    onChange={(e) => setExpHeader({ ...expHeader, supplierId: e.target.value })}
                    className="h-8 w-full border border-slate-300 rounded px-2.5 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select/Search Supplier/Principle</option>
                    {expSuppliers.map((sp) => (
                      <option key={sp.id} value={sp.id}>{sp.code} - {sp.name}</option>
                    ))}
                  </select>
                </div>
                <div className="lg:col-span-3">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={expHeader.description}
                    onChange={(e) => setExpHeader({ ...expHeader, description: e.target.value })}
                    placeholder="Description"
                    className="h-8 w-full border border-slate-300 rounded px-2.5 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="lg:col-span-1">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Attachment
                  </label>
                  <div className="flex items-center gap-1.5">
                    <label className="h-8 px-2.5 border border-slate-300 rounded text-slate-600 hover:bg-slate-50 flex items-center gap-1 cursor-pointer text-xs">
                      <Paperclip className="w-3.5 h-3.5" />
                      <span className="truncate max-w-[80px]">{expAttachment ? expAttachment.name : "Attach"}</span>
                      <input
                        type="file"
                        className="hidden"
                        accept="application/pdf,image/png,image/jpeg,image/webp"
                        disabled={expAttachmentBusy}
                        onChange={(e) => {
                          void uploadExpAttachment(e.target.files?.[0]);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    {expAttachment && (
                      <button
                        type="button"
                        onClick={() => setExpAttachment(null)}
                        className="text-red-500 hover:text-red-700 text-sm font-bold"
                      >
                        ×
                      </button>
                    )}
                    {expAttachmentBusy && <Spinner className="size-3.5" />}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Lines Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#e6f2fb] border-b border-slate-200 text-slate-800 font-semibold text-[11px]">
                  <th className="py-2.5 px-3 w-12 text-center">SL</th>
                  <th className="py-2.5 px-3 w-32">Date</th>
                  <th className="py-2.5 px-3 min-w-[240px]">Accounts Name (GL)</th>
                  <th className="py-2.5 px-3 w-36">Sub GL</th>
                  <th className="py-2.5 px-3 min-w-[160px]">Remarks</th>
                  <th className="py-2.5 px-3 w-32 text-right">Amount</th>
                  <th className="py-2.5 px-3 w-16 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expLines.map((l, idx) => {
                  const set = (patch: Partial<typeof l>) => setExpLines(expLines.map((x) => (x.key === l.key ? { ...x, ...patch } : x)));
                  return (
                    <tr key={l.key} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 text-center">
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                          {idx === 0 ? "New" : idx + 1}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <NativeDateInput
                          type="date"
                          value={l.date}
                          onChange={(e) => set({ date: e.target.value })}
                          className="h-8 w-full border border-slate-300 rounded px-2 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <select
                          value={l.accountId}
                          onChange={(e) => set({ accountId: e.target.value })}
                          className="h-8 w-full border border-slate-300 rounded px-2 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">Accounts Name (GL)</option>
                          {expenseAccounts.map((a) => (
                            <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-3">
                        <input
                          value={l.subGl}
                          onChange={(e) => set({ subGl: e.target.value })}
                          placeholder="Sub GL"
                          className="h-8 w-full border border-slate-300 rounded px-2 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          value={l.remarks}
                          onChange={(e) => set({ remarks: e.target.value })}
                          placeholder="Remarks"
                          className="h-8 w-full border border-slate-300 rounded px-2 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={l.amount || ""}
                          onChange={(e) => set({ amount: parseFloat(e.target.value) || 0 })}
                          placeholder="Amount"
                          className="h-8 w-full border border-slate-300 rounded px-2 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-right font-mono"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setExpLines([...expLines.slice(0, idx + 1), blankExpLine(l.date), ...expLines.slice(idx + 1)])}
                            className="text-emerald-600 hover:text-emerald-800 text-base font-bold"
                            title="Add line"
                          >
                            +
                          </button>
                          {expLines.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setExpLines(expLines.filter((x) => x.key !== l.key))}
                              className="text-slate-400 hover:text-rose-600"
                              title="Delete line"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

          {/* Table Footer / Total bar */}
          <div className="bg-white border-t border-slate-200 px-6 py-2.5 flex items-center justify-end gap-3 text-xs">
            <span className="font-bold text-slate-700">Total:</span>
            <span className="font-bold font-mono text-slate-900 text-sm">
              {expTotal.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (isCreateAdvanceOpen) {
    return (
      <div className="space-y-3 font-sans pb-10">
        {/* TOP HEADER BAR */}
        <div className="bg-white border border-slate-200/90 rounded px-4 py-2.5 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsCreateAdvanceOpen(false)}
              className="h-8 w-8 rounded border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-base font-bold text-slate-900 tracking-tight">Create Advance</h1>
          </div>
          <button
            type="button"
            disabled={pending === "advance"}
            onClick={() => handleCreateAdvanceSubmit()}
            className="h-8 px-5 bg-[#2563eb] hover:bg-blue-700 disabled:opacity-60 text-white font-semibold text-xs rounded transition flex items-center gap-1.5 shadow-2xs"
          >
            {pending === "advance" && <Spinner className="size-3.5" />}
            Save
          </button>
        </div>

        {/* MAIN CARD */}
        <div className="bg-white border border-slate-200/90 rounded shadow-2xs overflow-hidden">
          {/* Card Tab Header */}
          <div className="border-b border-slate-200 bg-white px-3 pt-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-4 py-2 text-xs font-semibold rounded-t bg-[#e6f2fb] text-blue-700 border-b-2 border-blue-600 transition"
              >
                Advance
              </button>
            </div>
            <button
              type="button"
              onClick={() => setIsAdvanceHeaderCollapsed(!isAdvanceHeaderCollapsed)}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              {isAdvanceHeaderCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>

          {!isAdvanceHeaderCollapsed && (
            <div className="p-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    <span className="text-red-500 font-bold mr-0.5">*</span> Advance Date
                  </label>
                  <NativeDateInput
                    type="date"
                    value={advanceForm.date}
                    onChange={(e) => setAdvanceForm({ ...advanceForm, date: e.target.value })}
                    className="h-8 w-full border border-slate-300 rounded px-2.5 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    <span className="text-red-500 font-bold mr-0.5">*</span> Employee
                  </label>
                  <select
                    value={advanceForm.employeeName}
                    onChange={(e) => setAdvanceForm({ ...advanceForm, employeeName: e.target.value })}
                    className="h-8 w-full border border-slate-300 rounded px-2.5 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select Employee</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.name}>{emp.name} ({emp.employeeCode})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    <span className="text-red-500 font-bold mr-0.5">*</span> Office
                  </label>
                  <select
                    value={advanceForm.officeName}
                    onChange={(e) => setAdvanceForm({ ...advanceForm, officeName: e.target.value })}
                    className="h-8 w-full border border-slate-300 rounded px-2.5 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Office</option>
                    {officeList.filter((o) => o.id !== "ALL").map((o) => (
                      <option key={o.id} value={o.name}>{o.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Chart Of Accounts
                  </label>
                  <input
                    type="text"
                    value={advanceForm.chartOfAccounts}
                    readOnly
                    className="h-8 w-full border border-slate-200 bg-slate-50 rounded px-2.5 text-xs text-slate-600 focus:outline-none cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Remarks
                  </label>
                  <input
                    type="text"
                    placeholder="Remarks"
                    value={advanceForm.purpose}
                    onChange={(e) => setAdvanceForm({ ...advanceForm, purpose: e.target.value })}
                    className="h-8 w-full border border-slate-300 rounded px-2.5 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    <span className="text-red-500 font-bold mr-0.5">*</span> Amount
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    placeholder="Amount"
                    value={advanceForm.requestedAmount || ""}
                    onChange={(e) => setAdvanceForm({ ...advanceForm, requestedAmount: parseFloat(e.target.value) || 0 })}
                    className="h-8 w-full border border-slate-300 rounded px-2.5 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-right font-mono"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 font-sans flex flex-col md:h-[calc(100dvh-3.5rem)] md:overflow-hidden print:block print:h-auto print:overflow-visible">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP HEADER: TITLE + SEARCH + ACTION BUTTON */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-surface rounded border border-line/90 shadow-2xs p-3 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h1 className="text-base font-semibold text-ink">Expense/Advance</h1>

          <div className="flex items-center gap-2">
            {/* Search Box */}
            <div className="relative min-w-[200px]">
              <input
                type="text"
                placeholder="Search...."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pr-8 pl-2.5 py-1 text-xs border border-line-strong rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-surface"
              />
              <Search className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
            </div>

            {/* Contextual Action Button */}
            {activeTab === "EXPENSE" && (
              (perms.create ? (<button
                onClick={openCreateExpense}
                className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Expense</span>
              </button>) : null)
            )}

            {activeTab === "ADVANCE" && (
              (perms.create ? (<button
                onClick={() => setIsCreateAdvanceOpen(true)}
                className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Advance</span>
              </button>) : null)
            )}

            {activeTab === "PROVISION" && (
              (perms.create ? (<button
                onClick={() => setIsCreateProvisionOpen(true)}
                className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Advance</span>
              </button>) : null)
            )}

            {(activeTab === "EXPENSE" || activeTab === "PROVISION") && (
              (perms.import ? (<button
                onClick={() => setBulkOpen(true)}
                className="inline-flex items-center gap-1 px-3 py-1 border border-line-strong rounded text-xs font-medium text-ink-muted hover:bg-canvas transition-colors"
                title="Bulk upload expenses from an Excel file"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Bulk Upload</span>
              </button>) : null)
            )}
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* 2. MAIN TABS: EXPENSE | ADVANCE | PROVISION | PAID */}
        {/* ------------------------------------------------------------- */}
        <div className="flex items-center gap-6 border-b border-line mt-3 pt-1 text-xs font-medium">
          <button
            onClick={() => setActiveTab("EXPENSE")}
            className={`pb-2 tracking-wide uppercase transition-colors ${
              activeTab === "EXPENSE"
                ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 font-semibold"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            EXPENSE
          </button>
          <button
            onClick={() => setActiveTab("ADVANCE")}
            className={`pb-2 tracking-wide uppercase transition-colors ${
              activeTab === "ADVANCE"
                ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 font-semibold"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            ADVANCE
          </button>
          <button
            onClick={() => setActiveTab("PROVISION")}
            className={`pb-2 tracking-wide uppercase transition-colors ${
              activeTab === "PROVISION"
                ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 font-semibold"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            PROVISION
          </button>
          <button
            onClick={() => setActiveTab("PAID")}
            className={`pb-2 tracking-wide uppercase transition-colors ${
              activeTab === "PAID"
                ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 font-semibold"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            PAID
          </button>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* 3. FILTER TOOLBAR PER TAB (Exact Screenshot Layout) */}
        {/* ------------------------------------------------------------- */}
        <div className="mt-3">
          {/* TAB 1: EXPENSE FILTERS */}
          {activeTab === "EXPENSE" && (
            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-ink-faint mb-0.5">Office</label>
                  <select
                    value={selectedOffice}
                    onChange={(e) => setSelectedOffice(e.target.value)}
                    className="w-full text-xs border border-line-strong rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-surface text-ink-muted"
                  >
                    {officeList.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-ink-faint mb-0.5">From</label>
                  <NativeDateInput
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full text-xs border border-line-strong rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-surface text-ink-muted"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-ink-faint mb-0.5">To</label>
                  <NativeDateInput
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full text-xs border border-line-strong rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-surface text-ink-muted"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-ink-faint mb-0.5">Filter By</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full text-xs border border-line-strong rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-surface text-ink-muted"
                  >
                    <option value="ALL">All</option>
                    <option value="APPROVED">Approved</option>
                    <option value="PENDING">Pending</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-ink-faint mb-0.5">Expense Type</label>
                  <select
                    value={filterExpenseType}
                    onChange={(e) => setFilterExpenseType(e.target.value)}
                    className="w-full text-xs border border-line-strong rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-surface text-ink-muted truncate"
                  >
                    <option value="ALL">All</option>
                    {expenseTypeFilterOptions.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2 of Expense filter */}
              <div className="flex items-end gap-2.5 max-w-sm">
                <div className="flex-1">
                  <label className="block text-[11px] font-medium text-ink-faint mb-0.5">Accounts Head</label>
                  <select
                    value={filterAccountHead}
                    onChange={(e) => setFilterAccountHead(e.target.value)}
                    className="w-full text-xs border border-line-strong rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-surface text-ink-muted truncate"
                  >
                    {accountsHeads.map((ah) => (
                      <option key={ah.id} value={ah.id}>
                        {ah.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-1.5 disabled:opacity-60 px-5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-2xs transition-colors"
                
 onClick={() => void run("view", () => syncDatabase())}
 disabled={pending === "view"}
>
                  {pending === "view" && <Spinner className="size-3.5" />}View
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: ADVANCE FILTERS & SUB-TABS */}
          {activeTab === "ADVANCE" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 items-end">
                <div>
                  <label className="block text-[11px] font-medium text-ink-faint mb-0.5">Office</label>
                  <select
                    value={selectedOffice}
                    onChange={(e) => setSelectedOffice(e.target.value)}
                    className="w-full text-xs border border-line-strong rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-surface text-ink-muted"
                  >
                    {officeList.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-ink-faint mb-0.5">From</label>
                  <NativeDateInput
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full text-xs border border-line-strong rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-surface text-ink-muted"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-ink-faint mb-0.5">To</label>
                  <NativeDateInput
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full text-xs border border-line-strong rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-surface text-ink-muted"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-ink-faint mb-0.5">Filter By</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full text-xs border border-line-strong rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-surface text-ink-muted"
                  >
                    <option value="ALL">Status</option>
                    <option value="APPROVED">Approved</option>
                    <option value="PENDING">Pending</option>
                    <option value="SETTLED">Settled</option>
                  </select>
                </div>
                <div>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-1.5 disabled:opacity-60 px-5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-2xs transition-colors"
                  
 onClick={() => void run("view", () => syncDatabase())}
 disabled={pending === "view"}
>
                    {pending === "view" && <Spinner className="size-3.5" />}View
                  </button>
                </div>
              </div>

              {/* Sub Tabs: ADVANCE | INVOICE ADVANCE COLLECTION */}
              <div className="flex items-center gap-6 border-b border-line pt-1 text-xs">
                <button
                  onClick={() => setAdvanceSubTab("ADVANCE")}
                  className={`pb-1.5 uppercase font-medium transition-colors ${
                    advanceSubTab === "ADVANCE"
                      ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 font-semibold"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  ADVANCE
                </button>
                <button
                  onClick={() => setAdvanceSubTab("INVOICE_ADVANCE_COLLECTION")}
                  className={`pb-1.5 uppercase font-medium transition-colors ${
                    advanceSubTab === "INVOICE_ADVANCE_COLLECTION"
                      ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 font-semibold"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  INVOICE ADVANCE COLLECTION
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: PROVISION FILTERS */}
          {activeTab === "PROVISION" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 items-end">
              <div>
                <label className="block text-[11px] font-medium text-ink-faint mb-0.5">Office</label>
                <select
                  value={selectedOffice}
                  onChange={(e) => setSelectedOffice(e.target.value)}
                  className="w-full text-xs border border-line-strong rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-surface text-ink-muted"
                >
                  {officeList.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-ink-faint mb-0.5">From</label>
                <NativeDateInput
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full text-xs border border-line-strong rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-surface text-ink-muted"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-ink-faint mb-0.5">To</label>
                <NativeDateInput
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full text-xs border border-line-strong rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-surface text-ink-muted"
                />
              </div>
              <div>
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-1.5 disabled:opacity-60 px-5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-2xs transition-colors"
                
 onClick={() => void run("view", () => syncDatabase())}
 disabled={pending === "view"}
>
                  {pending === "view" && <Spinner className="size-3.5" />}View
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: PAID FILTERS */}
          {activeTab === "PAID" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 items-end">
              <div>
                <label className="block text-[11px] font-medium text-ink-faint mb-0.5">Office</label>
                <select
                  value={selectedOffice}
                  onChange={(e) => setSelectedOffice(e.target.value)}
                  className="w-full text-xs border border-line-strong rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-surface text-ink-muted"
                >
                  {officeList.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-ink-faint mb-0.5">From</label>
                <NativeDateInput
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full text-xs border border-line-strong rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-surface text-ink-muted"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-ink-faint mb-0.5">To</label>
                <NativeDateInput
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full text-xs border border-line-strong rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-surface text-ink-muted"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-ink-faint mb-0.5">Filter By</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full text-xs border border-line-strong rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 bg-surface text-ink-muted"
                >
                  <option value="ALL">Status</option>
                  <option value="PAID">Paid</option>
                </select>
              </div>
              <div>
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-1.5 disabled:opacity-60 px-5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-2xs transition-colors"
                
 onClick={() => void run("view", () => syncDatabase())}
 disabled={pending === "view"}
>
                  {pending === "view" && <Spinner className="size-3.5" />}View
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. TABLE ACTION BUTTONS (PROVISION & PAYMENT) */}
      {/* ------------------------------------------------------------- */}
      {(activeTab === "EXPENSE" || activeTab === "PROVISION") && (
        <div className="flex items-center justify-end gap-2 pr-1 shrink-0">
          {activeTab === "EXPENSE" && (
            (perms.create ? (<button
              onClick={() => setIsCreateProvisionOpen(true)}
              className="px-3 py-1 bg-surface hover:bg-canvas border border-line-strong text-ink-muted rounded text-xs font-medium shadow-2xs transition-colors"
            >
              Provision
            </button>) : null)
          )}
          <button title={!perms.edit ? needsPermission("edit") : undefined}
            type="button"
            onClick={handleMarkSelectedPaid}
            disabled={(pending === "pay") || !perms.edit}
            className="inline-flex items-center gap-1.5 disabled:opacity-60 px-3 py-1 bg-surface hover:bg-canvas border border-line-strong text-ink-muted rounded text-xs font-medium shadow-2xs transition-colors"
          >
            {pending === "pay" && <Spinner className="size-3.5" />}
            Payment
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. DATA TABLES (Matches Screenshots 1, 2, 3, 4) */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-surface rounded border border-line/90 shadow-2xs overflow-hidden flex-1 min-h-0 flex flex-col print:block">
        <div className="flex-1 min-h-0 overflow-auto print:overflow-visible [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
          {/* TAB 1: EXPENSE TABLE */}
          {activeTab === "EXPENSE" && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-canvas text-ink-muted font-semibold border-b border-line uppercase text-[11px] tracking-wider">
                  <th className="py-2 px-3 w-8 text-center">
                    <input
                      type="checkbox"
                      checked={
                        displayedExpenses.length > 0 &&
                        selectedExpenseIds.length === displayedExpenses.length
                      }
                      onChange={handleSelectAllExpenses}
                      className="rounded border-line-strong text-blue-600 dark:text-blue-400 focus:ring-0"
                    />
                  </th>
                  <th className="py-2 px-3 w-10 text-center">SL</th>
                  <th className="py-2 px-3 w-24">Date</th>
                  <th className="py-2 px-3 w-32">Code</th>
                  <th className="py-2 px-3 w-36">Office Name</th>
                  <th className="py-2 px-3 w-36">Expense Type</th>
                  <th className="py-2 px-3 w-44">Partner/Payee</th>
                  <th className="py-2 px-3 w-48">Chart Of Account</th>
                  <th className="py-2 px-3">Description</th>
                  <th className="py-2 px-3 text-right w-24">Amount</th>
                  <th className="py-2 px-3 text-center w-24">Status</th>
                  <th className="py-2 px-3 text-center w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-ink-muted">
                {displayedExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-8 text-center text-ink-faint">
                      No expense records found.
                    </td>
                  </tr>
                ) : (
                  displayedExpenses.map((e, index) => (
                    <tr key={e.id} className="hover:bg-blue-50/40 dark:hover:bg-blue-500/10 transition-colors">
                      <td className="py-2 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedExpenseIds.includes(e.id)}
                          onChange={() => handleToggleSelectExpense(e.id)}
                          className="rounded border-line-strong text-blue-600 dark:text-blue-400 focus:ring-0"
                        />
                      </td>
                      <td className="py-2 px-3 text-center text-ink-faint">{index + 1}</td>
                      <td className="py-2 px-3 whitespace-nowrap text-ink-muted">{e.date}</td>
                      <td className="py-2 px-3 font-mono text-blue-600 dark:text-blue-400 font-medium whitespace-nowrap">
                        {e.code || e.expenseNumber}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap font-medium text-ink">{e.officeName}</td>
                      <td className="py-2 px-3 whitespace-nowrap text-ink-muted">{e.expenseType}</td>
                      <td className="py-2 px-3 whitespace-nowrap font-medium text-ink">{e.partnerPayee || e.payeeName}</td>
                      <td className="py-2 px-3 whitespace-nowrap text-ink-muted truncate max-w-[180px]" title={e.chartOfAccount || e.accountName}>
                        {e.chartOfAccount || e.accountName}
                      </td>
                      <td className="py-2 px-3 text-ink-muted truncate max-w-[200px]" title={e.description}>
                        {e.description}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-medium text-ink whitespace-nowrap">
                        {e.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        {e.status === "APPROVED" ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                            Approved
                          </span>
                        ) : e.status === "PENDING" ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                            Pending
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30">
                            Paid
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <div className="row-actions flex items-center justify-center gap-1">
                          <button
                            onClick={() => setViewingRecord(e)}
                            title="View Details"
                            className="w-6 h-6 rounded-full bg-control hover:bg-blue-100 dark:hover:bg-blue-500/15 text-ink-muted hover:text-blue-700 dark:hover:text-blue-300 flex items-center justify-center transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="bg-canvas font-semibold border-t border-line text-ink">
                  <td colSpan={8} className="py-2 px-3"></td>
                  <td className="py-2 px-3 text-right">Total</td>
                  <td className="py-2 px-3 text-right font-mono text-ink">
                    {totalExpenseAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td colSpan={2} className="py-2 px-3"></td>
                </tr>
              </tfoot>
            </table>
          )}

          {/* TAB 2: ADVANCE TABLE */}
          {activeTab === "ADVANCE" && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-canvas text-ink-muted font-semibold border-b border-line uppercase text-[11px] tracking-wider">
                  <th className="py-2 px-3 w-10 text-center">SL</th>
                  <th className="py-2 px-3 w-24">Date</th>
                  <th className="py-2 px-3 w-32">Code</th>
                  <th className="py-2 px-3 w-36">Office Name</th>
                  <th className="py-2 px-3 w-44">Partner/Payee</th>
                  <th className="py-2 px-3 w-52">Chart Of Accounts</th>
                  <th className="py-2 px-3">Description</th>
                  <th className="py-2 px-3 text-right w-24">Amount</th>
                  <th className="py-2 px-3 text-center w-24">Status</th>
                  <th className="py-2 px-3 text-center w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-ink-muted">
                {displayedAdvances.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-ink-faint">
                      No advance records found.
                    </td>
                  </tr>
                ) : (
                  displayedAdvances.map((a, index) => (
                    <tr key={a.id} className="hover:bg-blue-50/40 dark:hover:bg-blue-500/10 transition-colors">
                      <td className="py-2 px-3 text-center text-ink-faint">{index + 1}</td>
                      <td className="py-2 px-3 whitespace-nowrap text-ink-muted">{a.date}</td>
                      <td className="py-2 px-3 font-mono text-blue-600 dark:text-blue-400 font-medium whitespace-nowrap">
                        {a.code || a.advanceNumber}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap font-medium text-ink">{a.officeName}</td>
                      <td className="py-2 px-3 whitespace-nowrap font-medium text-ink">{a.partnerPayee || a.employeeName}</td>
                      <td className="py-2 px-3 whitespace-nowrap text-ink-muted truncate max-w-[200px]" title={a.chartOfAccounts}>
                        {a.chartOfAccounts || "105 - Advance, Deposits & Pre-Payments"}
                      </td>
                      <td className="py-2 px-3 text-ink-muted truncate max-w-[220px]" title={a.purpose}>
                        {a.purpose}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-medium text-ink whitespace-nowrap">
                        {(a.amount || a.approvedAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        {a.status === "APPROVED" ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                            Approved
                          </span>
                        ) : a.status === "PENDING" ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                            Pending
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-control text-ink-muted border border-line">
                            Settled
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <div className="row-actions flex items-center justify-center gap-1">
                          <button
                            onClick={() => setViewingRecord(a)}
                            title="View Details"
                            className="w-6 h-6 rounded-full bg-control hover:bg-blue-100 dark:hover:bg-blue-500/15 text-ink-muted hover:text-blue-700 dark:hover:text-blue-300 flex items-center justify-center transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="bg-canvas font-semibold border-t border-line text-ink">
                  <td colSpan={6} className="py-2 px-3"></td>
                  <td className="py-2 px-3 text-right">Total</td>
                  <td className="py-2 px-3 text-right font-mono text-ink">
                    {totalAdvanceAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td colSpan={2} className="py-2 px-3"></td>
                </tr>
              </tfoot>
            </table>
          )}

          {/* TAB 3: PROVISION TABLE */}
          {activeTab === "PROVISION" && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-canvas text-ink-muted font-semibold border-b border-line uppercase text-[11px] tracking-wider">
                  <th className="py-2 px-3 w-8 text-center">
                    <input
                      type="checkbox"
                      checked={
                        displayedProvisions.length > 0 &&
                        selectedProvisionIds.length === displayedProvisions.length
                      }
                      onChange={handleSelectAllProvisions}
                      className="rounded border-line-strong text-blue-600 dark:text-blue-400 focus:ring-0"
                    />
                  </th>
                  <th className="py-2 px-3 w-10 text-center">SL</th>
                  <th className="py-2 px-3 w-24">Date</th>
                  <th className="py-2 px-3 w-32">Code</th>
                  <th className="py-2 px-3 w-36">Office Name</th>
                  <th className="py-2 px-3 w-36">Expense Type</th>
                  <th className="py-2 px-3 w-44">Partner/Payee</th>
                  <th className="py-2 px-3 w-48">Chart Of Account</th>
                  <th className="py-2 px-3">Description</th>
                  <th className="py-2 px-3 text-right w-24">Amount</th>
                  <th className="py-2 px-3 text-center w-24">Status</th>
                  <th className="py-2 px-3 text-center w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-ink-muted">
                {displayedProvisions.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-8 text-center text-ink-faint">
                      No provision records found.
                    </td>
                  </tr>
                ) : (
                  displayedProvisions.map((p, index) => (
                    <tr key={p.id} className="hover:bg-blue-50/40 dark:hover:bg-blue-500/10 transition-colors">
                      <td className="py-2 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedProvisionIds.includes(p.id)}
                          onChange={() => handleToggleSelectProvision(p.id)}
                          className="rounded border-line-strong text-blue-600 dark:text-blue-400 focus:ring-0"
                        />
                      </td>
                      <td className="py-2 px-3 text-center text-ink-faint">{index + 1}</td>
                      <td className="py-2 px-3 whitespace-nowrap text-ink-muted">{p.date || "12/10/2026"}</td>
                      <td className="py-2 px-3 font-mono text-blue-600 dark:text-blue-400 font-medium whitespace-nowrap">
                        {p.code || p.provisionNumber}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap font-medium text-ink">{p.officeName}</td>
                      <td className="py-2 px-3 whitespace-nowrap text-ink-muted">{p.expenseType || "Provision"}</td>
                      <td className="py-2 px-3 whitespace-nowrap font-medium text-ink">{p.partnerPayee || "General Provision"}</td>
                      <td className="py-2 px-3 whitespace-nowrap text-ink-muted truncate max-w-[180px]" title={p.chartOfAccount || p.accountName}>
                        {p.chartOfAccount || p.accountName}
                      </td>
                      <td className="py-2 px-3 text-ink-muted truncate max-w-[200px]" title={p.description}>
                        {p.description}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-medium text-ink whitespace-nowrap">
                        {p.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        {p.status === "POSTED" ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                            Posted
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <div className="row-actions flex items-center justify-center gap-1">
                          <button
                            onClick={() => setViewingRecord(p)}
                            title="View Details"
                            className="w-6 h-6 rounded-full bg-control hover:bg-blue-100 dark:hover:bg-blue-500/15 text-ink-muted hover:text-blue-700 dark:hover:text-blue-300 flex items-center justify-center transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="bg-canvas font-semibold border-t border-line text-ink">
                  <td colSpan={8} className="py-2 px-3"></td>
                  <td className="py-2 px-3 text-right">Total</td>
                  <td className="py-2 px-3 text-right font-mono text-ink">
                    {totalProvisionAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td colSpan={2} className="py-2 px-3"></td>
                </tr>
              </tfoot>
            </table>
          )}

          {/* TAB 4: PAID TABLE */}
          {activeTab === "PAID" && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-canvas text-ink-muted font-semibold border-b border-line uppercase text-[11px] tracking-wider">
                  <th className="py-2 px-3 w-10 text-center">SL</th>
                  <th className="py-2 px-3 w-28">Registration Date</th>
                  <th className="py-2 px-3 w-28">Transaction Date</th>
                  <th className="py-2 px-3 w-32">Transaction No</th>
                  <th className="py-2 px-3 w-32">Registration Code</th>
                  <th className="py-2 px-3 w-36">Office Name</th>
                  <th className="py-2 px-3 w-44">Partner/Payee</th>
                  <th className="py-2 px-3">Description</th>
                  <th className="py-2 px-3 text-right w-24">Amount</th>
                  <th className="py-2 px-3 text-center w-24">Status</th>
                  <th className="py-2 px-3 text-center w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-ink-muted">
                {displayedPaid.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-ink-faint">
                      No paid transaction records found.
                    </td>
                  </tr>
                ) : (
                  displayedPaid.map((p, index) => (
                    <tr key={p.id} className="hover:bg-blue-50/40 dark:hover:bg-blue-500/10 transition-colors">
                      <td className="py-2 px-3 text-center text-ink-faint">{index + 1}</td>
                      <td className="py-2 px-3 whitespace-nowrap text-ink-muted">{p.registrationDate || p.date}</td>
                      <td className="py-2 px-3 whitespace-nowrap text-ink-muted">{p.transactionDate || p.date}</td>
                      <td className="py-2 px-3 font-mono text-blue-600 dark:text-blue-400 font-medium whitespace-nowrap">
                        {p.transactionNo || "TXN-EXP-0000"}
                      </td>
                      <td className="py-2 px-3 font-mono text-ink-muted whitespace-nowrap">
                        {p.registrationCode || p.code || p.expenseNumber}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap font-medium text-ink">{p.officeName}</td>
                      <td className="py-2 px-3 whitespace-nowrap font-medium text-ink">{p.partnerPayee || p.payeeName}</td>
                      <td className="py-2 px-3 text-ink-muted truncate max-w-[240px]" title={p.description}>
                        {p.description}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-medium text-ink whitespace-nowrap">
                        {p.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                          Paid
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <div className="row-actions flex items-center justify-center gap-1">
                          <button
                            onClick={() => setViewingRecord(p)}
                            title="View Details"
                            className="w-6 h-6 rounded-full bg-control hover:bg-blue-100 dark:hover:bg-blue-500/15 text-ink-muted hover:text-blue-700 dark:hover:text-blue-300 flex items-center justify-center transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="bg-canvas font-semibold border-t border-line text-ink">
                  <td colSpan={7} className="py-2 px-3"></td>
                  <td className="py-2 px-3 text-right">Total</td>
                  <td className="py-2 px-3 text-right font-mono text-ink">
                    {totalPaidAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td colSpan={2} className="py-2 px-3"></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>



      {/* ------------------------------------------------------------- */}
      {/* 8. MODAL: CREATE PROVISION */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={isCreateProvisionOpen}
        onClose={() => setIsCreateProvisionOpen(false)}
        title="Create Provision Record"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateProvisionSubmit} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-ink-muted mb-1">Office / Branch *</label>
              <select
                value={provisionForm.officeName}
                onChange={(e) => setProvisionForm({ ...provisionForm, officeName: e.target.value })}
                className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface focus:ring-1 focus:ring-blue-500"
              >
                {officeList.filter((o) => o.id !== "ALL").map((o) => (
                  <option key={o.id} value={o.name}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-ink-muted mb-1">Expense Type *</label>
              <select
                value={provisionForm.expenseType}
                onChange={(e) => setProvisionForm({ ...provisionForm, expenseType: e.target.value })}
                className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface focus:ring-1 focus:ring-blue-500"
              >
                <option value="Factory Wages Provision">Factory Wages Provision</option>
                <option value="Office Lease Provision">Office Lease Provision</option>
                <option value="Machinery Overhaul Provision">Machinery Overhaul Provision</option>
                <option value="Audit & Tax Provision">Audit & Tax Provision</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-ink-muted mb-1">Partner / Payee *</label>
              <input
                type="text"
                required
                placeholder="e.g. Daily Contract Laborers"
                value={provisionForm.partnerPayee}
                onChange={(e) => setProvisionForm({ ...provisionForm, partnerPayee: e.target.value })}
                className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block font-medium text-ink-muted mb-1">Provision Amount (৳) *</label>
              <input
                type="number"
                required
                min="1"
                step="0.01"
                placeholder="0.00"
                value={provisionForm.amount || ""}
                onChange={(e) => setProvisionForm({ ...provisionForm, amount: parseFloat(e.target.value) || 0 })}
                className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface font-mono focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block font-medium text-ink-muted mb-1">Description *</label>
            <textarea
              required
              rows={2}
              placeholder="State details of the accrued liability provision..."
              value={provisionForm.description}
              onChange={(e) => setProvisionForm({ ...provisionForm, description: e.target.value })}
              className="w-full border border-line-strong rounded px-2.5 py-1.5 bg-surface focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
            <button
              type="button"
              onClick={() => setIsCreateProvisionOpen(false)}
              className="px-4 py-1.5 border border-line-strong rounded text-xs font-medium text-ink-muted hover:bg-canvas"
            >
              Cancel
            </button>
            <button disabled={pending === "provision"}
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 disabled:opacity-60 px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-2xs transition-colors"
            >{pending === "provision" && <Spinner className="size-3.5" />}
              Save Provision
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* ------------------------------------------------------------- */}
      {/* 9. MODAL: VIEW DETAILS */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={Boolean(viewingRecord)}
        onClose={() => setViewingRecord(null)}
        title={viewingRecord ? `Details: ${viewingRecord.code || viewingRecord.expenseNumber || viewingRecord.advanceNumber || viewingRecord.provisionNumber}` : ""}
        maxWidth="md"
      >
        {viewingRecord && (
          <div className="space-y-3 text-xs">
            <div className="p-3 bg-canvas rounded border border-line space-y-1.5">
              <div className="flex justify-between">
                <span className="text-ink-faint">Office:</span>
                <span className="font-semibold text-ink">{viewingRecord.officeName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-faint">Date:</span>
                <span className="font-medium text-ink">{viewingRecord.date || viewingRecord.registrationDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-faint">Partner / Payee:</span>
                <span className="font-medium text-ink">{viewingRecord.partnerPayee || viewingRecord.payeeName || viewingRecord.employeeName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-faint">Account:</span>
                <span className="text-ink">{viewingRecord.chartOfAccount || viewingRecord.chartOfAccounts || viewingRecord.accountName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-faint">Status:</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">{viewingRecord.status}</span>
              </div>
              <div className="flex justify-between border-t border-line pt-1.5">
                <span className="font-semibold text-ink-muted">Amount:</span>
                <span className="font-mono font-bold text-ink text-sm">
                  ৳{(viewingRecord.amount || viewingRecord.approvedAmount || 0).toLocaleString()}
                </span>
              </div>
            </div>
            <div>
              <span className="font-semibold text-ink-muted block mb-0.5">Description:</span>
              <p className="p-2 bg-surface rounded border border-line text-ink-muted">
                {viewingRecord.description || viewingRecord.purpose}
              </p>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setViewingRecord(null)}
                className="px-4 py-1.5 border border-line-strong rounded text-xs font-medium text-ink-muted hover:bg-canvas"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </ModalDialog>
      <BulkUploadDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onImported={() => { void useAccountingStore.getState().syncDatabase(); }}
        noun="expenses"
        templateUrl="/api/accounts/expenses/import"
        maxRows={2000}
        matchHint="Office must match an office in your access; Account Code is the GL code; the expense total is the sum of its lines. Rows with the same Ref are saved as one record; Record Kind is EXPENSE or PROVISION."
        upload={(file) => uploadAccountImport("/api/accounts/expenses/import", file)}
      />
    </div>
  );
}
