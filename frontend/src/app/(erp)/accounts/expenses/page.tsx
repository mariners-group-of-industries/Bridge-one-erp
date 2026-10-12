"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  DollarSign,
  Download,
  FileText,
  Filter,
  Plus,
  Printer,
  Search,
  UserCheck,
  Wallet,
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
import type { AdvanceRecord, ExpenseRecord, PaymentMethod, ProvisionRecord } from "@/features/accounts/types";

export default function ExpenseAdvancePage() {
  const [activeTab, setActiveTab] = useState<"expense" | "advance" | "provision" | "paid">("expense");
  const [searchQuery, setSearchQuery] = useState("");

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
      const matchSearch =
        e.expenseNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.payeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.expenseType.toLowerCase().includes(searchQuery.toLowerCase());
      if (activeTab === "paid") return matchSearch && e.status === "PAID";
      if (activeTab === "expense") return matchSearch && e.status !== "PAID";
      return matchSearch;
    });
  }, [expenses, searchQuery, activeTab]);

  const filteredAdvances = useMemo(() => {
    return advances.filter(
      (a) =>
        a.advanceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.purpose.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [advances, searchQuery]);

  const filteredProvisions = useMemo(() => {
    return provisions.filter(
      (p) =>
        p.provisionNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [provisions, searchQuery]);

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.payeeName || expenseForm.amount <= 0) return;
    createExpense(expenseForm);
    setIsNewExpenseOpen(false);
  };

  const handleSaveAdvance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!advanceForm.employeeName || advanceForm.requestedAmount <= 0) return;
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

  return (
    <PageContainer>
      <PageHead
        title="Expense / Advance Management"
        subtitle="Manage business operational claims, employee advances, accrued provisions, and disbursements"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              <Printer className="mr-1.5 size-3.5" /> Print Summary
            </Button>
            {activeTab === "expense" && (
              <Button variant="primary" size="sm" onClick={() => setIsNewExpenseOpen(true)}>
                <Plus className="mr-1.5 size-3.5" /> New Expense Claim
              </Button>
            )}
            {activeTab === "advance" && (
              <Button variant="primary" size="sm" onClick={() => setIsNewAdvanceOpen(true)}>
                <Plus className="mr-1.5 size-3.5" /> Request Advance
              </Button>
            )}
            {activeTab === "provision" && (
              <Button variant="primary" size="sm" onClick={() => setIsNewProvisionOpen(true)}>
                <Plus className="mr-1.5 size-3.5" /> Record Accrual Provision
              </Button>
            )}
          </div>
        }
      />

      {/* Tabs Bar */}
      <Card className="mt-4 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex rounded-lg border border-line bg-surface p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab("expense")}
              className={`rounded-md px-3.5 py-1.5 transition ${activeTab === "expense" ? "bg-control font-semibold text-ink shadow-xs" : "text-ink-muted hover:text-ink"}`}
            >
              Expense Requests ({expenses.filter((e) => e.status !== "PAID").length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("advance")}
              className={`rounded-md px-3.5 py-1.5 transition ${activeTab === "advance" ? "bg-control font-semibold text-ink shadow-xs" : "text-ink-muted hover:text-ink"}`}
            >
              Employee Advance ({advances.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("provision")}
              className={`rounded-md px-3.5 py-1.5 transition ${activeTab === "provision" ? "bg-control font-semibold text-ink shadow-xs" : "text-ink-muted hover:text-ink"}`}
            >
              Provisions & Accruals ({provisions.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("paid")}
              className={`rounded-md px-3.5 py-1.5 transition ${activeTab === "paid" ? "bg-control font-semibold text-ink shadow-xs" : "text-ink-muted hover:text-ink"}`}
            >
              Paid Expenses ({expenses.filter((e) => e.status === "PAID").length})
            </button>
          </div>

          <div className="relative w-64">
            <Search className="absolute top-2.5 left-2.5 size-3.5 text-ink-faint" />
            <input
              type="text"
              placeholder="Search by code, payee, purpose..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface py-1.5 pr-3 pl-8 text-xs text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none"
            />
          </div>
        </div>
      </Card>

      {/* Tab 1 & Tab 4: Expense / Paid Table */}
      {(activeTab === "expense" || activeTab === "paid") && (
        <Card className="mt-4 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line bg-control/40 font-semibold text-ink">
                <tr>
                  <th className="px-4 py-2.5">Expense #</th>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Office</th>
                  <th className="px-4 py-2.5">Category</th>
                  <th className="px-4 py-2.5">Payee / Beneficiary</th>
                  <th className="px-4 py-2.5">Ledger Account</th>
                  <th className="px-4 py-2.5 text-right">Amount (৳)</th>
                  <th className="px-4 py-2.5 text-center">Status</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-ink-faint">
                      No expense records found. Click &quot;New Expense Claim&quot; to submit a claim.
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((e) => (
                    <tr key={e.id} className="hover:bg-control/30">
                      <td className="px-4 py-2.5 font-mono font-semibold text-ink">{e.expenseNumber}</td>
                      <td className="px-4 py-2.5 text-ink-muted">{e.date}</td>
                      <td className="px-4 py-2.5 text-ink-muted">{e.officeName}</td>
                      <td className="px-4 py-2.5 font-medium text-ink">{e.expenseType}</td>
                      <td className="px-4 py-2.5 text-ink">{e.payeeName}</td>
                      <td className="px-4 py-2.5 text-ink-muted">{e.accountName}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-ink">৳{e.amount.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-center">
                        <Badge
                          variant={
                            e.status === "PAID"
                              ? "success"
                              : e.status === "APPROVED"
                              ? "primary"
                              : e.status === "REJECTED"
                              ? "danger"
                              : "warning"
                          }
                        >
                          {e.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {e.status === "PENDING" && (
                            <>
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => updateExpenseStatus(e.id, "APPROVED", "Manager")}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-rose-600"
                                onClick={() => updateExpenseStatus(e.id, "REJECTED")}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                          {e.status === "APPROVED" && (
                            <Button size="sm" variant="primary" onClick={() => markExpensePaid(e.id, "BANK")}>
                              Disburse & Post
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 2: Advance Management */}
      {activeTab === "advance" && (
        <Card className="mt-4 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line bg-control/40 font-semibold text-ink">
                <tr>
                  <th className="px-4 py-2.5">Advance #</th>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Employee Name</th>
                  <th className="px-4 py-2.5">Office</th>
                  <th className="px-4 py-2.5">Purpose</th>
                  <th className="px-4 py-2.5 text-right">Requested (৳)</th>
                  <th className="px-4 py-2.5 text-right">Disbursed (৳)</th>
                  <th className="px-4 py-2.5 text-right">Settled (৳)</th>
                  <th className="px-4 py-2.5 text-right">Remaining (৳)</th>
                  <th className="px-4 py-2.5 text-center">Status</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredAdvances.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-ink-faint">
                      No employee advances found. Click &quot;Request Advance&quot; to initiate a request.
                    </td>
                  </tr>
                ) : (
                  filteredAdvances.map((a) => (
                    <tr key={a.id} className="hover:bg-control/30">
                      <td className="px-4 py-2.5 font-mono font-semibold text-ink">{a.advanceNumber}</td>
                      <td className="px-4 py-2.5 text-ink-muted">{a.date}</td>
                      <td className="px-4 py-2.5 font-medium text-ink">{a.employeeName}</td>
                      <td className="px-4 py-2.5 text-ink-muted">{a.officeName}</td>
                      <td className="max-w-xs truncate px-4 py-2.5 text-ink">{a.purpose}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-ink">৳{a.requestedAmount.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-blue-600">৳{a.disbursedAmount.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-emerald-600">৳{a.settledAmount.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-amber-600">৳{a.remainingBalance.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-center">
                        <Badge
                          variant={
                            a.status === "SETTLED"
                              ? "success"
                              : a.status === "DISBURSED"
                              ? "primary"
                              : "warning"
                          }
                        >
                          {a.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {a.status === "PENDING" && (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => disburseAdvance(a.id, a.requestedAmount)}
                            >
                              Approve & Disburse
                            </Button>
                          )}
                          {(a.status === "DISBURSED" || a.status === "PARTIAL") && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setSettlementTarget(a);
                                setSettleAmount(a.remainingBalance);
                              }}
                            >
                              Adjust Expense
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 3: Provision Management */}
      {activeTab === "provision" && (
        <Card className="mt-4 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line bg-control/40 font-semibold text-ink">
                <tr>
                  <th className="px-4 py-2.5">Provision #</th>
                  <th className="px-4 py-2.5">Office</th>
                  <th className="px-4 py-2.5">Account</th>
                  <th className="px-4 py-2.5">Effective Period</th>
                  <th className="px-4 py-2.5">Description</th>
                  <th className="px-4 py-2.5 text-right">Amount (৳)</th>
                  <th className="px-4 py-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredProvisions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-ink-faint">
                      No accrual provisions recorded. Click &quot;Record Accrual Provision&quot; to log accrued liabilities.
                    </td>
                  </tr>
                ) : (
                  filteredProvisions.map((p) => (
                    <tr key={p.id} className="hover:bg-control/30">
                      <td className="px-4 py-2.5 font-mono font-semibold text-ink">{p.provisionNumber}</td>
                      <td className="px-4 py-2.5 text-ink-muted">{p.officeName}</td>
                      <td className="px-4 py-2.5 font-medium text-ink">{p.accountName}</td>
                      <td className="px-4 py-2.5 text-ink-muted">{p.effectivePeriod}</td>
                      <td className="px-4 py-2.5 text-ink">{p.description}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-ink">৳{p.amount.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-center">
                        <Badge variant="success">{p.status}</Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Dialog: Create Expense */}
      <Dialog open={isNewExpenseOpen} onOpenChange={setIsNewExpenseOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Expense Claim</DialogTitle>
            <DialogDescription>Submit an operational expenditure claim with budget account mapping.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveExpense} className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-medium text-ink">Expense Category *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Travel & Transport"
                  value={expenseForm.expenseType}
                  onChange={(e) => setExpenseForm({ ...expenseForm, expenseType: e.target.value })}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-ink">Date *</label>
                <input
                  type="date"
                  required
                  value={expenseForm.date}
                  onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block font-medium text-ink">Ledger Account (GL) *</label>
              <select
                value={expenseForm.accountId}
                onChange={(e) => {
                  const acc = accounts.find((a) => a.id === e.target.value);
                  setExpenseForm({
                    ...expenseForm,
                    accountId: e.target.value,
                    accountName: acc?.name || "Expense Account",
                  });
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
                <label className="mb-1 block font-medium text-ink">Payee / Vendor Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Payee or Employee name"
                  value={expenseForm.payeeName}
                  onChange={(e) => setExpenseForm({ ...expenseForm, payeeName: e.target.value })}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-ink">Amount (৳) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={expenseForm.amount || ""}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: Number(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block font-medium text-ink">Description / Justification</label>
              <textarea
                rows={2}
                placeholder="Business justification and bill breakdown..."
                value={expenseForm.description}
                onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsNewExpenseOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Submit Claim
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: New Advance */}
      <Dialog open={isNewAdvanceOpen} onOpenChange={setIsNewAdvanceOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Employee Advance</DialogTitle>
            <DialogDescription>Submit advance demand for operational, travel, or procurement tasks.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveAdvance} className="space-y-3 py-2 text-xs">
            <div>
              <label className="mb-1 block font-medium text-ink">Employee Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Tariqul Islam"
                value={advanceForm.employeeName}
                onChange={(e) => setAdvanceForm({ ...advanceForm, employeeName: e.target.value })}
                className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-medium text-ink">Requested Amount (৳) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={advanceForm.requestedAmount || ""}
                  onChange={(e) =>
                    setAdvanceForm({
                      ...advanceForm,
                      requestedAmount: Number(e.target.value) || 0,
                      approvedAmount: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-ink">Demand Date</label>
                <input
                  type="date"
                  required
                  value={advanceForm.date}
                  onChange={(e) => setAdvanceForm({ ...advanceForm, date: e.target.value })}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block font-medium text-ink">Purpose & Scope *</label>
              <textarea
                required
                rows={2}
                placeholder="e.g. Field visit to Chittagong branch and vendor site survey"
                value={advanceForm.purpose}
                onChange={(e) => setAdvanceForm({ ...advanceForm, purpose: e.target.value })}
                className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsNewAdvanceOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Submit Request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Settle Advance */}
      <Dialog open={!!settlementTarget} onOpenChange={(open) => !open && setSettlementTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Settle Advance Adjustment</DialogTitle>
            <DialogDescription>
              Record expense settlement against outstanding advance of {settlementTarget?.employeeName}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="rounded-lg bg-control p-2.5">
              <div className="flex justify-between">
                <span className="text-ink-muted">Total Disbursed:</span>
                <span className="font-semibold text-ink">৳{settlementTarget?.disbursedAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-ink-muted">Remaining Balance:</span>
                <span className="font-bold text-amber-600">৳{settlementTarget?.remainingBalance.toLocaleString()}</span>
              </div>
            </div>

            <div>
              <label className="mb-1 block font-medium text-ink">Settlement / Expense Amount (৳) *</label>
              <input
                type="number"
                min="1"
                max={settlementTarget?.remainingBalance || 0}
                value={settleAmount || ""}
                onChange={(e) => setSettleAmount(Number(e.target.value) || 0)}
                className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setSettlementTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (settlementTarget && settleAmount > 0) {
                  settleAdvance(settlementTarget.id, settleAmount);
                  setSettlementTarget(null);
                }
              }}
            >
              Confirm Settlement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: New Provision */}
      <Dialog open={isNewProvisionOpen} onOpenChange={setIsNewProvisionOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Accrual Provision</DialogTitle>
            <DialogDescription>Record accrued expenses or liabilities for an accounting period.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveProvision} className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-medium text-ink">Effective Period *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. October 2026"
                  value={provisionForm.effectivePeriod}
                  onChange={(e) => setProvisionForm({ ...provisionForm, effectivePeriod: e.target.value })}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-ink">Provision Amount (৳) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={provisionForm.amount || ""}
                  onChange={(e) => setProvisionForm({ ...provisionForm, amount: Number(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block font-medium text-ink">Accrual Description *</label>
              <textarea
                required
                rows={2}
                placeholder="e.g. Provision for year-end audit fees and unpaid utility charges"
                value={provisionForm.description}
                onChange={(e) => setProvisionForm({ ...provisionForm, description: e.target.value })}
                className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsNewProvisionOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Post Provision
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
