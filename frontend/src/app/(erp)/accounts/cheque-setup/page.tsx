"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  CreditCard,
  Download,
  Filter,
  Landmark,
  Plus,
  Printer,
  RotateCcw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { SummaryCard } from "@/components/purchase/SummaryCard";
import { ModalDialog } from "@/components/purchase/ModalDialog";
import { useAccountingStore } from "@/features/accounts/store/accounting-store";

export default function ChequeSetupPage() {
  const chequeBooks = useAccountingStore((s) => s.chequeBooks);
  const bankAccounts = useAccountingStore((s) => s.bankAccounts);
  const addChequeBook = useAccountingStore((s) => s.addChequeBook);

  const [search, setSearch] = useState("");
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [form, setForm] = useState({
    bookName: "",
    bankAccountId: "bank-1",
    bankName: "Sonali Bank PLC",
    accountNumber: "2050123456789",
    startChequeNumber: "SB-1001",
    endChequeNumber: "SB-1050",
    totalLeaves: 50,
    status: "ACTIVE" as const,
  });

  const totalLeavesAll = useMemo(() => chequeBooks.reduce((sum, b) => sum + b.totalLeaves, 0), [chequeBooks]);
  const usedLeavesAll = useMemo(() => chequeBooks.reduce((sum, b) => sum + b.usedLeaves, 0), [chequeBooks]);
  const remainingLeavesAll = useMemo(() => chequeBooks.reduce((sum, b) => sum + b.remainingLeaves, 0), [chequeBooks]);

  const filteredBooks = useMemo(() => {
    return chequeBooks.filter((b) => {
      if (search) {
        const q = search.toLowerCase();
        const m =
          b.bookName.toLowerCase().includes(q) ||
          b.bankName.toLowerCase().includes(q) ||
          b.accountNumber.toLowerCase().includes(q);
        if (!m) return false;
      }
      return true;
    });
  }, [chequeBooks, search]);

  const handleBankChange = (bankId: string) => {
    const bank = bankAccounts.find((b) => b.id === bankId);
    if (bank) {
      setForm({
        ...form,
        bankAccountId: bank.id,
        bankName: bank.bankName,
        accountNumber: bank.accountNumber,
      });
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!form.bookName || !form.startChequeNumber || !form.endChequeNumber) {
      setErrorMessage("Please complete all required cheque book fields.");
      return;
    }

    const res = addChequeBook(form);
    if (!res.success) {
      setErrorMessage(res.message);
      return;
    }

    setSuccessMessage(res.message);
    setTimeout(() => {
      setIsRegisterOpen(false);
      setSuccessMessage("");
    }, 800);
  };

  const handleExportCSV = () => {
    let csv = "SL,Book Name,Bank Name,Account Number,Start Cheque #,End Cheque #,Total Leaves,Used Leaves,Remaining Leaves,Status\n";
    filteredBooks.forEach((b, i) => {
      csv += `"${i + 1}","${b.bookName}","${b.bankName}","${b.accountNumber}","${b.startChequeNumber}","${b.endChequeNumber}","${b.totalLeaves}","${b.usedLeaves}","${b.remainingLeaves}","${b.status}"\n`;
    });
    const link = document.createElement("a");
    link.href = encodeURI("data:text/csv;charset=utf-8," + csv);
    link.download = `BridgeOne_Cheque_Books.csv`;
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
            <span className="text-slate-600 font-medium">Cheque Setup</span>
          </nav>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Cheque Setup & Book Registration</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Commercial cheque book inventory, leaf number series management, and duplicate protections
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cheque book, bank..."
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

          <button
            type="button"
            onClick={() => {
              setErrorMessage("");
              setSuccessMessage("");
              setIsRegisterOpen(true);
            }}
            className="h-9 px-4 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Register Cheque Book</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. SUMMARY KPI CARDS ROW */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard
          title="Cheque Books"
          value={chequeBooks.length}
          subtitle="Registered book records"
          icon={BookOpen}
          variant="info"
        />
        <SummaryCard
          title="Total Cheque Leaves"
          value={totalLeavesAll}
          subtitle="Serial inventory acquired"
          icon={CreditCard}
          variant="default"
        />
        <SummaryCard
          title="Used / Issued Leaves"
          value={usedLeavesAll}
          subtitle="Written to vendors & payroll"
          icon={CheckSquare}
          variant="warning"
        />
        <SummaryCard
          title="Remaining Leaves"
          value={remainingLeavesAll}
          subtitle="Available for issue"
          icon={CheckCircle2}
          variant="success"
        />
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. CHEQUE BOOKS REGISTER TABLE */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <span className="font-bold text-[11px] text-slate-700 uppercase tracking-wide">
            Registered Cheque Books Inventory
          </span>
          <span className="text-xs text-slate-500">{filteredBooks.length} Books</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              <tr>
                <th className="px-3.5 py-2.5">SL</th>
                <th className="px-3.5 py-2.5">Cheque Book Name</th>
                <th className="px-3.5 py-2.5">Bank Name & Branch</th>
                <th className="px-3.5 py-2.5">Account Number</th>
                <th className="px-3.5 py-2.5">Leaf Serial Range</th>
                <th className="px-3.5 py-2.5 text-right">Total Leaves</th>
                <th className="px-3.5 py-2.5 text-right font-medium text-amber-700">Used Leaves</th>
                <th className="px-3.5 py-2.5 text-right font-bold text-emerald-700">Remaining</th>
                <th className="px-3.5 py-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBooks.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-xs text-slate-400">
                    No cheque books registered. Click &quot;Register Cheque Book&quot; to add one.
                  </td>
                </tr>
              ) : (
                filteredBooks.map((b, index) => (
                  <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-3.5 py-2.5 font-medium text-slate-500">{index + 1}</td>
                    <td className="px-3.5 py-2.5 font-bold text-blue-600">{b.bookName}</td>
                    <td className="px-3.5 py-2.5 font-semibold text-slate-900">{b.bankName}</td>
                    <td className="px-3.5 py-2.5 font-mono text-slate-700">{b.accountNumber}</td>
                    <td className="px-3.5 py-2.5 font-mono font-semibold text-slate-800">
                      {b.startChequeNumber} → {b.endChequeNumber}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-semibold text-slate-800">{b.totalLeaves}</td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-semibold text-amber-700">{b.usedLeaves}</td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-bold text-emerald-700 text-sm">
                      {b.remainingLeaves}
                    </td>
                    <td className="px-3.5 py-2.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          b.status === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. MODAL: REGISTER CHEQUE BOOK */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        title="Register Commercial Cheque Book"
        subtitle="Specify bank account, starting serial, and ending serial of the new leaves book"
        maxWidth="md"
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          {errorMessage && (
            <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-700 font-medium">
              {errorMessage}
            </div>
          )}
          {successMessage && (
            <div className="p-2.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium">
              {successMessage}
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Select Bank Account *</label>
            <select
              value={form.bankAccountId}
              onChange={(e) => handleBankChange(e.target.value)}
              className="w-full h-8 border border-slate-300 rounded px-2 text-xs bg-white"
            >
              {bankAccounts.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bankName} — A/C: {b.accountNumber} ({b.accountType})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Cheque Book Reference Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Sonali-Main-Series-02"
              value={form.bookName}
              onChange={(e) => setForm({ ...form, bookName: e.target.value })}
              className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs text-slate-800"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Start Cheque # *</label>
              <input
                type="text"
                required
                placeholder="e.g. SB-1051"
                value={form.startChequeNumber}
                onChange={(e) => setForm({ ...form, startChequeNumber: e.target.value })}
                className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs font-mono text-slate-800"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">End Cheque # *</label>
              <input
                type="text"
                required
                placeholder="e.g. SB-1100"
                value={form.endChequeNumber}
                onChange={(e) => setForm({ ...form, endChequeNumber: e.target.value })}
                className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs font-mono text-slate-800"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsRegisterOpen(false)}
              className="px-3.5 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs"
            >
              Confirm Registration
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
