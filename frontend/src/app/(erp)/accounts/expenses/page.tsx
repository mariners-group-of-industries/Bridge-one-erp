"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Plus,
  Printer,
  RotateCcw,
  Search,
  ShieldCheck,
  UserCheck,
  Wallet,
  X,
} from "lucide-react";
import { SummaryCard } from "@/components/purchase/SummaryCard";
import { ModalDialog } from "@/components/purchase/ModalDialog";
import { useAccountingStore } from "@/features/accounts/store/accounting-store";
import type { AdvanceRecord, ExpenseRecord, PaymentMethod, ProvisionRecord } from "@/features/accounts/types";

export default function ExpenseAdvancePage() {
  const [activeTab, setActiveTab] = useState<"EXPENSES" | "ADVANCES" | "PROVISIONS" | "PAID">("EXPENSES");
  const [search, setSearch] = useState("");
  const [selectedOffice, setSelectedOffice] = useState("ALL");

  const expenses = useAccountingStore((s) => s.expenses);
  const advances = useAccountingStore((s) => s.advances);
  const provisions = useAccountingStore((s) => s.provisions);
  const accounts = useAccountingStore((s) => s.accounts);
  const createExpense = useAccountingStore((s) => s.createExpense);
  const updateExpenseStatus = useAccountingStore((s) => s.updateExpenseStatus);
  const markExpensePaid = useAccountingStore((s) => s.markExpensePaid);
  const createAdvance = useAccountingStore((s) => s.createAdvance);
  const disburseAdvance = useAccountingStore((s) => s.disburseAdvance);
  const settleAdvance = useAccountingStore((s) => s.settleAdvance);
  const createProvision = useAccountingStore((s) => s.createProvision);

  // Modals
  const [isNewExpenseOpen, setIsNewExpenseOpen] = useState(false);
  const [isNewAdvanceOpen, setIsNewAdvanceOpen] = useState(false);
  const [isNewProvisionOpen, setIsNewProvisionOpen] = useState(false);
  const [settlementTarget, setSettlementTarget] = useState<AdvanceRecord | null>(null);
  const [settleAmount, setSettleAmount] = useState<number>(0);

  // Expense form
  const [expenseForm, setExpenseForm] = useState({
    officeId: "office-main",
    officeName: "Dhaka Corporate HQ",
    expenseType: "Office Utilities",
    accountId: "acc-5100",
    accountName: "Office Rent & Utilities",
    payeeName: "",
    amount: 0,
    date: new Date().toISOString().split("T")[0],
    paymentMethod: "BANK" as PaymentMethod,
    referenceNumber: "",
    description: "",
    status: "PENDING" as ExpenseRecord["status"],
  });

  // Advance form
  const [advanceForm, setAdvanceForm] = useState({
    employeeName: "",
    officeId: "office-main",
    officeName: "Dhaka Corporate HQ",
    purpose: "",
    requestedAmount: 0,
    approvedAmount: 0,
    date: new Date().toISOString().split("T")[0],
    status: "PENDING" as AdvanceRecord["status"],
  });

  // Provision form
  const [provisionForm, setProvisionForm] = useState({
    officeId: "office-main",
    officeName: "Dhaka Corporate HQ",
    accountId: "acc-2120",
    accountName: "Accrued Expenses & Provisions",
    amount: 0,
    effectivePeriod: "October 2026",
    description: "",
    status: "POSTED" as "DRAFT" | "POSTED" | "REVERSED",
  });

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (search) {
        const q = search.toLowerCase();
        const m =
          e.expenseNumber.toLowerCase().includes(q) ||
          e.payeeName.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          e.expenseType.toLowerCase().includes(q);
        if (!m) return false;
      }
      if (selectedOffice !== "ALL" && e.officeId !== selectedOffice) return false;
      if (activeTab === "EXPENSES" && e.status === "PAID") return false;
      if (activeTab === "PAID" && e.status !== "PAID") return false;
      return true;
    });
  }, [expenses, search, selectedOffice, activeTab]);

  const filteredAdvances = useMemo(() => {
    return advances.filter((a) => {
      if (search) {
        const q = search.toLowerCase();
        const m =
          a.advanceNumber.toLowerCase().includes(q) ||
          a.employeeName.toLowerCase().includes(q) ||
          a.purpose.toLowerCase().includes(q);
        if (!m) return false;
      }
      if (selectedOffice !== "ALL" && a.officeId !== selectedOffice) return false;
      return true;
    });
  }, [advances, search, selectedOffice]);

  const filteredProvisions = useMemo(() => {
    return provisions.filter((p) => {
      if (search) {
        const q = search.toLowerCase();
        const m =
          p.provisionNumber.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.effectivePeriod.toLowerCase().includes(q);
        if (!m) return false;
      }
      if (selectedOffice !== "ALL" && p.officeId !== selectedOffice) return false;
      return true;
    });
  }, [provisions, search, selectedOffice]);

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (expenseForm.amount <= 0 || !expenseForm.payeeName) return;
    createExpense(expenseForm);
    setIsNewExpenseOpen(false);
  };

  const handleSaveAdvance = (e: React.FormEvent) => {
    e.preventDefault();
    if (advanceForm.requestedAmount <= 0 || !advanceForm.employeeName) return;
    createAdvance({
      ...advanceForm,
      approvedAmount: advanceForm.approvedAmount || advanceForm.requestedAmount,
    });
    setIsNewAdvanceOpen(false);
  };

  const handleSaveProvision = (e: React.FormEvent) => {
    e.preventDefault();
    if (provisionForm.amount <= 0) return;
    createProvision(provisionForm);
    setIsNewProvisionOpen(false);
  };

  const handleConfirmSettlement = () => {
    if (!settlementTarget || settleAmount <= 0) return;
    settleAdvance(settlementTarget.id, settleAmount);
    setSettlementTarget(null);
    setSettleAmount(0);
  };

  const handleExportCSV = () => {
    let csv = "SL,Record Number,Office,Date,Payee/Employee,Type/Purpose,Amount,Status\n";
    if (activeTab === "EXPENSES" || activeTab === "PAID") {
      filteredExpenses.forEach((e, i) => {
        csv += `"${i + 1}","${e.expenseNumber}","${e.officeName}","${e.date}","${e.payeeName}","${e.expenseType}","${e.amount}","${e.status}"\n`;
      });
    } else if (activeTab === "ADVANCES") {
      filteredAdvances.forEach((a, i) => {
        csv += `"${i + 1}","${a.advanceNumber}","${a.officeName}","${a.date}","${a.employeeName}","${a.purpose}","${a.requestedAmount}","${a.status}"\n`;
      });
    } else {
      filteredProvisions.forEach((p, i) => {
        csv += `"${i + 1}","${p.provisionNumber}","${p.officeName}","${p.effectivePeriod}","-","${p.description}","${p.amount}","${p.status}"\n`;
      });
    }
    const link = document.createElement("a");
    link.href = encodeURI("data:text/csv;charset=utf-8," + csv);
    link.download = `BridgeOne_${activeTab}_Report.csv`;
    link.click();
  };

  return (
    <div className="space-y-3 font-sans pb-12">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP HEADER */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded border border-slate-200/90 shadow-2xs">
        <div>
          <nav className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-0.5">
            <Link href="/accounts" className="hover:text-slate-600 transition">
              Account
            </Link>
            <ChevronRight className="w-3 h-3 text-slate-300" />
            <span className="text-slate-600 font-medium">Expense & Advance</span>
          </nav>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Expense / Advance Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational expense approvals, employee advance disbursements, adjustments, and accrual provisions
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search payee, employee..."
              className="w-56 sm:w-64 h-9 pl-3 pr-8 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white placeholder-slate-400"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <button
            type="button"
            onClick={handleExportCSV}
            className="h-9 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Excel</span>
          </button>

          {activeTab === "EXPENSES" && (
            <button
              type="button"
              onClick={() => setIsNewExpenseOpen(true)}
              className="h-9 px-4 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>Create Expense Request</span>
            </button>
          )}

          {activeTab === "ADVANCES" && (
            <button
              type="button"
              onClick={() => setIsNewAdvanceOpen(true)}
              className="h-9 px-4 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>New Advance Request</span>
            </button>
          )}

          {activeTab === "PROVISIONS" && (
            <button
              type="button"
              onClick={() => setIsNewProvisionOpen(true)}
              className="h-9 px-4 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>Record Accrual Provision</span>
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. SUMMARY KPI CARDS ROW */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard
          title="Pending Expense Approvals"
          value={expenses.filter((e) => e.status === "PENDING").length}
          subtitle={`৳${expenses.filter((e) => e.status === "PENDING").reduce((s, e) => s + e.amount, 0).toLocaleString()} claimed`}
          icon={Clock}
          variant="warning"
        />
        <SummaryCard
          title="Paid Operational Expenses"
          value={`৳${expenses.filter((e) => e.status === "PAID").reduce((s, e) => s + e.amount, 0).toLocaleString()}`}
          subtitle={`${expenses.filter((e) => e.status === "PAID").length} settled vouchers`}
          icon={CheckCircle2}
          variant="success"
        />
        <SummaryCard
          title="Outstanding Employee Advances"
          value={`৳${advances.reduce((s, a) => s + a.remainingBalance, 0).toLocaleString()}`}
          subtitle={`${advances.filter((a) => a.remainingBalance > 0).length} unsettled accounts`}
          icon={Wallet}
          variant="info"
        />
        <SummaryCard
          title="Accrued Expense Provisions"
          value={`৳${provisions.reduce((s, p) => s + p.amount, 0).toLocaleString()}`}
          subtitle={`${provisions.length} active accrual journals`}
          icon={ShieldCheck}
          variant="default"
        />
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. NAVIGATION TABS */}
      {/* ------------------------------------------------------------- */}
      <div className="flex items-center gap-8 border-b border-slate-200 mb-3 bg-white px-3 pt-2 rounded-t border-t border-x border-slate-200/90 overflow-x-auto select-none">
        <button
          type="button"
          onClick={() => setActiveTab("EXPENSES")}
          className={`pb-2.5 text-xs font-bold tracking-wide transition-colors relative flex items-center gap-2 uppercase whitespace-nowrap ${
            activeTab === "EXPENSES"
              ? "text-blue-600 border-b-2 border-blue-600 -mb-[1px]"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>EXPENSE CLAIMS ({expenses.filter((e) => e.status !== "PAID").length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("ADVANCES")}
          className={`pb-2.5 text-xs font-bold tracking-wide transition-colors relative flex items-center gap-2 uppercase whitespace-nowrap ${
            activeTab === "ADVANCES"
              ? "text-blue-600 border-b-2 border-blue-600 -mb-[1px]"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>EMPLOYEE ADVANCES ({advances.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("PROVISIONS")}
          className={`pb-2.5 text-xs font-bold tracking-wide transition-colors relative flex items-center gap-2 uppercase whitespace-nowrap ${
            activeTab === "PROVISIONS"
              ? "text-blue-600 border-b-2 border-blue-600 -mb-[1px]"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>ACCRUED PROVISIONS ({provisions.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("PAID")}
          className={`pb-2.5 text-xs font-bold tracking-wide transition-colors relative flex items-center gap-2 uppercase whitespace-nowrap ${
            activeTab === "PAID"
              ? "text-blue-600 border-b-2 border-blue-600 -mb-[1px]"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>PAID EXPENSES ARCHIVE ({expenses.filter((e) => e.status === "PAID").length})</span>
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. FILTER TOOLBAR */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded border border-slate-200/90 p-3 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="font-medium text-[11px] text-slate-500">Office / Branch:</span>
            <select
              value={selectedOffice}
              onChange={(e) => setSelectedOffice(e.target.value)}
              className="border border-slate-200 rounded px-2.5 py-1 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Branches & Plants</option>
              <option value="office-main">Dhaka Corporate HQ</option>
              <option value="office-ctg">Chittagong Heavy Plant</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              setSearch("");
              setSelectedOffice("ALL");
            }}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-xs font-medium transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 5. TAB 1 & 4: EXPENSES TABLE */}
      {/* ------------------------------------------------------------- */}
      {(activeTab === "EXPENSES" || activeTab === "PAID") && (
        <div className="bg-white rounded border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-y border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                <tr>
                  <th className="px-3.5 py-2.5">SL</th>
                  <th className="px-3.5 py-2.5">Expense #</th>
                  <th className="px-3.5 py-2.5">Date</th>
                  <th className="px-3.5 py-2.5">Office</th>
                  <th className="px-3.5 py-2.5">Payee / Vendor</th>
                  <th className="px-3.5 py-2.5">Expense Category</th>
                  <th className="px-3.5 py-2.5">Payment Method</th>
                  <th className="px-3.5 py-2.5 text-right font-bold text-slate-900">Amount (৳)</th>
                  <th className="px-3.5 py-2.5 text-center">Status</th>
                  <th className="px-3.5 py-2.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-xs text-slate-400">
                      No expense records found matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((e, index) => (
                    <tr key={e.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-3.5 py-2.5 font-medium text-slate-500">{index + 1}</td>
                      <td className="px-3.5 py-2.5 font-mono font-bold text-blue-600">{e.expenseNumber}</td>
                      <td className="px-3.5 py-2.5 text-slate-600">{e.date}</td>
                      <td className="px-3.5 py-2.5 text-slate-700">{e.officeName}</td>
                      <td className="px-3.5 py-2.5 font-semibold text-slate-900">{e.payeeName}</td>
                      <td className="px-3.5 py-2.5 text-slate-700">{e.expenseType}</td>
                      <td className="px-3.5 py-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {e.paymentMethod}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-bold text-slate-900">
                        ৳{e.amount.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            e.status === "PAID"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : e.status === "APPROVED"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : e.status === "REJECTED"
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          {e.status}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {e.status === "PENDING" && (
                            <>
                              <button
                                type="button"
                                onClick={() => updateExpenseStatus(e.id, "APPROVED", "Finance Manager")}
                                className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => updateExpenseStatus(e.id, "REJECTED")}
                                className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-600 hover:bg-rose-700 text-white transition"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {e.status === "APPROVED" && (
                            <button
                              type="button"
                              onClick={() => markExpensePaid(e.id, e.paymentMethod)}
                              className="px-2.5 py-0.5 rounded text-[10px] font-semibold bg-blue-600 hover:bg-blue-700 text-white transition"
                            >
                              Post & Pay
                            </button>
                          )}
                          {e.status === "PAID" && (
                            <span className="text-[11px] font-medium text-emerald-600 flex items-center gap-1 justify-center">
                              <CheckCircle2 className="w-3 h-3" /> Paid
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 6. TAB 2: EMPLOYEE ADVANCES TABLE */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "ADVANCES" && (
        <div className="bg-white rounded border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-y border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                <tr>
                  <th className="px-3.5 py-2.5">SL</th>
                  <th className="px-3.5 py-2.5">Advance #</th>
                  <th className="px-3.5 py-2.5">Employee Name</th>
                  <th className="px-3.5 py-2.5">Office</th>
                  <th className="px-3.5 py-2.5">Purpose</th>
                  <th className="px-3.5 py-2.5 text-right">Requested</th>
                  <th className="px-3.5 py-2.5 text-right font-semibold text-slate-800">Disbursed</th>
                  <th className="px-3.5 py-2.5 text-right text-emerald-700">Settled</th>
                  <th className="px-3.5 py-2.5 text-right font-bold text-rose-700">Remaining Due</th>
                  <th className="px-3.5 py-2.5 text-center">Status</th>
                  <th className="px-3.5 py-2.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAdvances.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-xs text-slate-400">
                      No advance requests recorded yet. Click &quot;New Advance Request&quot; to create one.
                    </td>
                  </tr>
                ) : (
                  filteredAdvances.map((a, index) => (
                    <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-3.5 py-2.5 font-medium text-slate-500">{index + 1}</td>
                      <td className="px-3.5 py-2.5 font-mono font-bold text-blue-600">{a.advanceNumber}</td>
                      <td className="px-3.5 py-2.5 font-semibold text-slate-900">{a.employeeName}</td>
                      <td className="px-3.5 py-2.5 text-slate-600">{a.officeName}</td>
                      <td className="px-3.5 py-2.5 text-slate-700">{a.purpose}</td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-slate-500">
                        ৳{a.requestedAmount.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-medium text-slate-800">
                        ৳{a.disbursedAmount.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-emerald-600 font-semibold">
                        ৳{a.settledAmount.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-bold text-rose-600">
                        ৳{a.remainingBalance.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            a.status === "SETTLED"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : a.status === "DISBURSED"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          {a.status}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {a.status === "PENDING" && (
                            <button
                              type="button"
                              onClick={() => disburseAdvance(a.id, a.approvedAmount)}
                              className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#2563eb] text-white hover:bg-blue-700 transition"
                            >
                              Disburse
                            </button>
                          )}
                          {(a.status === "DISBURSED" || a.status === "PARTIAL") && a.remainingBalance > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setSettlementTarget(a);
                                setSettleAmount(a.remainingBalance);
                              }}
                              className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition"
                            >
                              Settle
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 7. TAB 3: ACCRUED PROVISIONS TABLE */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "PROVISIONS" && (
        <div className="bg-white rounded border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-y border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                <tr>
                  <th className="px-3.5 py-2.5">SL</th>
                  <th className="px-3.5 py-2.5">Provision #</th>
                  <th className="px-3.5 py-2.5">Office</th>
                  <th className="px-3.5 py-2.5">Accrual Account</th>
                  <th className="px-3.5 py-2.5">Effective Period</th>
                  <th className="px-3.5 py-2.5">Description</th>
                  <th className="px-3.5 py-2.5 text-right font-bold text-slate-900">Provision Amount (৳)</th>
                  <th className="px-3.5 py-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProvisions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-xs text-slate-400">
                      No accrual provisions recorded yet.
                    </td>
                  </tr>
                ) : (
                  filteredProvisions.map((p, index) => (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-3.5 py-2.5 font-medium text-slate-500">{index + 1}</td>
                      <td className="px-3.5 py-2.5 font-mono font-bold text-blue-600">{p.provisionNumber}</td>
                      <td className="px-3.5 py-2.5 text-slate-700">{p.officeName}</td>
                      <td className="px-3.5 py-2.5 font-medium text-slate-900">{p.accountName}</td>
                      <td className="px-3.5 py-2.5 text-slate-600">{p.effectivePeriod}</td>
                      <td className="px-3.5 py-2.5 text-slate-600">{p.description}</td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-bold text-slate-900">
                        ৳{p.amount.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 8. MODAL: CREATE EXPENSE REQUEST */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={isNewExpenseOpen}
        onClose={() => setIsNewExpenseOpen(false)}
        title="Create Expense Claim / Voucher"
        subtitle="Submit operational or administrative expense for accounting verification and payment"
        maxWidth="lg"
      >
        <form onSubmit={handleSaveExpense} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Office / Branch *</label>
              <select
                value={expenseForm.officeId}
                onChange={(e) =>
                  setExpenseForm({
                    ...expenseForm,
                    officeId: e.target.value,
                    officeName: e.target.value === "office-main" ? "Dhaka Corporate HQ" : "Chittagong Heavy Plant",
                  })
                }
                className="w-full h-8 border border-slate-300 rounded px-2 text-xs bg-white"
              >
                <option value="office-main">Dhaka Corporate HQ</option>
                <option value="office-ctg">Chittagong Heavy Plant</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Expense Date *</label>
              <input
                type="date"
                required
                value={expenseForm.date}
                onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                className="w-full h-8 border border-slate-300 rounded px-2 text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Payee / Vendor Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Dhaka Power Distribution Co."
                value={expenseForm.payeeName}
                onChange={(e) => setExpenseForm({ ...expenseForm, payeeName: e.target.value })}
                className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs text-slate-800"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Expense Type</label>
              <input
                type="text"
                value={expenseForm.expenseType}
                onChange={(e) => setExpenseForm({ ...expenseForm, expenseType: e.target.value })}
                className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs text-slate-800"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Debit Expense Account Ledger *</label>
              <select
                value={expenseForm.accountId}
                onChange={(e) => {
                  const acc = accounts.find((a) => a.id === e.target.value);
                  setExpenseForm({ ...expenseForm, accountId: e.target.value, accountName: acc?.name || "Expense" });
                }}
                className="w-full h-8 border border-slate-300 rounded px-2 text-xs bg-white"
              >
                {accounts
                  .filter((a) => a.accountType === "EXPENSE" && !a.isGroup)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      [{a.code}] {a.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Amount (৳) *</label>
              <input
                type="number"
                required
                min="1"
                value={expenseForm.amount || ""}
                onChange={(e) => setExpenseForm({ ...expenseForm, amount: parseFloat(e.target.value) || 0 })}
                className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs font-mono text-slate-800"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Payment Method</label>
              <select
                value={expenseForm.paymentMethod}
                onChange={(e) => setExpenseForm({ ...expenseForm, paymentMethod: e.target.value as any })}
                className="w-full h-8 border border-slate-300 rounded px-2 text-xs bg-white"
              >
                <option value="BANK">Bank Transfer / Online</option>
                <option value="CASH">Cash in Hand</option>
                <option value="CHEQUE">Corporate Cheque</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Description / Bill Memo *</label>
              <input
                type="text"
                required
                placeholder="Bill memo or business purpose"
                value={expenseForm.description}
                onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs text-slate-800"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsNewExpenseOpen(false)}
              className="px-3.5 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs"
            >
              Submit Expense
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* ------------------------------------------------------------- */}
      {/* 9. MODAL: CREATE ADVANCE REQUEST */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={isNewAdvanceOpen}
        onClose={() => setIsNewAdvanceOpen(false)}
        title="Employee Advance Request"
        subtitle="Record official advances for travel, project procurement, or emergency funds"
        maxWidth="md"
      >
        <form onSubmit={handleSaveAdvance} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Responsible Employee Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Md. Tariqul Islam (Procurement Officer)"
              value={advanceForm.employeeName}
              onChange={(e) => setAdvanceForm({ ...advanceForm, employeeName: e.target.value })}
              className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs text-slate-800"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Purpose of Advance *</label>
            <input
              type="text"
              required
              placeholder="e.g. Chittagong Factory Site Visit & Emergency Conveyance"
              value={advanceForm.purpose}
              onChange={(e) => setAdvanceForm({ ...advanceForm, purpose: e.target.value })}
              className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs text-slate-800"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Requested Amount (৳) *</label>
            <input
              type="number"
              required
              min="100"
              value={advanceForm.requestedAmount || ""}
              onChange={(e) =>
                setAdvanceForm({
                  ...advanceForm,
                  requestedAmount: parseFloat(e.target.value) || 0,
                  approvedAmount: parseFloat(e.target.value) || 0,
                })
              }
              className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs font-mono text-slate-800"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsNewAdvanceOpen(false)}
              className="px-3.5 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs"
            >
              Submit Advance
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* ------------------------------------------------------------- */}
      {/* 10. MODAL: SETTLE ADVANCE */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={!!settlementTarget}
        onClose={() => setSettlementTarget(null)}
        title={`Settle Advance — ${settlementTarget?.advanceNumber}`}
        subtitle={`Employee: ${settlementTarget?.employeeName} | Remaining: ৳${settlementTarget?.remainingBalance.toLocaleString()}`}
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Adjustment / Settlement Amount (৳) *</label>
            <input
              type="number"
              min="1"
              max={settlementTarget?.remainingBalance}
              value={settleAmount}
              onChange={(e) => setSettleAmount(parseFloat(e.target.value) || 0)}
              className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs font-mono text-slate-800"
            />
          </div>
          <div className="p-2.5 bg-slate-50 rounded border border-slate-200 text-slate-600">
            This will reduce the employee advance ledger balance and post the eligible settled expenses into the General Ledger.
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setSettlementTarget(null)}
              className="px-3.5 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmSettlement}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow-xs"
            >
              Confirm Settlement
            </button>
          </div>
        </div>
      </ModalDialog>

      {/* ------------------------------------------------------------- */}
      {/* 11. MODAL: RECORD PROVISION */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={isNewProvisionOpen}
        onClose={() => setIsNewProvisionOpen(false)}
        title="Record Accrual Provision"
        subtitle="Recognize accrued expenses and liability obligations for financial period closing"
        maxWidth="md"
      >
        <form onSubmit={handleSaveProvision} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Effective Financial Period *</label>
            <input
              type="text"
              required
              value={provisionForm.effectivePeriod}
              onChange={(e) => setProvisionForm({ ...provisionForm, effectivePeriod: e.target.value })}
              className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs text-slate-800"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Accrual Description *</label>
            <input
              type="text"
              required
              placeholder="e.g. Audit fee accrual, electricity unpaid provision"
              value={provisionForm.description}
              onChange={(e) => setProvisionForm({ ...provisionForm, description: e.target.value })}
              className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs text-slate-800"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Estimated Provision Amount (৳) *</label>
            <input
              type="number"
              required
              min="100"
              value={provisionForm.amount || ""}
              onChange={(e) => setProvisionForm({ ...provisionForm, amount: parseFloat(e.target.value) || 0 })}
              className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs font-mono text-slate-800"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsNewProvisionOpen(false)}
              className="px-3.5 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs"
            >
              Post Provision
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
