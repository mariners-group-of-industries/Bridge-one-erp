"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  Edit2,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  HelpCircle,
  Key,
  Layers,
  MinusSquare,
  Pencil,
  Plus,
  PlusCircle,
  PlusSquare,
  Printer,
  RotateCcw,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  Upload,
  User,
  UserCheck,
  X,
} from "lucide-react";
import { ModalDialog } from "@/components/purchase/ModalDialog";
import { useAccountingStore } from "@/features/accounts/store/accounting-store";
import type { AccountItem, AccountType, CoaPermissionItem, NormalBalance } from "@/features/accounts/types";

export default function ChartOfAccountsPage() {
  const accounts = useAccountingStore((s) => s.accounts);
  const coaPermissions = useAccountingStore((s) => s.coaPermissions);
  const addAccount = useAccountingStore((s) => s.addAccount);
  const updateAccount = useAccountingStore((s) => s.updateAccount);
  const toggleAccountStatus = useAccountingStore((s) => s.toggleAccountStatus);
  const addCoaPermission = useAccountingStore((s) => s.addCoaPermission);
  const deleteCoaPermission = useAccountingStore((s) => s.deleteCoaPermission);
  const toggleCoaPermission = useAccountingStore((s) => s.toggleCoaPermission);

  // Active Tab
  const [activeTab, setActiveTab] = useState<"TABLE" | "TREE" | "PERMISSION">("TABLE");

  // Filters for Table View
  const [statusFilter, setStatusFilter] = useState<"Active" | "Inactive" | "All">("Active");

  // Filters for Permission Tab
  const [permEmployeeFilter, setPermEmployeeFilter] = useState("");
  const [permVoucherTypeFilter, setPermVoucherTypeFilter] = useState("ALL");
  const [permAccountFilter, setPermAccountFilter] = useState("ALL");

  // Tree View Expansion State
  const [expandedCodes, setExpandedCodes] = useState<Record<string, boolean>>({
    "1": true,
    "1450": true,
    "1460": true,
    "10102": true,
    "102": true,
    "103": true,
    "2": true,
    "201": true,
    "3": true,
    "4": true,
    "5": true,
    "6": true,
    "7": true,
  });
  const [selectedTreeCode, setSelectedTreeCode] = useState<string>("102");

  // Create / Upload Modal
  const [isCreateUploadOpen, setIsCreateUploadOpen] = useState(false);
  const [createUploadTab, setCreateUploadTab] = useState<"CREATE" | "UPLOAD">("CREATE");
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);

  // Form State for Create / Edit Account
  const [accountForm, setAccountForm] = useState({
    code: "",
    name: "",
    parentCode: "",
    accountType: "ASSET" as AccountType,
    tierLevel: "GL" as "Group" | "Class" | "Category" | "GL",
    accountSubtype: "GL",
    normalBalance: "DEBIT" as NormalBalance,
    openingBalance: 0,
    currency: "BDT",
    isGroup: false,
    status: "ACTIVE" as "ACTIVE" | "INACTIVE",
    description: "",
  });

  // Create Permission Modal
  const [isPermModalOpen, setIsPermModalOpen] = useState(false);
  const [permForm, setPermForm] = useState({
    employeeName: "Mohammad Arif",
    employeeId: "EMP-101",
    voucherType: "Payment",
    accountHeadCode: "10101005",
    accountHeadName: "Cash in Hand - Factory",
    status: "ACTIVE" as "ACTIVE" | "INACTIVE",
  });

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Toggle tree node expansion
  const toggleTreeNode = (code: string) => {
    setExpandedCodes((prev) => ({ ...prev, [code]: !prev[code] }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    accounts.forEach((a) => {
      all[a.code] = true;
    });
    setExpandedCodes(all);
  };

  const collapseAll = () => {
    setExpandedCodes({});
  };

  // Build hierarchical list for Table View
  const hierarchicalAccounts = useMemo(() => {
    const result: Array<AccountItem & { depth: number; tier: "Group" | "Class" | "Category" | "GL" }> = [];

    const getTier = (acc: AccountItem, depth: number): "Group" | "Class" | "Category" | "GL" => {
      if (acc.tierLevel) return acc.tierLevel;
      if (depth === 0) return "Group";
      if (depth === 1) return "Class";
      if (depth === 2) return "Category";
      return "GL";
    };

    const traverse = (parentCode: string | null, depth: number) => {
      const children = accounts.filter((a) => {
        if (!parentCode) return !a.parentCode;
        return a.parentCode === parentCode;
      });

      for (const child of children) {
        const tier = getTier(child, depth);
        result.push({ ...child, depth, tier });
        traverse(child.code, depth + 1);
      }
    };

    traverse(null, 0);

    // Apply status filter
    return result.filter((item) => {
      if (statusFilter === "Active") return item.status === "ACTIVE";
      if (statusFilter === "Inactive") return item.status === "INACTIVE";
      return true;
    });
  }, [accounts, statusFilter]);

  // Filtered Permissions for Tab 3
  const filteredPermissions = useMemo(() => {
    return coaPermissions.filter((p) => {
      if (permEmployeeFilter.trim()) {
        const q = permEmployeeFilter.toLowerCase();
        if (!p.employeeName.toLowerCase().includes(q) && !p.employeeId.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (permVoucherTypeFilter !== "ALL" && p.voucherType !== permVoucherTypeFilter) {
        return false;
      }
      if (permAccountFilter !== "ALL" && p.accountHeadCode !== permAccountFilter) {
        return false;
      }
      return true;
    });
  }, [coaPermissions, permEmployeeFilter, permVoucherTypeFilter, permAccountFilter]);

  // Open Create for Child
  const handleAddChild = (parent: AccountItem) => {
    setEditingAccountId(null);
    setErrorMessage("");
    const defaultTier: "Group" | "Class" | "Category" | "GL" =
      parent.tierLevel === "Group"
        ? "Class"
        : parent.tierLevel === "Class"
        ? "Category"
        : "GL";

    setAccountForm({
      code: `${parent.code}01`,
      name: "",
      parentCode: parent.code,
      accountType: parent.accountType,
      tierLevel: defaultTier,
      accountSubtype: defaultTier,
      normalBalance: parent.normalBalance,
      openingBalance: 0,
      currency: "BDT",
      isGroup: defaultTier !== "GL",
      status: "ACTIVE",
      description: "",
    });
    setCreateUploadTab("CREATE");
    setIsCreateUploadOpen(true);
  };

  // Open Edit
  const handleEdit = (acc: AccountItem) => {
    setEditingAccountId(acc.id);
    setErrorMessage("");
    setAccountForm({
      code: acc.code,
      name: acc.name,
      parentCode: acc.parentCode || "",
      accountType: acc.accountType,
      tierLevel: acc.tierLevel || (acc.isGroup ? "Group" : "GL"),
      accountSubtype: acc.accountSubtype,
      normalBalance: acc.normalBalance,
      openingBalance: acc.openingBalance,
      currency: acc.currency,
      isGroup: acc.isGroup,
      status: acc.status,
      description: acc.description || "",
    });
    setCreateUploadTab("CREATE");
    setIsCreateUploadOpen(true);
  };

  // Save Account
  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    if (!accountForm.code.trim() || !accountForm.name.trim()) {
      setErrorMessage("Account code and name are required.");
      return;
    }

    if (editingAccountId) {
      updateAccount(editingAccountId, {
        code: accountForm.code.trim(),
        name: accountForm.name.trim(),
        parentCode: accountForm.parentCode ? accountForm.parentCode.trim() : null,
        accountType: accountForm.accountType,
        tierLevel: accountForm.tierLevel,
        accountSubtype: accountForm.tierLevel,
        normalBalance: accountForm.normalBalance,
        openingBalance: accountForm.openingBalance,
        currency: accountForm.currency,
        isGroup: accountForm.tierLevel !== "GL",
        status: accountForm.status,
        description: accountForm.description,
      });
      setSuccessMessage("Account updated successfully.");
    } else {
      addAccount({
        code: accountForm.code.trim(),
        name: accountForm.name.trim(),
        parentCode: accountForm.parentCode ? accountForm.parentCode.trim() : null,
        accountType: accountForm.accountType,
        tierLevel: accountForm.tierLevel,
        accountSubtype: accountForm.tierLevel,
        normalBalance: accountForm.normalBalance,
        openingBalance: accountForm.openingBalance,
        currency: accountForm.currency,
        isGroup: accountForm.tierLevel !== "GL",
        status: accountForm.status,
        description: accountForm.description,
      });
      setSuccessMessage("Account created successfully.");
    }

    setIsCreateUploadOpen(false);
  };

  // Save Permission
  const handleSavePermission = (e: React.FormEvent) => {
    e.preventDefault();
    if (!permForm.employeeName.trim()) return;
    const targetAccount = accounts.find((a) => a.code === permForm.accountHeadCode);
    addCoaPermission({
      employeeName: permForm.employeeName.trim(),
      employeeId: permForm.employeeId.trim(),
      voucherType: permForm.voucherType,
      accountHeadCode: permForm.accountHeadCode,
      accountHeadName: targetAccount ? targetAccount.name : permForm.accountHeadName,
      status: permForm.status,
    });
    setIsPermModalOpen(false);
  };

  // Export to Excel / CSV
  const handleExportCSV = () => {
    const headers = "SL,Code,Description,Amount,Account Type,Status\n";
    const rows = hierarchicalAccounts
      .map(
        (acc, idx) =>
          `${idx + 1},"${acc.code}","${acc.name}",${acc.currentBalance},"${acc.tier}","${acc.status}"`,
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `chart_of_accounts_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Print PDF
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-3 font-sans pb-12 bg-white">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP HEADER - EXACT MATCH WITH SCREENSHOT */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-white border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">Chart Of Accounts</h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setEditingAccountId(null);
              setAccountForm({
                code: "",
                name: "",
                parentCode: "",
                accountType: "ASSET",
                tierLevel: "GL",
                accountSubtype: "GL",
                normalBalance: "DEBIT",
                openingBalance: 0,
                currency: "BDT",
                isGroup: false,
                status: "ACTIVE",
                description: "",
              });
              setCreateUploadTab("CREATE");
              setIsCreateUploadOpen(true);
            }}
            className="h-8 px-3.5 bg-[#2563eb] hover:bg-blue-700 text-white font-medium text-xs rounded flex items-center gap-1.5 shadow-xs transition"
          >
            <span>Create Upload</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="h-8 px-3.5 bg-white hover:bg-slate-50 text-blue-600 border border-blue-200 font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition uppercase"
          >
            <Download className="w-3.5 h-3.5" />
            <span>EXPORT EXCEL</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="h-8 px-3.5 bg-white hover:bg-slate-50 text-blue-600 border border-blue-200 font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition uppercase"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>PRINT/PDF</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. TABS BAR - TABLE VIEW | TREE VIEW | COA PERMISSION */}
      {/* ------------------------------------------------------------- */}
      <div className="px-4 border-b border-slate-200 flex items-center gap-6 text-xs font-semibold uppercase tracking-wider">
        <button
          type="button"
          onClick={() => setActiveTab("TABLE")}
          className={`py-2.5 transition border-b-2 -mb-[1px] ${
            activeTab === "TABLE"
              ? "text-blue-600 border-blue-600 font-bold"
              : "text-slate-500 border-transparent hover:text-slate-800"
          }`}
        >
          TABLE VIEW
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("TREE")}
          className={`py-2.5 transition border-b-2 -mb-[1px] ${
            activeTab === "TREE"
              ? "text-blue-600 border-blue-600 font-bold"
              : "text-slate-500 border-transparent hover:text-slate-800"
          }`}
        >
          TREE VIEW
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("PERMISSION")}
          className={`py-2.5 transition border-b-2 -mb-[1px] ${
            activeTab === "PERMISSION"
              ? "text-blue-600 border-blue-600 font-bold"
              : "text-slate-500 border-transparent hover:text-slate-800"
          }`}
        >
          COA PERMISSION
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. TAB 1: TABLE VIEW - EXACT SCREENSHOT REPLICA */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "TABLE" && (
        <div className="px-4 space-y-3">
          {/* Status Filter */}
          <div className="w-64">
            <label className="block text-[11px] text-slate-500 font-medium mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full h-8 px-2 border border-slate-300 rounded text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="All">All</option>
            </select>
          </div>

          {/* High Density Table matching screenshot 1 */}
          <div className="overflow-x-auto border border-slate-200 rounded">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#eef4fb] border-b border-slate-200 text-[11px] font-bold text-slate-700">
                <tr>
                  <th className="px-3 py-2 w-12 border-r border-slate-200 text-center">SL</th>
                  <th className="px-3 py-2 w-28 border-r border-slate-200">Code</th>
                  <th className="px-4 py-2 border-r border-slate-200">Description</th>
                  <th className="px-3 py-2 w-36 border-r border-slate-200 text-right">Amount</th>
                  <th className="px-3 py-2 w-32 border-r border-slate-200">Account Type</th>
                  <th className="px-3 py-2 w-36 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {hierarchicalAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No accounts found for the selected status.
                    </td>
                  </tr>
                ) : (
                  hierarchicalAccounts.map((acc, index) => {
                    const isGroup = acc.tier === "Group";
                    const isClass = acc.tier === "Class";
                    const isCategory = acc.tier === "Category";
                    const isGL = acc.tier === "GL";

                    // Indentation based on depth
                    const paddingLeft =
                      acc.depth === 0
                        ? "pl-2"
                        : acc.depth === 1
                        ? "pl-8"
                        : acc.depth === 2
                        ? "pl-14"
                        : "pl-20";

                    return (
                      <tr
                        key={acc.id}
                        className={`hover:bg-blue-50/40 transition-colors ${
                          isGroup ? "bg-slate-50/50 font-semibold" : ""
                        }`}
                      >
                        {/* SL */}
                        <td className="px-3 py-1.5 text-center text-slate-500 border-r border-slate-100 text-[11px]">
                          {index + 1}
                        </td>

                        {/* Code */}
                        <td className="px-3 py-1.5 font-mono text-slate-900 border-r border-slate-100 text-xs">
                          {acc.code}
                        </td>

                        {/* Description with hierarchy indentation */}
                        <td className={`py-1.5 pr-4 border-r border-slate-100 ${paddingLeft}`}>
                          <span
                            className={`${
                              isGroup
                                ? "font-bold text-slate-900"
                                : isClass
                                ? "font-semibold text-slate-800"
                                : isCategory
                                ? "font-medium text-slate-800"
                                : "text-slate-700 font-normal"
                            }`}
                          >
                            {acc.name}
                          </span>
                        </td>

                        {/* Amount */}
                        <td className="px-3 py-1.5 text-right font-mono text-slate-800 border-r border-slate-100 text-xs">
                          {acc.currentBalance.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>

                        {/* Account Type */}
                        <td className="px-3 py-1.5 text-slate-600 border-r border-slate-100 text-xs font-medium">
                          {acc.tier}
                        </td>

                        {/* Actions matching screenshot 1 */}
                        <td className="px-3 py-1.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Group / Class / Category add (+) button */}
                            {(isGroup || isClass || isCategory) && (
                              <button
                                type="button"
                                onClick={() => handleAddChild(acc)}
                                title={`Add Child Account under ${acc.name}`}
                                className="w-5 h-5 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Active toggle switch for Category and GL */}
                            {(isCategory || isGL) && (
                              <button
                                type="button"
                                onClick={() => toggleAccountStatus(acc.id)}
                                title={acc.status === "ACTIVE" ? "Deactivate" : "Activate"}
                                className={`w-8 h-4 rounded-full transition-colors relative flex items-center px-0.5 ${
                                  acc.status === "ACTIVE" ? "bg-blue-600" : "bg-slate-300"
                                }`}
                              >
                                <span
                                  className={`w-3 h-3 rounded-full bg-white transition-transform ${
                                    acc.status === "ACTIVE" ? "translate-x-4" : "translate-x-0"
                                  }`}
                                />
                              </button>
                            )}

                            {/* GL Actions: Edit, Delete, User/Permission */}
                            {isGL && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleEdit(acc)}
                                  title="Edit Account Head"
                                  className="p-1 text-slate-500 hover:text-blue-600 transition"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => toggleAccountStatus(acc.id)}
                                  title="Delete / Deactivate"
                                  className="p-1 text-slate-500 hover:text-rose-600 transition"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setPermForm((prev) => ({
                                      ...prev,
                                      accountHeadCode: acc.code,
                                      accountHeadName: acc.name,
                                    }));
                                    setIsPermModalOpen(true);
                                  }}
                                  title="Assign Employee Permission"
                                  className="p-1 text-slate-500 hover:text-blue-600 transition"
                                >
                                  <User className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. TAB 2: TREE VIEW - EXACT SCREENSHOT 2 REPLICA */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "TREE" && (
        <div className="px-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={expandAll}
                className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 rounded transition"
              >
                Expand All
              </button>
              <button
                type="button"
                onClick={collapseAll}
                className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 rounded transition"
              >
                Collapse All
              </button>
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="h-7 px-3 bg-white hover:bg-slate-50 text-blue-600 border border-blue-200 font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs uppercase"
            >
              <Printer className="w-3 h-3" />
              <span>PRINT/PDF</span>
            </button>
          </div>

          {/* Tree hierarchy container */}
          <div className="border border-slate-200 rounded p-4 bg-white min-h-[480px] font-mono text-xs">
            {accounts
              .filter((a) => !a.parentCode)
              .map((rootAcc) => {
                const isRootExpanded = !!expandedCodes[rootAcc.code];
                const rootChildren = accounts.filter((a) => a.parentCode === rootAcc.code);

                return (
                  <div key={rootAcc.id} className="mb-2">
                    {/* Root Level (Group) */}
                    <div
                      onClick={() => {
                        setSelectedTreeCode(rootAcc.code);
                        toggleTreeNode(rootAcc.code);
                      }}
                      className={`flex items-center gap-1.5 py-1 px-1.5 rounded cursor-pointer select-none transition ${
                        selectedTreeCode === rootAcc.code
                          ? "bg-blue-100/70 text-blue-900 font-bold"
                          : "hover:bg-slate-50 text-slate-800 font-medium"
                      }`}
                    >
                      {rootChildren.length > 0 ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTreeNode(rootAcc.code);
                          }}
                          className="w-4 h-4 flex items-center justify-center text-slate-600 hover:text-blue-600"
                        >
                          {isRootExpanded ? (
                            <MinusSquare className="w-3.5 h-3.5 text-slate-500" />
                          ) : (
                            <PlusSquare className="w-3.5 h-3.5 text-slate-500" />
                          )}
                        </button>
                      ) : (
                        <span className="w-4" />
                      )}
                      <Folder className="w-3.5 h-3.5 text-amber-500" />
                      <span>
                        {rootAcc.code} - {rootAcc.name}
                      </span>
                    </div>

                    {/* Children of Root */}
                    {isRootExpanded && rootChildren.length > 0 && (
                      <div className="ml-6 pl-2 border-l border-dashed border-slate-300 space-y-1 mt-1">
                        {rootChildren.map((childAcc) => {
                          const isChildExpanded = !!expandedCodes[childAcc.code];
                          const subChildren = accounts.filter((a) => a.parentCode === childAcc.code);

                          return (
                            <div key={childAcc.id}>
                              <div
                                onClick={() => {
                                  setSelectedTreeCode(childAcc.code);
                                  if (subChildren.length > 0) toggleTreeNode(childAcc.code);
                                }}
                                className={`flex items-center gap-1.5 py-1 px-1.5 rounded cursor-pointer select-none transition ${
                                  selectedTreeCode === childAcc.code
                                    ? "bg-blue-100/70 text-blue-900 font-bold"
                                    : "hover:bg-slate-50 text-slate-800"
                                }`}
                              >
                                {subChildren.length > 0 ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleTreeNode(childAcc.code);
                                    }}
                                    className="w-4 h-4 flex items-center justify-center text-slate-600 hover:text-blue-600"
                                  >
                                    {isChildExpanded ? (
                                      <MinusSquare className="w-3.5 h-3.5 text-slate-500" />
                                    ) : (
                                      <PlusSquare className="w-3.5 h-3.5 text-slate-500" />
                                    )}
                                  </button>
                                ) : (
                                  <span className="w-4" />
                                )}
                                <Folder className="w-3.5 h-3.5 text-amber-500" />
                                <span>
                                  {childAcc.code} - {childAcc.name}
                                </span>
                              </div>

                              {/* Sub Children (Level 3 - Category / GL) */}
                              {isChildExpanded && subChildren.length > 0 && (
                                <div className="ml-6 pl-2 border-l border-dashed border-slate-300 space-y-1 mt-1">
                                  {subChildren.map((subChild) => {
                                    const isSubExpanded = !!expandedCodes[subChild.code];
                                    const leafNodes = accounts.filter((a) => a.parentCode === subChild.code);

                                    return (
                                      <div key={subChild.id}>
                                        <div
                                          onClick={() => {
                                            setSelectedTreeCode(subChild.code);
                                            if (leafNodes.length > 0) toggleTreeNode(subChild.code);
                                          }}
                                          className={`flex items-center gap-1.5 py-0.5 px-1.5 rounded cursor-pointer select-none transition ${
                                            selectedTreeCode === subChild.code
                                              ? "bg-blue-100/70 text-blue-900 font-bold"
                                              : "hover:bg-slate-50 text-slate-700"
                                          }`}
                                        >
                                          {leafNodes.length > 0 ? (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                toggleTreeNode(subChild.code);
                                              }}
                                              className="w-4 h-4 flex items-center justify-center text-slate-600 hover:text-blue-600"
                                            >
                                              {isSubExpanded ? (
                                                <MinusSquare className="w-3.5 h-3.5 text-slate-500" />
                                              ) : (
                                                <PlusSquare className="w-3.5 h-3.5 text-slate-500" />
                                              )}
                                            </button>
                                          ) : (
                                            <span className="w-4" />
                                          )}
                                          {leafNodes.length > 0 ? (
                                            <Folder className="w-3.5 h-3.5 text-amber-500" />
                                          ) : (
                                            <FileText className="w-3.5 h-3.5 text-blue-500" />
                                          )}
                                          <span>
                                            {subChild.code} - {subChild.name}
                                          </span>
                                        </div>

                                        {/* Leaf level (Level 4 - GL accounts) */}
                                        {isSubExpanded && leafNodes.length > 0 && (
                                          <div className="ml-6 pl-2 border-l border-dashed border-slate-300 space-y-1 mt-1">
                                            {leafNodes.map((leaf) => (
                                              <div
                                                key={leaf.id}
                                                onClick={() => setSelectedTreeCode(leaf.code)}
                                                className={`flex items-center gap-1.5 py-0.5 px-1.5 rounded cursor-pointer select-none transition ${
                                                  selectedTreeCode === leaf.code
                                                    ? "bg-blue-100/70 text-blue-900 font-bold"
                                                    : "hover:bg-slate-50 text-slate-600"
                                                }`}
                                              >
                                                <span className="w-4" />
                                                <FileText className="w-3.5 h-3.5 text-slate-400" />
                                                <span>
                                                  {leaf.code} - {leaf.name}
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. TAB 3: COA PERMISSION - EXACT SCREENSHOT 3 REPLICA */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "PERMISSION" && (
        <div className="px-4 space-y-3">
          {/* Top Right Create Button */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setIsPermModalOpen(true)}
              className="h-8 px-4 bg-[#2563eb] hover:bg-blue-700 text-white font-medium text-xs rounded flex items-center gap-1.5 shadow-xs transition"
            >
              <span>Create</span>
            </button>
          </div>

          {/* Filter Bar */}
          <div className="p-3 bg-white border border-slate-200 rounded grid grid-cols-1 sm:grid-cols-4 gap-3 items-end text-xs">
            {/* Employee Search */}
            <div>
              <label className="block text-[11px] text-slate-500 font-medium mb-1">Employee</label>
              <input
                type="text"
                placeholder="Select/Search Employee (min 3 letters)"
                value={permEmployeeFilter}
                onChange={(e) => setPermEmployeeFilter(e.target.value)}
                className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Voucher Type */}
            <div>
              <label className="block text-[11px] text-slate-500 font-medium mb-1">Voucher Type</label>
              <select
                value={permVoucherTypeFilter}
                onChange={(e) => setPermVoucherTypeFilter(e.target.value)}
                className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">Voucher Type</option>
                <option value="Payment">Payment</option>
                <option value="Receipt">Receipt</option>
                <option value="General">General</option>
                <option value="Contra">Contra</option>
                <option value="Adjustment">Adjustment</option>
              </select>
            </div>

            {/* Account Head */}
            <div>
              <label className="block text-[11px] text-slate-500 font-medium mb-1">Account Head</label>
              <select
                value={permAccountFilter}
                onChange={(e) => setPermAccountFilter(e.target.value)}
                className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">Account Head</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.code}>
                    {acc.code} - {acc.name}
                  </option>
                ))}
              </select>
            </div>

            {/* View Button */}
            <div>
              <button
                type="button"
                className="h-8 px-5 bg-[#2563eb] hover:bg-blue-700 text-white font-medium text-xs rounded shadow-xs transition"
              >
                View
              </button>
            </div>
          </div>

          {/* Permissions Data Table matching screenshot 3 */}
          <div className="overflow-x-auto border border-slate-200 rounded">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#eef4fb] border-b border-slate-200 text-[11px] font-bold text-slate-700">
                <tr>
                  <th className="px-3 py-2 w-16 border-r border-slate-200 text-center">SL</th>
                  <th className="px-4 py-2 border-r border-slate-200">Employee Name</th>
                  <th className="px-4 py-2 border-r border-slate-200">Voucher Type</th>
                  <th className="px-4 py-2 border-r border-slate-200">Account Head</th>
                  <th className="px-3 py-2 w-32 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPermissions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      No permissions configured. Click &quot;Create&quot; to assign access rights to an employee.
                    </td>
                  </tr>
                ) : (
                  filteredPermissions.map((perm, index) => (
                    <tr key={perm.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-3 py-2 text-center text-slate-500 border-r border-slate-100">
                        {index + 1}
                      </td>
                      <td className="px-4 py-2 font-medium text-slate-900 border-r border-slate-100">
                        {perm.employeeName}
                        <span className="text-[10px] text-slate-400 block font-normal">{perm.employeeId}</span>
                      </td>
                      <td className="px-4 py-2 text-slate-700 border-r border-slate-100 font-medium">
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[11px] font-semibold">
                          {perm.voucherType}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-800 border-r border-slate-100">
                        <span className="font-mono text-blue-600 font-semibold mr-1.5">{perm.accountHeadCode}</span>
                        {perm.accountHeadName}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleCoaPermission(perm.id)}
                            title={perm.status === "ACTIVE" ? "Revoke Permission" : "Restore Permission"}
                            className={`w-8 h-4 rounded-full transition-colors relative flex items-center px-0.5 ${
                              perm.status === "ACTIVE" ? "bg-blue-600" : "bg-slate-300"
                            }`}
                          >
                            <span
                              className={`w-3 h-3 rounded-full bg-white transition-transform ${
                                perm.status === "ACTIVE" ? "translate-x-4" : "translate-x-0"
                              }`}
                            />
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteCoaPermission(perm.id)}
                            title="Delete Permission"
                            className="p-1 text-slate-400 hover:text-rose-600 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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
      {/* 6. CREATE / UPLOAD MODAL */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={isCreateUploadOpen}
        onClose={() => setIsCreateUploadOpen(false)}
        title={editingAccountId ? "Edit Account Head" : "Create / Upload Chart of Accounts"}
        maxWidth="lg"
      >
        <div className="space-y-3 text-xs">
          {/* Sub-tabs inside modal */}
          {!editingAccountId && (
            <div className="flex border-b border-slate-200 gap-4 mb-2">
              <button
                type="button"
                onClick={() => setCreateUploadTab("CREATE")}
                className={`pb-2 text-xs font-semibold uppercase tracking-wider border-b-2 -mb-[1px] ${
                  createUploadTab === "CREATE"
                    ? "text-blue-600 border-blue-600"
                    : "text-slate-500 border-transparent hover:text-slate-800"
                }`}
              >
                Create Single Account
              </button>
              <button
                type="button"
                onClick={() => setCreateUploadTab("UPLOAD")}
                className={`pb-2 text-xs font-semibold uppercase tracking-wider border-b-2 -mb-[1px] ${
                  createUploadTab === "UPLOAD"
                    ? "text-blue-600 border-blue-600"
                    : "text-slate-500 border-transparent hover:text-slate-800"
                }`}
              >
                Bulk Excel / CSV Upload
              </button>
            </div>
          )}

          {errorMessage && (
            <div className="flex items-center gap-2 rounded bg-rose-50 border border-rose-200 p-2 text-xs font-medium text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0" /> {errorMessage}
            </div>
          )}

          {createUploadTab === "CREATE" ? (
            <form onSubmit={handleSaveAccount} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Account Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 10101016"
                    value={accountForm.code}
                    onChange={(e) => setAccountForm({ ...accountForm, code: e.target.value })}
                    className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs font-mono font-semibold focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Account Level *
                  </label>
                  <select
                    value={accountForm.tierLevel}
                    onChange={(e) =>
                      setAccountForm({
                        ...accountForm,
                        tierLevel: e.target.value as any,
                        isGroup: e.target.value !== "GL",
                      })
                    }
                    className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="Group">Group (Level 1)</option>
                    <option value="Class">Class (Level 2)</option>
                    <option value="Category">Category (Level 3)</option>
                    <option value="GL">GL Account (Level 4)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Description / Account Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cash in Hand - Bogra Branch"
                  value={accountForm.name}
                  onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                  className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Parent Account
                  </label>
                  <select
                    value={accountForm.parentCode}
                    onChange={(e) => setAccountForm({ ...accountForm, parentCode: e.target.value })}
                    className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">None (Top Level Root)</option>
                    {accounts
                      .filter((a) => a.isGroup || a.tierLevel !== "GL")
                      .map((a) => (
                        <option key={a.id} value={a.code}>
                          {a.code} - {a.name} ({a.tierLevel || a.accountSubtype})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Classification Pillar *
                  </label>
                  <select
                    value={accountForm.accountType}
                    onChange={(e) => setAccountForm({ ...accountForm, accountType: e.target.value as any })}
                    className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="ASSET">Asset</option>
                    <option value="LIABILITY">Liability</option>
                    <option value="EQUITY">Equity</option>
                    <option value="REVENUE">Revenue</option>
                    <option value="EXPENSE">Expense</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Opening Balance (৳)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={accountForm.openingBalance || ""}
                    onChange={(e) =>
                      setAccountForm({ ...accountForm, openingBalance: Number(e.target.value) || 0 })
                    }
                    className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs font-mono focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Normal Balance
                  </label>
                  <select
                    value={accountForm.normalBalance}
                    onChange={(e) => setAccountForm({ ...accountForm, normalBalance: e.target.value as any })}
                    className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="DEBIT">Debit</option>
                    <option value="CREDIT">Credit</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCreateUploadOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded transition"
                >
                  {editingAccountId ? "Save Changes" : "Create Account"}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4 py-2">
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-blue-500 transition cursor-pointer bg-slate-50/50">
                <Upload className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-800">
                  Click or drag Excel / CSV file here to upload
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Supports .xlsx, .xls, and .csv files formatted according to standard COA structure
                </p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-medium"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Sample COA Excel Template</span>
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateUploadOpen(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      alert("Sample template loaded with demo data.");
                      setIsCreateUploadOpen(false);
                    }}
                    className="px-4 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded transition"
                  >
                    Import File
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </ModalDialog>

      {/* ------------------------------------------------------------- */}
      {/* 7. CREATE COA PERMISSION MODAL */}
      {/* ------------------------------------------------------------- */}
      <ModalDialog
        isOpen={isPermModalOpen}
        onClose={() => setIsPermModalOpen(false)}
        title="Assign Account Head Access Permission"
        maxWidth="md"
      >
        <form onSubmit={handleSavePermission} className="space-y-3 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Employee Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Mohammad Arif"
              value={permForm.employeeName}
              onChange={(e) => setPermForm({ ...permForm, employeeName: e.target.value })}
              className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Employee ID
              </label>
              <input
                type="text"
                placeholder="e.g. EMP-101"
                value={permForm.employeeId}
                onChange={(e) => setPermForm({ ...permForm, employeeId: e.target.value })}
                className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Voucher Type *
              </label>
              <select
                value={permForm.voucherType}
                onChange={(e) => setPermForm({ ...permForm, voucherType: e.target.value })}
                className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
              >
                <option value="Payment">Payment</option>
                <option value="Receipt">Receipt</option>
                <option value="General">General</option>
                <option value="Contra">Contra</option>
                <option value="Adjustment">Adjustment</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Account Head *
            </label>
            <select
              value={permForm.accountHeadCode}
              onChange={(e) => setPermForm({ ...permForm, accountHeadCode: e.target.value })}
              className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.code}>
                  {acc.code} - {acc.name} ({acc.tierLevel || acc.accountSubtype})
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsPermModalOpen(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs rounded transition"
            >
              Assign Permission
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
