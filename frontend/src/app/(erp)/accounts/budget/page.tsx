"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Minus,
  Pencil,
  Plus,
  PlusCircle,
  Printer,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { ModalDialog } from "@/components/purchase/ModalDialog";
import { useAccountingStore } from "@/features/accounts/store/accounting-store";
import type { BudgetItem, BudgetLineItem } from "@/features/accounts/types";

// Helper for formatting currency amounts with 2 decimals
function formatAmount(amount: number | undefined | null): string {
  if (amount === undefined || amount === null) return "0.00";
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Convert amount to words for official view
function numberToWords(num: number): string {
  const a = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function inWords(n: number): string {
    if (n < 20) return a[n];
    const digit = n % 10;
    return b[Math.floor(n / 10)] + (digit ? " " + a[digit] : "");
  }

  const integerPart = Math.floor(num);
  if (integerPart === 0) return "Zero Taka Only";

  const crore = Math.floor(integerPart / 10000000);
  const lakh = Math.floor((integerPart % 10000000) / 100000);
  const thousand = Math.floor((integerPart % 100000) / 1000);
  const hundred = Math.floor((integerPart % 1000) / 100);
  const rest = integerPart % 100;

  let str = "";
  if (crore > 0) str += inWords(crore) + " Crore ";
  if (lakh > 0) str += inWords(lakh) + " Lakh ";
  if (thousand > 0) str += inWords(thousand) + " Thousand ";
  if (hundred > 0) str += inWords(hundred) + " Hundred ";
  if (rest > 0) str += (str !== "" ? "and " : "") + inWords(rest) + " ";

  return str.trim() + " Taka Only";
}

export default function BudgetManagementPage() {
  const budgets = useAccountingStore((s) => s.budgets);
  const accounts = useAccountingStore((s) => s.accounts);
  const costCenters = useAccountingStore((s) => s.costCenters);
  const createBudget = useAccountingStore((s) => s.createBudget);
  const updateBudget = useAccountingStore((s) => s.updateBudget);
  const updateBudgetRevision = useAccountingStore((s) => s.updateBudgetRevision);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  // Accordion Expand State
  const [expandedRowIds, setExpandedRowIds] = useState<Record<string, boolean>>({});

  const toggleRowExpand = (id: string) => {
    setExpandedRowIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<BudgetItem | null>(null);
  const [viewTarget, setViewTarget] = useState<BudgetItem | null>(null);
  const [revisionTarget, setRevisionTarget] = useState<BudgetItem | null>(null);
  const [newRevisionAmount, setNewRevisionAmount] = useState<number>(0);
  const [revisionReason, setRevisionReason] = useState("");

  // Create Form State
  const defaultCreateForm = {
    budgetName: "October-2026",
    budgetYear: "Sep 21, 2026 - Oct 20, 2026",
    createDate: "19-09-2026",
    budgetType: "OverHeads/Expense Budget",
    officeId: "office-mbbl",
    officeName: "MBBL-HO",
    costCenterId: "cc-1",
    costCenterName: "Dhaka Head Office",
    accountId: "acc-5100",
    accountName: "Overheads & Operational Expenses",
    totalBudgetAmount: 6126907,
    items: [
      {
        id: "item-1",
        accountCode: "5100",
        accountName: "Rent, Rates & Taxes (Corporate HQ)",
        costCenterName: "Dhaka Head Office",
        allocatedAmount: 1850000,
        remarks: "HQ lease & local municipality rates",
      },
      {
        id: "item-2",
        accountCode: "5200",
        accountName: "Electricity, Fuel & Plant Utilities",
        costCenterName: "MG Factory Floor",
        allocatedAmount: 2400000,
        remarks: "Generator diesel and DESCO substation",
      },
      {
        id: "item-3",
        accountCode: "5300",
        accountName: "Salaries, Overtime & Allowances",
        costCenterName: "Administration",
        allocatedAmount: 1200000,
        remarks: "Support staff & security allowances",
      },
      {
        id: "item-4",
        accountCode: "5400",
        accountName: "Office Supplies, IT & Maintenance",
        costCenterName: "Corporate HQ",
        allocatedAmount: 676907,
        remarks: "IT software licenses, stationery & supplies",
      },
    ] as BudgetLineItem[],
  };

  const [createForm, setCreateForm] = useState(defaultCreateForm);

  // Edit Form State
  const [editForm, setEditForm] = useState<Partial<BudgetItem>>({});

  // Line item adder in create form
  const [newItemAccount, setNewItemAccount] = useState("");
  const [newItemCostCenter, setNewItemCostCenter] = useState("");
  const [newItemAmount, setNewItemAmount] = useState<number>(0);
  const [newItemRemarks, setNewItemRemarks] = useState("");

  const handleAddLineItemToCreate = () => {
    if (!newItemAccount || newItemAmount <= 0) return;
    const acc = accounts.find((a) => a.id === newItemAccount);
    const cc = costCenters.find((c) => c.id === newItemCostCenter);
    const lineItem: BudgetLineItem = {
      id: `item-${Date.now()}`,
      accountCode: acc?.code || "5000",
      accountName: acc?.name || "General Operating",
      costCenterName: cc?.name || createForm.costCenterName,
      allocatedAmount: newItemAmount,
      remainingAmount: newItemAmount,
      utilizedAmount: 0,
      remarks: newItemRemarks,
    };
    const updatedItems = [...createForm.items, lineItem];
    const total = updatedItems.reduce((sum, it) => sum + it.allocatedAmount, 0);
    setCreateForm({
      ...createForm,
      items: updatedItems,
      totalBudgetAmount: total,
    });
    setNewItemAccount("");
    setNewItemCostCenter("");
    setNewItemAmount(0);
    setNewItemRemarks("");
  };

  const handleRemoveLineItem = (itemId: string) => {
    const updated = createForm.items.filter((it) => it.id !== itemId);
    const total = updated.reduce((sum, it) => sum + it.allocatedAmount, 0);
    setCreateForm({
      ...createForm,
      items: updated,
      totalBudgetAmount: total,
    });
  };

  // Filtered List
  const filteredBudgets = useMemo(() => {
    return budgets.filter((b) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        b.budgetCode.toLowerCase().includes(q) ||
        b.budgetName.toLowerCase().includes(q) ||
        (b.budgetYear && b.budgetYear.toLowerCase().includes(q)) ||
        (b.budgetType && b.budgetType.toLowerCase().includes(q)) ||
        (b.status && b.status.toLowerCase().includes(q));

      const matchType = !filterType || filterType === "ALL" || b.budgetType === filterType;

      return matchSearch && matchType;
    });
  }, [budgets, searchQuery, filterType]);

  // Paginated List
  const paginatedBudgets = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredBudgets.slice(start, start + rowsPerPage);
  }, [filteredBudgets, currentPage, rowsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filteredBudgets.length / rowsPerPage));

  // Handle Save Create
  const handleSaveBudget = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.budgetName.trim()) return;

    createBudget({
      budgetName: createForm.budgetName,
      budgetYear: createForm.budgetYear,
      createDate: createForm.createDate,
      budgetType: createForm.budgetType,
      officeId: createForm.officeId,
      officeName: createForm.officeName,
      costCenterId: createForm.costCenterId,
      costCenterName: createForm.costCenterName,
      accountId: createForm.accountId,
      accountName: createForm.accountName,
      allocatedAmount: createForm.totalBudgetAmount,
      totalBudgetAmount: createForm.totalBudgetAmount,
      approvalStatus: "Approved",
      status: "Approved",
      items: createForm.items,
    });

    setIsCreateOpen(false);
  };

  // Handle Save Edit
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;

    updateBudget(editTarget.id, editForm);
    setEditTarget(null);
  };

  // Handle Save Revision
  const handleSaveRevision = () => {
    if (!revisionTarget || newRevisionAmount <= 0) return;
    updateBudgetRevision(revisionTarget.id, newRevisionAmount);
    setRevisionTarget(null);
    setRevisionReason("");
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans pb-16">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP TAB BAR & ACTION BUTTONS */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-4 py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Active Tab */}
          <div className="flex items-center">
            <div className="relative pb-2 pt-1 px-4 text-[13px] font-semibold text-[#2563eb] cursor-pointer">
              Budget
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#2563eb]" />
            </div>
          </div>

          {/* Search Bar & + Budget Create Button */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-60">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search..."
                className="w-full h-8 pl-8 pr-3 text-xs border border-slate-300 rounded bg-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#2563eb] focus:border-[#2563eb] shadow-2xs"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setCreateForm(defaultCreateForm);
                setIsCreateOpen(true);
              }}
              className="h-8 px-3.5 bg-[#2563eb] hover:bg-blue-700 text-white font-medium text-xs rounded flex items-center gap-1.5 shadow-2xs transition whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Budget Create</span>
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. FILTER BY TYPE SECTION */}
      {/* ------------------------------------------------------------- */}
      <div className="px-4 pt-3 pb-2.5">
        <div className="space-y-1">
          <label className="block text-[11px] font-semibold text-slate-700">Filter By Type</label>
          <div className="relative w-72">
            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-8 px-2.5 pr-8 border border-slate-300 rounded text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#2563eb] focus:border-[#2563eb] appearance-none shadow-2xs"
            >
              <option value="">Filter By Type</option>
              <option value="OverHeads/Expense Budget">OverHeads/Expense Budget</option>
              <option value="Capex Budget">Capex Budget</option>
              <option value="OPERATING">Operating Budget</option>
              <option value="CAPITAL">Capital Budget</option>
              <option value="DEPARTMENT">Departmental Budget</option>
              <option value="PROJECT">Project Budget</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. MAIN DATA TABLE */}
      {/* ------------------------------------------------------------- */}
      <div className="px-4">
        <div className="bg-white border border-slate-200 rounded shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              {/* Table Head */}
              <thead>
                <tr className="bg-[#f8fafc] border-b border-slate-200 text-[11px] font-semibold text-slate-700">
                  <th className="w-10 px-2 py-2 text-center border-r border-slate-200"></th>
                  <th className="w-12 px-2.5 py-2 text-center border-r border-slate-200">SL</th>
                  <th className="w-28 px-3 py-2 text-center border-r border-slate-200">Action</th>
                  <th className="px-3.5 py-2 border-r border-slate-200">Budget Code</th>
                  <th className="px-3 py-2 border-r border-slate-200">Create Date</th>
                  <th className="px-3.5 py-2 border-r border-slate-200">Budget Year</th>
                  <th className="px-3.5 py-2 border-r border-slate-200">Budget Name</th>
                  <th className="px-3.5 py-2 border-r border-slate-200">Budget Type</th>
                  <th className="px-3.5 py-2 text-right border-r border-slate-200">Total Budget Amount</th>
                  <th className="px-3.5 py-2 text-center">Status</th>
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-slate-100">
                {paginatedBudgets.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400 text-xs">
                      No budget records found.
                    </td>
                  </tr>
                ) : (
                  paginatedBudgets.map((b, idx) => {
                    const isExpanded = !!expandedRowIds[b.id];
                    const sl = (currentPage - 1) * rowsPerPage + idx + 1;
                    const totalAmt = b.totalBudgetAmount ?? b.allocatedAmount;

                    return (
                      <React.Fragment key={b.id}>
                        <tr className="hover:bg-slate-50/80 transition-colors">
                          {/* 1. Expand Button */}
                          <td className="px-2 py-2 text-center border-r border-slate-200/80">
                            <button
                              type="button"
                              onClick={() => toggleRowExpand(b.id)}
                              className="w-4 h-4 rounded border border-slate-300 text-slate-500 hover:text-slate-800 hover:border-slate-400 inline-flex items-center justify-center bg-white shadow-2xs transition"
                              title={isExpanded ? "Collapse Details" : "Expand Details"}
                            >
                              {isExpanded ? (
                                <Minus className="w-2.5 h-2.5 stroke-[2.5]" />
                              ) : (
                                <Plus className="w-2.5 h-2.5 stroke-[2.5]" />
                              )}
                            </button>
                          </td>

                          {/* 2. SL */}
                          <td className="px-2.5 py-2 text-center border-r border-slate-200/80 text-slate-700 font-medium">
                            {sl}
                          </td>

                          {/* 3. Action Icons */}
                          <td className="px-3 py-2 border-r border-slate-200/80">
                            <div className="flex items-center justify-center gap-1.5 text-slate-500">
                              {/* Edit Pencil */}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditTarget(b);
                                  setEditForm({
                                    budgetName: b.budgetName,
                                    budgetYear: b.budgetYear,
                                    budgetType: b.budgetType,
                                    totalBudgetAmount: b.totalBudgetAmount ?? b.allocatedAmount,
                                    allocatedAmount: b.allocatedAmount,
                                  });
                                }}
                                className="p-1 hover:text-[#2563eb] rounded hover:bg-blue-50 transition"
                                title="Edit Budget"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>

                              {/* View Eye */}
                              <button
                                type="button"
                                onClick={() => setViewTarget(b)}
                                className="p-1 hover:text-[#2563eb] rounded hover:bg-blue-50 transition"
                                title="View Budget"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {/* Print Printer */}
                              <button
                                type="button"
                                onClick={() => {
                                  setViewTarget(b);
                                  setTimeout(() => window.print(), 300);
                                }}
                                className="p-1 hover:text-[#2563eb] rounded hover:bg-blue-50 transition"
                                title="Print Budget"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>

                              {/* Revise PlusCircle */}
                              <button
                                type="button"
                                onClick={() => {
                                  setRevisionTarget(b);
                                  setNewRevisionAmount(b.totalBudgetAmount ?? b.allocatedAmount);
                                  setRevisionReason("");
                                }}
                                className="p-1 hover:text-[#2563eb] rounded hover:bg-blue-50 transition"
                                title="Revise Budget Ceiling"
                              >
                                <PlusCircle className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>

                          {/* 4. Budget Code */}
                          <td className="px-3.5 py-2 border-r border-slate-200/80 font-normal text-slate-800 whitespace-nowrap">
                            {b.budgetCode}
                          </td>

                          {/* 5. Create Date */}
                          <td className="px-3 py-2 border-r border-slate-200/80 text-slate-700 whitespace-nowrap">
                            {b.createDate || "19-09-2026"}
                          </td>

                          {/* 6. Budget Year */}
                          <td className="px-3.5 py-2 border-r border-slate-200/80 text-slate-700 whitespace-nowrap">
                            {b.budgetYear}
                          </td>

                          {/* 7. Budget Name */}
                          <td className="px-3.5 py-2 border-r border-slate-200/80 text-slate-800 whitespace-nowrap font-medium">
                            {b.budgetName}
                          </td>

                          {/* 8. Budget Type */}
                          <td className="px-3.5 py-2 border-r border-slate-200/80 text-slate-700 whitespace-nowrap">
                            {b.budgetType}
                          </td>

                          {/* 9. Total Budget Amount */}
                          <td className="px-3.5 py-2 text-right border-r border-slate-200/80 font-normal text-slate-800 whitespace-nowrap">
                            {formatAmount(totalAmt)}
                          </td>

                          {/* 10. Status */}
                          <td className="px-3.5 py-2 text-center whitespace-nowrap">
                            <span className="text-[#16a34a] font-medium text-xs">
                              {b.status || b.approvalStatus || "Approved"}
                            </span>
                          </td>
                        </tr>

                        {/* Accordion Row Details */}
                        {isExpanded && (
                          <tr className="bg-slate-50/60">
                            <td colSpan={10} className="p-4 border-b border-slate-200">
                              <div className="bg-white rounded border border-slate-200 p-3.5 space-y-3 shadow-2xs">
                                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-800">
                                      Budget Breakdown — {b.budgetCode}
                                    </span>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                      {b.costCenterName || "Corporate Cost Center"}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    Fiscal Period: <span className="font-medium text-slate-700">{b.budgetYear}</span>
                                  </div>
                                </div>

                                {/* Line Items Table */}
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-xs border border-slate-200">
                                    <thead>
                                      <tr className="bg-slate-100/70 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                                        <th className="px-2.5 py-1.5 text-center w-10">#</th>
                                        <th className="px-2.5 py-1.5 w-24">Code</th>
                                        <th className="px-3 py-1.5">Account Head / Description</th>
                                        <th className="px-3 py-1.5">Cost Center</th>
                                        <th className="px-3 py-1.5 text-right">Allocated (৳)</th>
                                        <th className="px-3 py-1.5 text-right">Utilized (৳)</th>
                                        <th className="px-3 py-1.5 text-right">Remaining (৳)</th>
                                        <th className="px-3 py-1.5">Remarks</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {(b.items && b.items.length > 0) ? (
                                        b.items.map((it, itemIdx) => (
                                          <tr key={it.id || itemIdx} className="hover:bg-slate-50/50">
                                            <td className="px-2.5 py-1.5 text-center text-slate-400 text-[11px]">
                                              {itemIdx + 1}
                                            </td>
                                            <td className="px-2.5 py-1.5 font-mono text-[11px] text-slate-700">
                                              {it.accountCode}
                                            </td>
                                            <td className="px-3 py-1.5 font-medium text-slate-800">
                                              {it.accountName}
                                            </td>
                                            <td className="px-3 py-1.5 text-slate-600 text-[11px]">
                                              {it.costCenterName || b.costCenterName}
                                            </td>
                                            <td className="px-3 py-1.5 text-right font-medium text-slate-900">
                                              {formatAmount(it.allocatedAmount)}
                                            </td>
                                            <td className="px-3 py-1.5 text-right text-amber-700">
                                              {formatAmount(it.utilizedAmount || 0)}
                                            </td>
                                            <td className="px-3 py-1.5 text-right font-semibold text-emerald-700">
                                              {formatAmount(it.remainingAmount ?? it.allocatedAmount)}
                                            </td>
                                            <td className="px-3 py-1.5 text-slate-500 text-[11px]">
                                              {it.remarks || "—"}
                                            </td>
                                          </tr>
                                        ))
                                      ) : (
                                        <tr>
                                          <td colSpan={8} className="py-3 text-center text-slate-400 text-xs">
                                            No granular sub-line allocations. Full amount allocated to main budget head.
                                          </td>
                                        </tr>
                                      )}
                                    </tbody>
                                    <tfoot>
                                      <tr className="bg-slate-50 font-bold border-t border-slate-200 text-slate-900">
                                        <td colSpan={4} className="px-3 py-2 text-right text-[11px] uppercase tracking-wider">
                                          Total Allocated:
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                          {formatAmount(b.totalBudgetAmount ?? b.allocatedAmount)}
                                        </td>
                                        <td className="px-3 py-2 text-right text-amber-800">
                                          {formatAmount(b.utilizedAmount || 0)}
                                        </td>
                                        <td className="px-3 py-2 text-right text-emerald-800">
                                          {formatAmount(b.remainingAmount ?? (b.totalBudgetAmount ?? b.allocatedAmount))}
                                        </td>
                                        <td></td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* 4. FOOTER PAGINATION */}
          {/* ------------------------------------------------------------- */}
          <div className="px-4 py-2.5 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            {/* Rows text & Rows dropdown */}
            <div className="flex items-center gap-4">
              <span>
                Showing{" "}
                <span className="font-semibold text-slate-800">
                  {filteredBudgets.length === 0
                    ? 0
                    : `${(currentPage - 1) * rowsPerPage + 1}-${Math.min(
                        currentPage * rowsPerPage,
                        filteredBudgets.length,
                      )}`}
                </span>{" "}
                of <span className="font-semibold text-slate-800">{filteredBudgets.length}</span> Rows
              </span>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 text-[11px]">Rows</span>
                <select
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="h-6 px-1.5 border border-slate-300 rounded text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="w-7 h-7 flex items-center justify-center border border-slate-200 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              {Array.from({ length: totalPages }).map((_, i) => {
                const pageNum = i + 1;
                const isActive = pageNum === currentPage;
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-7 h-7 flex items-center justify-center rounded text-xs font-semibold transition ${
                      isActive
                        ? "bg-[#2563eb] text-white shadow-2xs"
                        : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="w-7 h-7 flex items-center justify-center border border-slate-200 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 5. MODALS & DIALOGS */}
      {/* ------------------------------------------------------------- */}

      {/* A. Create Budget Modal */}
      <ModalDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Budget"
        subtitle="Establish fiscal department and overhead budget ceiling"
        maxWidth="4xl"
      >
        <form onSubmit={handleSaveBudget} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Budget Name *
              </label>
              <input
                type="text"
                required
                value={createForm.budgetName}
                onChange={(e) => setCreateForm({ ...createForm, budgetName: e.target.value })}
                className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-[#2563eb] focus:border-[#2563eb]"
                placeholder="e.g. November-2026"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Budget Type *
              </label>
              <select
                value={createForm.budgetType}
                onChange={(e) => setCreateForm({ ...createForm, budgetType: e.target.value })}
                className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-[#2563eb] focus:border-[#2563eb]"
              >
                <option value="OverHeads/Expense Budget">OverHeads/Expense Budget</option>
                <option value="Capex Budget">Capex Budget</option>
                <option value="OPERATING">Operating Budget</option>
                <option value="CAPITAL">Capital Budget</option>
                <option value="DEPARTMENT">Departmental Budget</option>
                <option value="PROJECT">Project Budget</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Budget Year / Period *
              </label>
              <input
                type="text"
                required
                value={createForm.budgetYear}
                onChange={(e) => setCreateForm({ ...createForm, budgetYear: e.target.value })}
                className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-[#2563eb] focus:border-[#2563eb]"
                placeholder="e.g. Sep 21, 2026 - Oct 20, 2026"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Create Date *
              </label>
              <input
                type="text"
                required
                value={createForm.createDate}
                onChange={(e) => setCreateForm({ ...createForm, createDate: e.target.value })}
                className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-[#2563eb] focus:border-[#2563eb]"
                placeholder="DD-MM-YYYY"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Cost Center *
              </label>
              <select
                value={createForm.costCenterId}
                onChange={(e) => {
                  const cc = costCenters.find((c) => c.id === e.target.value);
                  setCreateForm({
                    ...createForm,
                    costCenterId: e.target.value,
                    costCenterName: cc?.name || "",
                  });
                }}
                className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-[#2563eb] focus:border-[#2563eb]"
              >
                {costCenters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} - {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Total Budget Amount (৳) *
              </label>
              <input
                type="number"
                required
                min="1"
                step="0.01"
                value={createForm.totalBudgetAmount || ""}
                onChange={(e) =>
                  setCreateForm({ ...createForm, totalBudgetAmount: Number(e.target.value) || 0 })
                }
                className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs font-bold text-slate-900 focus:ring-1 focus:ring-[#2563eb] focus:border-[#2563eb]"
              />
            </div>
          </div>

          {/* Granular Sub-Line Items Builder */}
          <div className="border border-slate-200 rounded p-3 bg-slate-50/50 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                Budget Line Items Breakdown ({createForm.items.length})
              </span>
              <span className="text-[11px] font-medium text-slate-500">
                Sum of lines: ৳{formatAmount(createForm.items.reduce((s, it) => s + it.allocatedAmount, 0))}
              </span>
            </div>

            {/* Quick add line inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 bg-white p-2 border border-slate-200 rounded">
              <div>
                <select
                  value={newItemAccount}
                  onChange={(e) => setNewItemAccount(e.target.value)}
                  className="w-full h-7 px-2 border border-slate-300 rounded text-[11px]"
                >
                  <option value="">Select GL Account Head</option>
                  {accounts
                    .filter((a) => a.accountType === "EXPENSE" || a.accountType === "ASSET")
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} - {a.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <select
                  value={newItemCostCenter}
                  onChange={(e) => setNewItemCostCenter(e.target.value)}
                  className="w-full h-7 px-2 border border-slate-300 rounded text-[11px]"
                >
                  <option value="">Select Cost Center</option>
                  {costCenters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <input
                  type="number"
                  placeholder="Allocated Amount"
                  value={newItemAmount || ""}
                  onChange={(e) => setNewItemAmount(Number(e.target.value) || 0)}
                  className="w-full h-7 px-2 border border-slate-300 rounded text-[11px]"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  placeholder="Remarks"
                  value={newItemRemarks}
                  onChange={(e) => setNewItemRemarks(e.target.value)}
                  className="w-full h-7 px-2 border border-slate-300 rounded text-[11px]"
                />
                <button
                  type="button"
                  onClick={handleAddLineItemToCreate}
                  className="h-7 px-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded text-[11px] font-medium shrink-0"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Lines List */}
            {createForm.items.length > 0 && (
              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="p-1.5 pl-2">Account Head</th>
                      <th className="p-1.5">Cost Center</th>
                      <th className="p-1.5 text-right">Allocated (৳)</th>
                      <th className="p-1.5">Remarks</th>
                      <th className="p-1.5 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {createForm.items.map((it) => (
                      <tr key={it.id}>
                        <td className="p-1.5 pl-2 font-medium text-slate-800">
                          {it.accountCode} - {it.accountName}
                        </td>
                        <td className="p-1.5 text-slate-600 text-[11px]">{it.costCenterName}</td>
                        <td className="p-1.5 text-right font-semibold text-slate-900">
                          {formatAmount(it.allocatedAmount)}
                        </td>
                        <td className="p-1.5 text-slate-500 text-[11px]">{it.remarks || "—"}</td>
                        <td className="p-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveLineItem(it.id)}
                            className="text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded transition shadow-2xs"
            >
              Save & Create Budget
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* B. Edit Budget Modal */}
      <ModalDialog
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        title={`Edit Budget — ${editTarget?.budgetCode || ""}`}
        subtitle="Modify allocation limits and period settings"
        maxWidth="lg"
      >
        {editTarget && (
          <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Budget Name
              </label>
              <input
                type="text"
                required
                value={editForm.budgetName || ""}
                onChange={(e) => setEditForm({ ...editForm, budgetName: e.target.value })}
                className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-[#2563eb]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Budget Year / Period
                </label>
                <input
                  type="text"
                  required
                  value={editForm.budgetYear || ""}
                  onChange={(e) => setEditForm({ ...editForm, budgetYear: e.target.value })}
                  className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-[#2563eb]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Budget Type
                </label>
                <select
                  value={editForm.budgetType || "OverHeads/Expense Budget"}
                  onChange={(e) => setEditForm({ ...editForm, budgetType: e.target.value })}
                  className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-[#2563eb]"
                >
                  <option value="OverHeads/Expense Budget">OverHeads/Expense Budget</option>
                  <option value="Capex Budget">Capex Budget</option>
                  <option value="OPERATING">Operating Budget</option>
                  <option value="CAPITAL">Capital Budget</option>
                  <option value="DEPARTMENT">Departmental Budget</option>
                  <option value="PROJECT">Project Budget</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Total Budget Amount (৳)
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={editForm.totalBudgetAmount ?? editForm.allocatedAmount ?? ""}
                onChange={(e) => {
                  const val = Number(e.target.value) || 0;
                  setEditForm({ ...editForm, totalBudgetAmount: val, allocatedAmount: val });
                }}
                className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs font-bold text-slate-900 focus:ring-1 focus:ring-[#2563eb]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded transition"
              >
                Update Budget
              </button>
            </div>
          </form>
        )}
      </ModalDialog>

      {/* C. View Budget Modal (Official Bridge One ERP Print Voucher) */}
      <ModalDialog
        isOpen={!!viewTarget}
        onClose={() => setViewTarget(null)}
        title={`Budget Specification Voucher — ${viewTarget?.budgetCode || ""}`}
        maxWidth="4xl"
      >
        {viewTarget && (
          <div className="space-y-4 text-xs font-sans">
            {/* Header with Bridge One Official Logo */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-3">
                <div className="relative w-28 h-8">
                  <Image
                    src="/logo.png"
                    alt="Bridge One ERP"
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-tight">
                    Bridge One ERP — Financial Budget Allocation
                  </h4>
                  <p className="text-[11px] text-slate-500">Corporate Finance & Accounts Division</p>
                </div>
              </div>
              <div className="text-right">
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {viewTarget.status || "Approved"}
                </span>
                <p className="text-[10px] text-slate-400 mt-1 font-mono">{viewTarget.budgetCode}</p>
              </div>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/70 p-3 rounded border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Budget Name</span>
                <p className="font-semibold text-slate-900">{viewTarget.budgetName}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Budget Type</span>
                <p className="font-semibold text-slate-900">{viewTarget.budgetType}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Fiscal Period</span>
                <p className="font-semibold text-slate-900">{viewTarget.budgetYear}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Create Date</span>
                <p className="font-semibold text-slate-900">{viewTarget.createDate || "19-09-2026"}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Cost Center</span>
                <p className="font-semibold text-slate-900">{viewTarget.costCenterName || "Corporate Head Office"}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Primary Head</span>
                <p className="font-semibold text-slate-900">{viewTarget.accountName || "Operating Expenses"}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Version</span>
                <p className="font-semibold text-blue-600 font-mono">v{viewTarget.version || 1}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Created By</span>
                <p className="font-semibold text-slate-900">{viewTarget.createdBy || "Finance Controller"}</p>
              </div>
            </div>

            {/* Breakdown Table */}
            <div className="border border-slate-200 rounded overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/70 border-b border-slate-200 text-[11px] font-semibold text-slate-700">
                  <tr>
                    <th className="p-2 text-center w-8">#</th>
                    <th className="p-2 w-20">Code</th>
                    <th className="p-2">Account Description</th>
                    <th className="p-2">Cost Center</th>
                    <th className="p-2 text-right">Allocated (৳)</th>
                    <th className="p-2 text-right">Utilized (৳)</th>
                    <th className="p-2 text-right">Remaining (৳)</th>
                    <th className="p-2">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(viewTarget.items && viewTarget.items.length > 0) ? (
                    viewTarget.items.map((it, idx) => (
                      <tr key={it.id || idx}>
                        <td className="p-2 text-center text-slate-400">{idx + 1}</td>
                        <td className="p-2 font-mono text-slate-600">{it.accountCode}</td>
                        <td className="p-2 font-medium text-slate-900">{it.accountName}</td>
                        <td className="p-2 text-slate-600">{it.costCenterName || viewTarget.costCenterName}</td>
                        <td className="p-2 text-right font-semibold text-slate-900">
                          {formatAmount(it.allocatedAmount)}
                        </td>
                        <td className="p-2 text-right text-amber-700">{formatAmount(it.utilizedAmount || 0)}</td>
                        <td className="p-2 text-right font-bold text-emerald-700">
                          {formatAmount(it.remainingAmount ?? it.allocatedAmount)}
                        </td>
                        <td className="p-2 text-slate-500 text-[11px]">{it.remarks || "—"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="p-4 text-center text-slate-400">
                        General pool allocation without sub-line split.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-bold border-t border-slate-200">
                    <td colSpan={4} className="p-2.5 text-right uppercase text-[11px] text-slate-600">
                      Total Allocation:
                    </td>
                    <td className="p-2.5 text-right text-slate-900 text-sm">
                      ৳{formatAmount(viewTarget.totalBudgetAmount ?? viewTarget.allocatedAmount)}
                    </td>
                    <td className="p-2.5 text-right text-amber-700">
                      ৳{formatAmount(viewTarget.utilizedAmount || 0)}
                    </td>
                    <td className="p-2.5 text-right text-emerald-700 text-sm">
                      ৳{formatAmount(viewTarget.remainingAmount ?? (viewTarget.totalBudgetAmount ?? viewTarget.allocatedAmount))}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* In Words */}
            <div className="bg-blue-50/60 p-2.5 rounded border border-blue-200/60 text-xs">
              <span className="font-semibold text-slate-700">Amount in Words: </span>
              <span className="italic font-medium text-blue-900">
                {numberToWords(viewTarget.totalBudgetAmount ?? viewTarget.allocatedAmount)}
              </span>
            </div>

            {/* Signature Block */}
            <div className="pt-8 pb-3 grid grid-cols-3 gap-6 text-center text-[11px] text-slate-500">
              <div>
                <div className="border-t border-slate-300 pt-1 font-semibold text-slate-700">Prepared By</div>
                <div className="text-[10px] text-slate-400">Budget Analyst</div>
              </div>
              <div>
                <div className="border-t border-slate-300 pt-1 font-semibold text-slate-700">Verified By</div>
                <div className="text-[10px] text-slate-400">Chief Accountant</div>
              </div>
              <div>
                <div className="border-t border-slate-300 pt-1 font-semibold text-slate-700">Approved By</div>
                <div className="text-[10px] text-slate-400">Chief Financial Officer (CFO)</div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setViewTarget(null)}
                className="px-3.5 py-1.5 text-xs text-slate-600 hover:text-slate-800"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 transition"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Specification</span>
              </button>
            </div>
          </div>
        )}
      </ModalDialog>

      {/* D. Revise Budget Ceiling Modal */}
      <ModalDialog
        isOpen={!!revisionTarget}
        onClose={() => setRevisionTarget(null)}
        title={`Revise Budget Limit — ${revisionTarget?.budgetCode || ""}`}
        subtitle={`Increments revision to v${(revisionTarget?.version || 1) + 1} with audit justification`}
        maxWidth="md"
      >
        {revisionTarget && (
          <div className="space-y-3.5 text-xs">
            <div className="rounded bg-slate-50 border border-slate-200 p-3 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Current Budget Ceiling:</span>
                <span className="font-bold text-slate-900">
                  ৳{formatAmount(revisionTarget.totalBudgetAmount ?? revisionTarget.allocatedAmount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Current Utilized:</span>
                <span className="font-semibold text-amber-700">
                  ৳{formatAmount(revisionTarget.utilizedAmount || 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Next Version:</span>
                <span className="font-semibold text-blue-600 font-mono">
                  v{(revisionTarget.version || 1) + 1}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                New Revised Budget Ceiling (৳) *
              </label>
              <input
                type="number"
                step="0.01"
                min="1"
                value={newRevisionAmount || ""}
                onChange={(e) => setNewRevisionAmount(Number(e.target.value) || 0)}
                className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs font-bold text-slate-900 focus:ring-1 focus:ring-[#2563eb]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Revision Justification / Notes
              </label>
              <textarea
                rows={2}
                value={revisionReason}
                onChange={(e) => setRevisionReason(e.target.value)}
                placeholder="e.g. Approved adjustment for Q4 operational overhead expansion"
                className="w-full p-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-[#2563eb]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setRevisionTarget(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRevision}
                className="px-4 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded transition"
              >
                Apply Revision
              </button>
            </div>
          </div>
        )}
      </ModalDialog>
    </div>
  );
}
