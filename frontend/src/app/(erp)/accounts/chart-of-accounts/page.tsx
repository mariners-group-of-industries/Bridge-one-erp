"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderOpen,
  Layers,
  List,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Search,
  ShieldCheck,
  Tag,
  X,
} from "lucide-react";
import { SummaryCard } from "@/components/purchase/SummaryCard";
import { ModalDialog } from "@/components/purchase/ModalDialog";
import { useAccountingStore } from "@/features/accounts/store/accounting-store";
import type { AccountItem, AccountType, NormalBalance } from "@/features/accounts/types";

export default function ChartOfAccountsPage() {
  const accounts = useAccountingStore((s) => s.accounts);
  const addAccount = useAccountingStore((s) => s.addAccount);
  const updateAccount = useAccountingStore((s) => s.updateAccount);
  const toggleAccountStatus = useAccountingStore((s) => s.toggleAccountStatus);

  const [activeTab, setActiveTab] = useState<"TREE" | "TABLE">("TREE");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    "1000": true,
    "1100": true,
    "1200": true,
    "2000": true,
    "2100": true,
    "3000": true,
    "4000": true,
    "5000": true,
  });

  // Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountItem | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    parentCode: "",
    accountType: "EXPENSE" as AccountType,
    accountSubtype: "Operating Expense",
    normalBalance: "DEBIT" as NormalBalance,
    description: "",
    openingBalance: 0,
    currency: "BDT",
    isGroup: false,
    status: "ACTIVE" as "ACTIVE" | "INACTIVE",
  });

  const toggleNode = (code: string) => {
    setExpandedNodes((prev) => ({ ...prev, [code]: !prev[code] }));
  };

  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      if (search) {
        const q = search.toLowerCase();
        const m =
          acc.code.toLowerCase().includes(q) ||
          acc.name.toLowerCase().includes(q) ||
          acc.accountSubtype.toLowerCase().includes(q);
        if (!m) return false;
      }
      if (filterType !== "ALL" && acc.accountType !== filterType) return false;
      return true;
    });
  }, [accounts, search, filterType]);

  const rootAccounts = useMemo(() => accounts.filter((a) => !a.parentCode), [accounts]);

  const getChildAccounts = (parentCode: string) => accounts.filter((a) => a.parentCode === parentCode);

  const handleOpenCreate = (parentAccount?: AccountItem) => {
    setErrorMessage("");
    if (parentAccount) {
      const children = accounts.filter((a) => a.parentCode === parentAccount.code);
      const nextSuffix = (children.length + 1) * 10;
      const suggestedCode = `${parentAccount.code.slice(0, 2)}${nextSuffix.toString().padStart(2, "0")}`;

      setFormData({
        code: suggestedCode,
        name: "",
        parentCode: parentAccount.code,
        accountType: parentAccount.accountType,
        accountSubtype: parentAccount.accountSubtype,
        normalBalance: parentAccount.normalBalance,
        description: "",
        openingBalance: 0,
        currency: "BDT",
        isGroup: false,
        status: "ACTIVE",
      });
    } else {
      setFormData({
        code: "",
        name: "",
        parentCode: "",
        accountType: "EXPENSE",
        accountSubtype: "General Admin",
        normalBalance: "DEBIT",
        description: "",
        openingBalance: 0,
        currency: "BDT",
        isGroup: false,
        status: "ACTIVE",
      });
    }
    setEditingAccount(null);
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (account: AccountItem) => {
    setErrorMessage("");
    setEditingAccount(account);
    setFormData({
      code: account.code,
      name: account.name,
      parentCode: account.parentCode || "",
      accountType: account.accountType,
      accountSubtype: account.accountSubtype,
      normalBalance: account.normalBalance,
      description: account.description || "",
      openingBalance: account.openingBalance,
      currency: account.currency,
      isGroup: account.isGroup,
      status: account.status,
    });
    setIsCreateOpen(true);
  };

  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!formData.code || !formData.name) {
      setErrorMessage("Account code and account name are required.");
      return;
    }

    if (!editingAccount) {
      const exists = accounts.some((a) => a.code === formData.code);
      if (exists) {
        setErrorMessage(`Account code ${formData.code} is already in use.`);
        return;
      }
      addAccount(formData);
    } else {
      updateAccount(editingAccount.id, formData);
    }

    setIsCreateOpen(false);
  };

  const handleExportCSV = () => {
    let csv = "SL,Account Code,Account Name,Parent Code,Account Type,Subtype,Normal Balance,Opening Balance,Current Balance,Is Group,Status\n";
    filteredAccounts.forEach((a, i) => {
      csv += `"${i + 1}","${a.code}","${a.name}","${a.parentCode || "-"}","${a.accountType}","${a.accountSubtype}","${a.normalBalance}","${a.openingBalance}","${a.currentBalance}","${a.isGroup ? "YES" : "NO"}","${a.status}"\n`;
    });
    const link = document.createElement("a");
    link.href = encodeURI("data:text/csv;charset=utf-8," + csv);
    link.download = "BridgeOne_Chart_of_Accounts.csv";
    link.click();
  };

  // Recursive Tree Component
  const renderTreeNode = (acc: AccountItem, level = 0) => {
    const children = getChildAccounts(acc.code);
    const hasChildren = children.length > 0;
    const isExpanded = !!expandedNodes[acc.code];

    return (
      <div key={acc.id} className="select-none">
        <div
          className={`group flex items-center justify-between py-1.5 px-2.5 rounded hover:bg-slate-50 transition border-b border-slate-100 ${
            acc.isGroup ? "font-bold text-slate-900 bg-slate-50/40" : "text-slate-700 font-medium"
          }`}
          style={{ paddingLeft: `${level * 22 + 10}px` }}
        >
          <div className="flex items-center gap-2">
            {hasChildren ? (
              <button
                type="button"
                onClick={() => toggleNode(acc.code)}
                className="p-0.5 rounded text-slate-400 hover:text-slate-700 transition"
              >
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-blue-600" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            ) : (
              <span className="w-4 h-4 inline-block" />
            )}

            {acc.isGroup ? (
              <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
            ) : (
              <Tag className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            )}

            <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 font-bold">
              {acc.code}
            </span>

            <span className="text-xs">{acc.name}</span>

            <span className="text-[10px] text-slate-400 ml-1">({acc.accountSubtype})</span>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                acc.normalBalance === "DEBIT" ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {acc.normalBalance}
            </span>

            <span className="font-mono text-xs font-semibold text-slate-900 min-w-[90px] text-right">
              ৳{acc.currentBalance.toLocaleString()}
            </span>

            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition">
              {acc.isGroup && (
                <button
                  type="button"
                  onClick={() => handleOpenCreate(acc)}
                  className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700"
                >
                  + Add Child
                </button>
              )}
              <button
                type="button"
                onClick={() => handleOpenEdit(acc)}
                className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-slate-200 transition"
                title="Edit Account"
              >
                <Pencil className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="space-y-0.5">{children.map((child) => renderTreeNode(child, level + 1))}</div>
        )}
      </div>
    );
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
            <span className="text-slate-600 font-medium">Chart of Accounts</span>
          </nav>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Chart of Accounts (COA)</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configurable 5-tier financial hierarchy: Assets, Liabilities, Equity, Revenue, and Expenses
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search code, name..."
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
            onClick={() => handleOpenCreate()}
            className="h-9 px-4 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create Account</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. SUMMARY CARDS: 5 MAIN ACCOUNT TYPES */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <SummaryCard
          title="Assets (1000)"
          value={`৳${accounts.filter((a) => a.accountType === "ASSET" && !a.isGroup).reduce((s, a) => s + a.currentBalance, 0).toLocaleString()}`}
          subtitle={`${accounts.filter((a) => a.accountType === "ASSET").length} ledgers`}
          icon={Layers}
          variant="info"
        />
        <SummaryCard
          title="Liabilities (2000)"
          value={`৳${accounts.filter((a) => a.accountType === "LIABILITY" && !a.isGroup).reduce((s, a) => s + a.currentBalance, 0).toLocaleString()}`}
          subtitle={`${accounts.filter((a) => a.accountType === "LIABILITY").length} ledgers`}
          icon={ShieldCheck}
          variant="danger"
        />
        <SummaryCard
          title="Equity (3000)"
          value={`৳${accounts.filter((a) => a.accountType === "EQUITY" && !a.isGroup).reduce((s, a) => s + a.currentBalance, 0).toLocaleString()}`}
          subtitle={`${accounts.filter((a) => a.accountType === "EQUITY").length} ledgers`}
          icon={Layers}
          variant="info"
        />
        <SummaryCard
          title="Revenue (4000)"
          value={`৳${accounts.filter((a) => a.accountType === "REVENUE" && !a.isGroup).reduce((s, a) => s + a.currentBalance, 0).toLocaleString()}`}
          subtitle={`${accounts.filter((a) => a.accountType === "REVENUE").length} ledgers`}
          icon={Layers}
          variant="success"
        />
        <SummaryCard
          title="Expenses (5000)"
          value={`৳${accounts.filter((a) => a.accountType === "EXPENSE" && !a.isGroup).reduce((s, a) => s + a.currentBalance, 0).toLocaleString()}`}
          subtitle={`${accounts.filter((a) => a.accountType === "EXPENSE").length} ledgers`}
          icon={Layers}
          variant="warning"
        />
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. NAVIGATION TABS */}
      {/* ------------------------------------------------------------- */}
      <div className="flex items-center gap-8 border-b border-slate-200 mb-3 bg-white px-3 pt-2 rounded-t border-t border-x border-slate-200/90 overflow-x-auto select-none">
        <button
          type="button"
          onClick={() => setActiveTab("TREE")}
          className={`pb-2.5 text-xs font-bold tracking-wide transition-colors relative flex items-center gap-2 uppercase whitespace-nowrap ${
            activeTab === "TREE"
              ? "text-blue-600 border-b-2 border-blue-600 -mb-[1px]"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>TREE VIEW (EXPLORER)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("TABLE")}
          className={`pb-2.5 text-xs font-bold tracking-wide transition-colors relative flex items-center gap-2 uppercase whitespace-nowrap ${
            activeTab === "TABLE"
              ? "text-blue-600 border-b-2 border-blue-600 -mb-[1px]"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>TABLE VIEW (FLAT REGISTER)</span>
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. FILTER TOOLBAR */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded border border-slate-200/90 p-3 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="font-medium text-[11px] text-slate-500">Account Classification:</span>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="border border-slate-200 rounded px-2.5 py-1 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">All Account Classes</option>
                <option value="ASSET">Assets (1000)</option>
                <option value="LIABILITY">Liabilities (2000)</option>
                <option value="EQUITY">Equity (3000)</option>
                <option value="REVENUE">Revenue / Income (4000)</option>
                <option value="EXPENSE">Expenses (5000)</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setSearch("");
              setFilterType("ALL");
            }}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-xs font-medium transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 5. TREE VIEW DISPLAY */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "TREE" && (
        <div className="bg-white rounded border border-slate-200/90 shadow-2xs p-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2.5 mb-3 text-xs text-slate-500">
            <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">Account Hierarchy</span>
            <div className="flex items-center gap-3">
              <span className="font-semibold text-slate-700">Normal Balance</span>
              <span className="font-semibold text-slate-700">Current Balance (৳)</span>
            </div>
          </div>

          <div className="divide-y divide-slate-100">{rootAccounts.map((root) => renderTreeNode(root, 0))}</div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 6. TABLE VIEW REGISTER */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "TABLE" && (
        <div className="bg-white rounded border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-y border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                <tr>
                  <th className="px-3.5 py-2.5">SL</th>
                  <th className="px-3.5 py-2.5">Code</th>
                  <th className="px-3.5 py-2.5">Account Name</th>
                  <th className="px-3.5 py-2.5">Classification</th>
                  <th className="px-3.5 py-2.5">Parent Account</th>
                  <th className="px-3.5 py-2.5 text-center">Type</th>
                  <th className="px-3.5 py-2.5 text-center">Normal Balance</th>
                  <th className="px-3.5 py-2.5 text-right font-bold text-slate-900">Current Balance</th>
                  <th className="px-3.5 py-2.5 text-center">Status</th>
                  <th className="px-3.5 py-2.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAccounts.map((a, index) => (
                  <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-3.5 py-2.5 font-medium text-slate-500">{index + 1}</td>
                    <td className="px-3.5 py-2.5 font-mono font-bold text-blue-600">{a.code}</td>
                    <td className="px-3.5 py-2.5 font-semibold text-slate-900">{a.name}</td>
                    <td className="px-3.5 py-2.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {a.accountType}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 font-mono text-slate-500">{a.parentCode || "-"}</td>
                    <td className="px-3.5 py-2.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          a.isGroup ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-blue-50 text-blue-700 border border-blue-200"
                        }`}
                      >
                        {a.isGroup ? "GROUP" : "POSTABLE"}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-center font-bold text-[10px]">
                      <span className={a.normalBalance === "DEBIT" ? "text-blue-600" : "text-emerald-600"}>
                        {a.normalBalance}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-bold text-slate-900">
                      ৳{a.currentBalance.toLocaleString()}
                    </td>
                    <td className="px-3.5 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => toggleAccountStatus(a.id)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          a.status === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-500 border-slate-200"
                        }`}
                      >
                        {a.status}
                      </button>
                    </td>
                    <td className="px-3.5 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(a)}
                        className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 7. MODAL: CREATE / EDIT ACCOUNT */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title={editingAccount ? `Edit Account — [${editingAccount.code}]` : "Create Chart of Accounts Ledger"}
        subtitle="Define ledger categorization, parent hierarchy, and accounting properties"
        maxWidth="lg"
      >
        <form onSubmit={handleSaveAccount} className="space-y-4 text-xs">
          {errorMessage && (
            <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-700 font-medium">
              {errorMessage}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Account Code *</label>
              <input
                type="text"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                disabled={!!editingAccount}
                className="w-full h-8 border border-slate-300 rounded px-2.5 font-mono text-xs text-slate-800 disabled:bg-slate-100"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Account Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs text-slate-800"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Classification Type *</label>
              <select
                value={formData.accountType}
                onChange={(e) => {
                  const t = e.target.value as AccountType;
                  setFormData({
                    ...formData,
                    accountType: t,
                    normalBalance: t === "ASSET" || t === "EXPENSE" ? "DEBIT" : "CREDIT",
                  });
                }}
                className="w-full h-8 border border-slate-300 rounded px-2 text-xs bg-white"
              >
                <option value="ASSET">Assets</option>
                <option value="LIABILITY">Liabilities</option>
                <option value="EQUITY">Equity</option>
                <option value="REVENUE">Revenue</option>
                <option value="EXPENSE">Expenses</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Normal Balance *</label>
              <select
                value={formData.normalBalance}
                onChange={(e) => setFormData({ ...formData, normalBalance: e.target.value as NormalBalance })}
                className="w-full h-8 border border-slate-300 rounded px-2 text-xs bg-white"
              >
                <option value="DEBIT">DEBIT (Dr)</option>
                <option value="CREDIT">CREDIT (Cr)</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Parent Group Account</label>
              <select
                value={formData.parentCode}
                onChange={(e) => setFormData({ ...formData, parentCode: e.target.value })}
                className="w-full h-8 border border-slate-300 rounded px-2 text-xs bg-white"
              >
                <option value="">None (Top Root Group)</option>
                {accounts
                  .filter((a) => a.isGroup)
                  .map((a) => (
                    <option key={a.id} value={a.code}>
                      [{a.code}] {a.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Subtype / Category</label>
              <input
                type="text"
                value={formData.accountSubtype}
                onChange={(e) => setFormData({ ...formData, accountSubtype: e.target.value })}
                className="w-full h-8 border border-slate-300 rounded px-2.5 text-xs"
              />
            </div>
            <div className="sm:col-span-2 flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="isGroup"
                checked={formData.isGroup}
                onChange={(e) => setFormData({ ...formData, isGroup: e.target.checked })}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="isGroup" className="font-semibold text-slate-700 cursor-pointer">
                This is a Group Account (Non-postable parent category containing sub-accounts)
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-3.5 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs"
            >
              {editingAccount ? "Update Account" : "Create Account"}
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
