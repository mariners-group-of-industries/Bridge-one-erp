"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Calculator,
  CheckCircle2,
  Download,
  Filter,
  PieChart,
  Plus,
  Printer,
  Search,
  TrendingUp,
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
import type { BudgetItem } from "@/features/accounts/types";

export default function BudgetManagementPage() {
  const budgets = useAccountingStore((s) => s.budgets);
  const accounts = useAccountingStore((s) => s.accounts);
  const costCenters = useAccountingStore((s) => s.costCenters);
  const createBudget = useAccountingStore((s) => s.createBudget);
  const updateBudgetRevision = useAccountingStore((s) => s.updateBudgetRevision);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");

  const [isNewOpen, setIsNewOpen] = useState(false);
  const [revisionTarget, setRevisionTarget] = useState<BudgetItem | null>(null);
  const [newRevisionAmount, setNewRevisionAmount] = useState<number>(0);

  const [form, setForm] = useState({
    budgetName: "",
    budgetYear: "2026-2027",
    financialPeriod: "Full Fiscal Year",
    officeId: "office-main",
    officeName: "Dhaka Corporate HQ",
    costCenterId: "cc-1",
    costCenterName: "Dhaka Head Office",
    budgetType: "OPERATING" as BudgetItem["budgetType"],
    accountId: "acc-5100",
    accountName: "Office Rent & Utilities",
    allocatedAmount: 600000,
    approvalStatus: "APPROVED" as const,
    createdBy: "Finance Controller",
  });

  const filteredBudgets = useMemo(() => {
    return budgets.filter((b) => {
      const matchSearch =
        b.budgetCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.budgetName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.accountName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.costCenterName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchType = filterType === "ALL" ? true : b.budgetType === filterType;
      return matchSearch && matchType;
    });
  }, [budgets, searchQuery, filterType]);

  const handleSaveBudget = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.budgetName.trim() || form.allocatedAmount <= 0) return;
    createBudget(form);
    setIsNewOpen(false);
  };

  const handleSaveRevision = () => {
    if (!revisionTarget || newRevisionAmount <= 0) return;
    updateBudgetRevision(revisionTarget.id, newRevisionAmount);
    setRevisionTarget(null);
  };

  return (
    <PageContainer>
      <PageHead
        title="Budget Management"
        subtitle="Department and project budget allocations, revision tracking, commitments, and actual utilization"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              <Printer className="mr-1.5 size-3.5" /> Print Summary
            </Button>
            <Button variant="primary" size="sm" onClick={() => setIsNewOpen(true)}>
              <Plus className="mr-1.5 size-3.5" /> Allocate Budget
            </Button>
          </div>
        }
      />

      {/* Filter Bar */}
      <Card className="mt-4 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-1 items-center gap-2">
            <div className="relative w-full max-w-sm">
              <Search className="absolute top-2.5 left-2.5 size-3.5 text-ink-faint" />
              <input
                type="text"
                placeholder="Search budget code, name, cost center..."
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
              <option value="ALL">All Budget Types</option>
              <option value="OPERATING">Operating (OpEx)</option>
              <option value="CAPITAL">Capital (CapEx)</option>
              <option value="DEPARTMENT">Departmental</option>
              <option value="PROJECT">Project Specific</option>
            </select>
          </div>

          <div className="flex items-center gap-4 text-xs text-ink-muted">
            <span>
              Total Allocated:{" "}
              <strong className="text-ink">
                ৳{budgets.reduce((sum, b) => sum + b.allocatedAmount, 0).toLocaleString()}
              </strong>
            </span>
            <span>
              Total Utilized:{" "}
              <strong className="text-amber-600">
                ৳{budgets.reduce((sum, b) => sum + b.utilizedAmount, 0).toLocaleString()}
              </strong>
            </span>
            <span>
              Total Remaining:{" "}
              <strong className="text-emerald-600">
                ৳{budgets.reduce((sum, b) => sum + b.remainingAmount, 0).toLocaleString()}
              </strong>
            </span>
          </div>
        </div>
      </Card>

      {/* Budgets Table */}
      <Card className="mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-line bg-control/40 font-semibold text-ink">
              <tr>
                <th className="px-4 py-2.5">Budget Code</th>
                <th className="px-4 py-2.5">Budget Title</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">Cost Center</th>
                <th className="px-4 py-2.5">General Ledger Account</th>
                <th className="px-4 py-2.5 text-right">Allocated (৳)</th>
                <th className="px-4 py-2.5 text-right">Revised (৳)</th>
                <th className="px-4 py-2.5 text-right">Utilized (৳)</th>
                <th className="px-4 py-2.5 text-right">Remaining (৳)</th>
                <th className="px-4 py-2.5 text-center">Status</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredBudgets.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-ink-faint">
                    No budget allocations registered. Click &quot;Allocate Budget&quot; to define spending caps.
                  </td>
                </tr>
              ) : (
                filteredBudgets.map((b) => (
                  <tr key={b.id} className="hover:bg-control/30">
                    <td className="px-4 py-2.5 font-mono font-semibold text-ink">{b.budgetCode}</td>
                    <td className="px-4 py-2.5 font-medium text-ink">{b.budgetName}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant="neutral">{b.budgetType}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-ink-muted">{b.costCenterName}</td>
                    <td className="px-4 py-2.5 text-ink-muted">{b.accountName}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-ink">৳{b.allocatedAmount.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-blue-600">
                      ৳{(b.revisedAmount || b.allocatedAmount).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-amber-600">
                      ৳{b.utilizedAmount.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-emerald-600">
                      ৳{b.remainingAmount.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <Badge variant={b.approvalStatus === "APPROVED" ? "success" : "warning"}>
                        {b.approvalStatus}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setRevisionTarget(b);
                          setNewRevisionAmount(b.revisedAmount || b.allocatedAmount);
                        }}
                      >
                        Revise
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Allocate Budget Modal */}
      <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Budget Allocation</DialogTitle>
            <DialogDescription>
              Assign a controlled expenditure cap to a cost center and general ledger account.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveBudget} className="space-y-3 py-2 text-xs">
            <div>
              <label className="mb-1 block font-medium text-ink">Budget Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. FY 2026-27 Factory Electricity & Utility Cap"
                value={form.budgetName}
                onChange={(e) => setForm({ ...form, budgetName: e.target.value })}
                className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-medium text-ink">Budget Type</label>
                <select
                  value={form.budgetType}
                  onChange={(e) => setForm({ ...form, budgetType: e.target.value as BudgetItem["budgetType"] })}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
                >
                  <option value="OPERATING">Operating (OpEx)</option>
                  <option value="CAPITAL">Capital (CapEx)</option>
                  <option value="DEPARTMENT">Departmental</option>
                  <option value="PROJECT">Project Specific</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block font-medium text-ink">Cost Center *</label>
                <select
                  value={form.costCenterId}
                  onChange={(e) => {
                    const c = costCenters.find((cc) => cc.id === e.target.value);
                    setForm({ ...form, costCenterId: e.target.value, costCenterName: c?.name || "Center" });
                  }}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
                >
                  {costCenters.map((cc) => (
                    <option key={cc.id} value={cc.id}>
                      {cc.code} - {cc.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block font-medium text-ink">General Ledger Account *</label>
              <select
                value={form.accountId}
                onChange={(e) => {
                  const acc = accounts.find((a) => a.id === e.target.value);
                  setForm({ ...form, accountId: e.target.value, accountName: acc?.name || "Account" });
                }}
                className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
              >
                {accounts
                  .filter((a) => a.accountType === "EXPENSE" && !a.isGroup)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} - {a.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-medium text-ink">Allocated Amount (৳) *</label>
                <input
                  type="number"
                  required
                  min="1000"
                  value={form.allocatedAmount || ""}
                  onChange={(e) => setForm({ ...form, allocatedAmount: Number(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-ink">Financial Year</label>
                <input
                  type="text"
                  value={form.budgetYear}
                  onChange={(e) => setForm({ ...form, budgetYear: e.target.value })}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsNewOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Confirm Allocation
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Revise Budget Modal */}
      <Dialog open={!!revisionTarget} onOpenChange={(open) => !open && setRevisionTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Revise Budget Cap</DialogTitle>
            <DialogDescription>
              Reallocate or adjust the approved budget for {revisionTarget?.budgetName}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="rounded-lg bg-control p-2.5">
              <div className="flex justify-between">
                <span className="text-ink-muted">Original Allocation:</span>
                <span className="font-semibold text-ink">৳{revisionTarget?.allocatedAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-ink-muted">Currently Utilized:</span>
                <span className="font-semibold text-amber-600">৳{revisionTarget?.utilizedAmount.toLocaleString()}</span>
              </div>
            </div>

            <div>
              <label className="mb-1 block font-medium text-ink">Revised Budget Amount (৳) *</label>
              <input
                type="number"
                min={revisionTarget?.utilizedAmount || 0}
                value={newRevisionAmount || ""}
                onChange={(e) => setNewRevisionAmount(Number(e.target.value) || 0)}
                className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setRevisionTarget(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveRevision}>
              Save Revision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
