"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Folder,
  FolderOpen,
  Layers,
  List,
  Plus,
  Printer,
  Search,
  Tag,
} from "lucide-react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAccountingStore } from "@/features/accounts/store/accounting-store";
import type { AccountItem, AccountType, NormalBalance } from "@/features/accounts/types";

export default function ChartOfAccountsPage() {
  const accounts = useAccountingStore((s) => s.accounts);
  const addAccount = useAccountingStore((s) => s.addAccount);
  const updateAccount = useAccountingStore((s) => s.updateAccount);
  const toggleAccountStatus = useAccountingStore((s) => s.toggleAccountStatus);

  const [viewMode, setViewMode] = useState<"tree" | "table">("tree");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    "1000": true,
    "1100": true,
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
      const matchesSearch =
        acc.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        acc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        acc.accountSubtype.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === "ALL" || acc.accountType === filterType;
      return matchesSearch && matchesType;
    });
  }, [accounts, searchQuery, filterType]);

  // Hierarchical tree building
  const rootAccounts = useMemo(() => {
    return accounts.filter((a) => !a.parentCode);
  }, [accounts]);

  const getChildAccounts = (parentCode: string) => {
    return accounts.filter((a) => a.parentCode === parentCode);
  };

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
        accountSubtype: parentAccount.accountSubtype === "Group" ? "Ledger Account" : parentAccount.accountSubtype,
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

  const handleOpenEdit = (acc: AccountItem) => {
    setErrorMessage("");
    setEditingAccount(acc);
    setFormData({
      code: acc.code,
      name: acc.name,
      parentCode: acc.parentCode || "",
      accountType: acc.accountType,
      accountSubtype: acc.accountSubtype,
      normalBalance: acc.normalBalance,
      description: acc.description || "",
      openingBalance: acc.openingBalance,
      currency: acc.currency,
      isGroup: acc.isGroup,
      status: acc.status,
    });
    setIsCreateOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code.trim() || !formData.name.trim()) {
      setErrorMessage("Account code and name are required.");
      return;
    }

    // Uniqueness validation
    if (!editingAccount) {
      const exists = accounts.some((a) => a.code === formData.code.trim());
      if (exists) {
        setErrorMessage(`Account code "${formData.code}" is already in use.`);
        return;
      }
      addAccount({
        code: formData.code.trim(),
        name: formData.name.trim(),
        parentCode: formData.parentCode || null,
        accountType: formData.accountType,
        accountSubtype: formData.accountSubtype,
        normalBalance: formData.normalBalance,
        description: formData.description,
        openingBalance: Number(formData.openingBalance) || 0,
        currency: formData.currency,
        isGroup: formData.isGroup,
        status: formData.status,
      });
    } else {
      // Check circular reference
      if (formData.parentCode === editingAccount.code) {
        setErrorMessage("An account cannot be its own parent.");
        return;
      }
      updateAccount(editingAccount.id, {
        code: formData.code.trim(),
        name: formData.name.trim(),
        parentCode: formData.parentCode || null,
        accountType: formData.accountType,
        accountSubtype: formData.accountSubtype,
        normalBalance: formData.normalBalance,
        description: formData.description,
        isGroup: formData.isGroup,
        status: formData.status,
      });
    }

    setIsCreateOpen(false);
  };

  const exportExcel = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      ["Code,Name,Parent Code,Type,Subtype,Normal Balance,Balance,Status"]
        .concat(
          accounts.map(
            (a) =>
              `"${a.code}","${a.name}","${a.parentCode || ""}","${a.accountType}","${a.accountSubtype}","${a.normalBalance}",${a.currentBalance},"${a.status}"`,
          ),
        )
        .join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `chart_of_accounts_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <PageContainer>
      <PageHead
        title="Chart of Accounts (COA)"
        subtitle="Manage hierarchical general ledger accounts, groups, normal balances, and financial classifications"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-line bg-surface p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("tree")}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  viewMode === "tree" ? "bg-control font-semibold text-ink shadow-xs" : "text-ink-muted hover:text-ink"
                }`}
              >
                <Layers className="size-3.5" /> Tree View
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  viewMode === "table" ? "bg-control font-semibold text-ink shadow-xs" : "text-ink-muted hover:text-ink"
                }`}
              >
                <List className="size-3.5" /> Table View
              </button>
            </div>

            <Button variant="secondary" size="sm" onClick={exportExcel}>
              <Download className="mr-1.5 size-3.5" /> Export Excel
            </Button>
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              <Printer className="mr-1.5 size-3.5" /> Print PDF
            </Button>
            <Button variant="primary" size="sm" onClick={() => handleOpenCreate()}>
              <Plus className="mr-1.5 size-3.5" /> New Account
            </Button>
          </div>
        }
      />

      {/* Filter and Search Bar */}
      <Card className="mt-4 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-1 items-center gap-2">
            <div className="relative w-full max-w-sm">
              <Search className="absolute top-2.5 left-2.5 size-3.5 text-ink-faint" />
              <input
                type="text"
                placeholder="Search account code, title, or subtype..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface py-1.5 pr-3 pl-8 text-xs text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-ink outline-none focus:border-primary"
            >
              <option value="ALL">All Account Classes</option>
              <option value="ASSET">1000 - Assets</option>
              <option value="LIABILITY">2000 - Liabilities</option>
              <option value="EQUITY">3000 - Equity</option>
              <option value="REVENUE">4000 - Revenue</option>
              <option value="EXPENSE">5000 - Expenses</option>
            </select>
          </div>

          <div className="flex items-center gap-3 text-xs text-ink-muted">
            <span>
              Total Accounts: <strong className="text-ink">{accounts.length}</strong>
            </span>
            <span>
              Active Ledgers: <strong className="text-emerald-600">{accounts.filter((a) => !a.isGroup && a.status === "ACTIVE").length}</strong>
            </span>
          </div>
        </div>
      </Card>

      {/* Content Rendering: Tree View vs Table View */}
      {viewMode === "tree" ? (
        <Card className="mt-4 p-4">
          <div className="space-y-1 divide-y divide-line/60">
            {rootAccounts
              .filter((root) => filterType === "ALL" || root.accountType === filterType)
              .map((root) => (
                <TreeNode
                  key={root.id}
                  account={root}
                  allAccounts={accounts}
                  expandedNodes={expandedNodes}
                  onToggle={toggleNode}
                  onAddChild={handleOpenCreate}
                  onEdit={handleOpenEdit}
                  onToggleStatus={toggleAccountStatus}
                />
              ))}
          </div>
        </Card>
      ) : (
        <Card className="mt-4 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line bg-control/40 font-semibold text-ink">
                <tr>
                  <th className="px-4 py-2.5">Code</th>
                  <th className="px-4 py-2.5">Account Title</th>
                  <th className="px-4 py-2.5">Class</th>
                  <th className="px-4 py-2.5">Subtype</th>
                  <th className="px-4 py-2.5">Normal Balance</th>
                  <th className="px-4 py-2.5 text-right">Current Balance</th>
                  <th className="px-4 py-2.5 text-center">Status</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredAccounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-control/30">
                    <td className="px-4 py-2.5 font-mono font-medium text-ink">{acc.code}</td>
                    <td className="px-4 py-2.5 font-medium text-ink">
                      {acc.isGroup ? (
                        <span className="flex items-center gap-1.5 font-semibold text-primary">
                          <Folder className="size-3.5" /> {acc.name}
                        </span>
                      ) : (
                        acc.name
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant="neutral">{acc.accountType}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-ink-muted">{acc.accountSubtype}</td>
                    <td className="px-4 py-2.5">
                      <span className={acc.normalBalance === "DEBIT" ? "text-blue-600 font-medium" : "text-amber-600 font-medium"}>
                        {acc.normalBalance}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-ink">
                      {acc.isGroup ? "—" : `৳${acc.currentBalance.toLocaleString()}`}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <Badge variant={acc.status === "ACTIVE" ? "success" : "neutral"}>{acc.status}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {acc.isGroup && (
                          <Button size="sm" variant="ghost" onClick={() => handleOpenCreate(acc)}>
                            <Plus className="size-3" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => handleOpenEdit(acc)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleAccountStatus(acc.id)}
                          className={acc.status === "ACTIVE" ? "text-amber-600" : "text-emerald-600"}
                        >
                          {acc.status === "ACTIVE" ? "Deactivate" : "Activate"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingAccount ? "Edit Account" : "Create Chart of Account Node"}</DialogTitle>
            <DialogDescription>
              Configure general ledger account properties, classification, normal balance, and parent linkage.
            </DialogDescription>
          </DialogHeader>

          {errorMessage && (
            <div className="rounded-lg bg-rose-50 p-2 text-xs font-medium text-rose-600 dark:bg-rose-950/40">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-medium text-ink">Account Code *</label>
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="e.g. 5210"
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-ink">Parent Account Code</label>
                <select
                  value={formData.parentCode}
                  onChange={(e) => setFormData({ ...formData, parentCode: e.target.value })}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
                >
                  <option value="">(None - Top Level)</option>
                  {accounts
                    .filter((a) => a.isGroup)
                    .map((a) => (
                      <option key={a.id} value={a.code}>
                        {a.code} - {a.name} ({a.accountType})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block font-medium text-ink">Account Title *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Office Rent & Maintenance"
                className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-medium text-ink">Account Class *</label>
                <select
                  value={formData.accountType}
                  onChange={(e) => setFormData({ ...formData, accountType: e.target.value as AccountType })}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
                >
                  <option value="ASSET">Asset (1000)</option>
                  <option value="LIABILITY">Liability (2000)</option>
                  <option value="EQUITY">Equity (3000)</option>
                  <option value="REVENUE">Revenue (4000)</option>
                  <option value="EXPENSE">Expense (5000)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block font-medium text-ink">Normal Balance *</label>
                <select
                  value={formData.normalBalance}
                  onChange={(e) => setFormData({ ...formData, normalBalance: e.target.value as NormalBalance })}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
                >
                  <option value="DEBIT">Debit (Dr)</option>
                  <option value="CREDIT">Credit (Cr)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-medium text-ink">Subtype / Category</label>
                <input
                  type="text"
                  value={formData.accountSubtype}
                  onChange={(e) => setFormData({ ...formData, accountSubtype: e.target.value })}
                  placeholder="e.g. Operating Expense"
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-ink">Opening Balance (৳)</label>
                <input
                  type="number"
                  disabled={!!editingAccount}
                  value={formData.openingBalance}
                  onChange={(e) => setFormData({ ...formData, openingBalance: Number(e.target.value) })}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary disabled:opacity-50"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="isGroup"
                checked={formData.isGroup}
                onChange={(e) => setFormData({ ...formData, isGroup: e.target.checked })}
                className="size-4 rounded border-line text-primary"
              />
              <label htmlFor="isGroup" className="text-xs font-medium text-ink">
                Is Group Account (Parent only, directly non-postable)
              </label>
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                {editingAccount ? "Update Account" : "Create Account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

function TreeNode({
  account,
  allAccounts,
  expandedNodes,
  onToggle,
  onAddChild,
  onEdit,
  onToggleStatus,
  level = 0,
}: {
  account: AccountItem;
  allAccounts: AccountItem[];
  expandedNodes: Record<string, boolean>;
  onToggle: (code: string) => void;
  onAddChild: (parent: AccountItem) => void;
  onEdit: (account: AccountItem) => void;
  onToggleStatus: (id: string) => void;
  level?: number;
}) {
  const children = allAccounts.filter((a) => a.parentCode === account.code);
  const hasChildren = children.length > 0;
  const isExpanded = !!expandedNodes[account.code];

  return (
    <div className="text-xs">
      <div
        className="group flex items-center justify-between rounded-lg py-1.5 pr-2 transition hover:bg-control/50"
        style={{ paddingLeft: `${level * 20 + 8}px` }}
      >
        <div className="flex items-center gap-2">
          {hasChildren ? (
            <button
              type="button"
              onClick={() => onToggle(account.code)}
              className="text-ink-muted hover:text-ink focus:outline-none"
            >
              {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            </button>
          ) : (
            <span className="size-3.5" />
          )}

          {account.isGroup ? (
            isExpanded ? (
              <FolderOpen className="size-4 text-primary" />
            ) : (
              <Folder className="size-4 text-primary" />
            )
          ) : (
            <Tag className="size-3.5 text-ink-muted" />
          )}

          <span className="font-mono font-semibold text-ink">{account.code}</span>
          <span className={account.isGroup ? "font-semibold text-ink" : "text-ink"}>{account.name}</span>
          <Badge variant="neutral" className="text-[10px]">
            {account.accountSubtype}
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          <span className={account.normalBalance === "DEBIT" ? "text-blue-600 font-medium" : "text-amber-600 font-medium"}>
            {account.normalBalance}
          </span>
          <span className="w-24 text-right font-medium text-ink">
            {account.isGroup ? "—" : `৳${account.currentBalance.toLocaleString()}`}
          </span>
          <Badge variant={account.status === "ACTIVE" ? "success" : "neutral"} className="text-[10px]">
            {account.status}
          </Badge>

          <div className="opacity-0 transition group-hover:opacity-100 flex items-center gap-1">
            {account.isGroup && (
              <Button size="sm" variant="ghost" onClick={() => onAddChild(account)} title="Add Sub Account">
                <Plus className="size-3" />
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => onEdit(account)}>
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onToggleStatus(account.id)}
              className={account.status === "ACTIVE" ? "text-amber-600" : "text-emerald-600"}
            >
              {account.status === "ACTIVE" ? "Disable" : "Enable"}
            </Button>
          </div>
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div className="border-l border-line/60 ml-3">
          {children.map((child) => (
            <TreeNode
              key={child.id}
              account={child}
              allAccounts={allAccounts}
              expandedNodes={expandedNodes}
              onToggle={onToggle}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onToggleStatus={onToggleStatus}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
