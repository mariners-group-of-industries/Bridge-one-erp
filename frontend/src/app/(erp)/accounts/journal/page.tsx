"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileText,
  Filter,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Trash2,
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
import type { JournalLineItem, JournalType, JournalVoucher, VoucherStatus } from "@/features/accounts/types";

export default function AccountingJournalPage() {
  const vouchers = useAccountingStore((s) => s.vouchers);
  const accounts = useAccountingStore((s) => s.accounts);
  const costCenters = useAccountingStore((s) => s.costCenters);
  const createVoucher = useAccountingStore((s) => s.createVoucher);
  const postVoucher = useAccountingStore((s) => s.postVoucher);
  const reverseVoucher = useAccountingStore((s) => s.reverseVoucher);

  const [activeTab, setActiveTab] = useState<"ALL" | "PENDING" | "POSTED" | "REVERSED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // Reversal Modal State
  const [reversalTarget, setReversalTarget] = useState<JournalVoucher | null>(null);
  const [reversalReason, setReversalReason] = useState("");

  // View / Print Modal
  const [viewingVoucher, setViewingVoucher] = useState<JournalVoucher | null>(null);

  const [newVoucherHeader, setNewVoucherHeader] = useState({
    transactionDate: new Date().toISOString().split("T")[0],
    officeId: "office-main",
    officeName: "Dhaka Corporate HQ",
    fiscalYear: "2026-2027",
    journalType: "GENERAL" as JournalType,
    narration: "",
    referenceNumber: "",
    status: "POSTED" as VoucherStatus,
  });

  const [lines, setLines] = useState<JournalLineItem[]>([
    {
      id: "line-1",
      accountId: "acc-5100",
      accountCode: "5100",
      accountName: "Office Rent & Utilities",
      debit: 50000,
      credit: 0,
      narration: "Office rent for Current Month",
    },
    {
      id: "line-2",
      accountId: "acc-1120",
      accountCode: "1120",
      accountName: "Cash at Bank - Sonali Bank",
      debit: 0,
      credit: 50000,
      narration: "Cheque disbursement",
    },
  ]);

  const totalDebit = useMemo(() => lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0), [lines]);
  const totalCredit = useMemo(() => lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0), [lines]);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const filteredVouchers = useMemo(() => {
    return vouchers.filter((v) => {
      const matchesSearch =
        v.voucherNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.narration.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (v.referenceNumber && v.referenceNumber.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesType = filterType === "ALL" || v.journalType === filterType;
      const matchesTab =
        activeTab === "ALL"
          ? true
          : activeTab === "PENDING"
          ? v.status === "PENDING" || v.status === "DRAFT"
          : v.status === activeTab;
      return matchesSearch && matchesType && matchesTab;
    });
  }, [vouchers, searchQuery, filterType, activeTab]);

  const handleAddLine = () => {
    const postable = accounts.filter((a) => !a.isGroup);
    const firstAcc = postable[0] || accounts[0];
    setLines([
      ...lines,
      {
        id: `line-${Date.now()}-${Math.random()}`,
        accountId: firstAcc.id,
        accountCode: firstAcc.code,
        accountName: firstAcc.name,
        debit: 0,
        credit: 0,
        narration: "",
      },
    ]);
  };

  const handleRemoveLine = (id: string) => {
    if (lines.length <= 2) {
      setFormError("A double-entry voucher requires at least two lines.");
      return;
    }
    setLines(lines.filter((l) => l.id !== id));
  };

  const handleLineChange = (id: string, updates: Partial<JournalLineItem>) => {
    setLines(
      lines.map((l) => {
        if (l.id !== id) return l;
        if (updates.accountId) {
          const selected = accounts.find((a) => a.id === updates.accountId);
          if (selected) {
            return {
              ...l,
              ...updates,
              accountCode: selected.code,
              accountName: selected.name,
            };
          }
        }
        return { ...l, ...updates };
      }),
    );
  };

  const handleSubmitVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!isBalanced) {
      setFormError(`Cannot save: Total Debit (৳${totalDebit.toLocaleString()}) must equal Total Credit (৳${totalCredit.toLocaleString()}).`);
      return;
    }

    const res = createVoucher({
      ...newVoucherHeader,
      lines,
      createdBy: "Finance Officer",
    });

    if (!res.success) {
      setFormError(res.message);
      return;
    }

    setFormSuccess(res.message);
    setTimeout(() => {
      setIsCreateOpen(false);
      setFormSuccess("");
    }, 1000);
  };

  const handleConfirmReversal = () => {
    if (!reversalTarget) return;
    if (!reversalReason.trim()) {
      alert("Please provide a reason for reversal.");
      return;
    }
    const res = reverseVoucher(reversalTarget.id, reversalReason.trim());
    if (res.success) {
      setReversalTarget(null);
      setReversalReason("");
    } else {
      alert(res.message);
    }
  };

  return (
    <PageContainer>
      <PageHead
        title="Accounting Journal"
        subtitle="Double-entry journal vouchers, multi-line ledger postings, and audit trails"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              <Printer className="mr-1.5 size-3.5" /> Print Register
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setFormError("");
                setFormSuccess("");
                setIsCreateOpen(true);
              }}
            >
              <Plus className="mr-1.5 size-3.5" /> New Journal Voucher
            </Button>
          </div>
        }
      />

      {/* Tabs & Search */}
      <Card className="mt-4 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex rounded-lg border border-line bg-surface p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab("ALL")}
              className={`rounded-md px-3 py-1 transition ${activeTab === "ALL" ? "bg-control font-semibold text-ink shadow-xs" : "text-ink-muted hover:text-ink"}`}
            >
              All Vouchers ({vouchers.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("POSTED")}
              className={`rounded-md px-3 py-1 transition ${activeTab === "POSTED" ? "bg-control font-semibold text-ink shadow-xs" : "text-ink-muted hover:text-ink"}`}
            >
              Posted ({vouchers.filter((v) => v.status === "POSTED").length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("PENDING")}
              className={`rounded-md px-3 py-1 transition ${activeTab === "PENDING" ? "bg-control font-semibold text-ink shadow-xs" : "text-ink-muted hover:text-ink"}`}
            >
              Pending / Draft ({vouchers.filter((v) => v.status === "PENDING" || v.status === "DRAFT").length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("REVERSED")}
              className={`rounded-md px-3 py-1 transition ${activeTab === "REVERSED" ? "bg-control font-semibold text-ink shadow-xs" : "text-ink-muted hover:text-ink"}`}
            >
              Reversals ({vouchers.filter((v) => v.status === "REVERSED").length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute top-2.5 left-2.5 size-3.5 text-ink-faint" />
              <input
                type="text"
                placeholder="Search voucher #, narration..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface py-1.5 pr-3 pl-8 text-xs text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none"
              />
            </div>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-primary"
            >
              <option value="ALL">All Types</option>
              <option value="GENERAL">General Journal</option>
              <option value="PAYMENT">Payment Voucher</option>
              <option value="RECEIPT">Receipt Voucher</option>
              <option value="CONTRA">Contra / Transfer</option>
              <option value="ADJUSTMENT">Adjustment</option>
              <option value="REVERSAL">Reversal</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Vouchers Table */}
      <Card className="mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-line bg-control/40 font-semibold text-ink">
              <tr>
                <th className="px-4 py-2.5">Voucher #</th>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">Office</th>
                <th className="px-4 py-2.5">Narration / Accounts</th>
                <th className="px-4 py-2.5 text-right">Debit (৳)</th>
                <th className="px-4 py-2.5 text-right">Credit (৳)</th>
                <th className="px-4 py-2.5 text-center">Status</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredVouchers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-ink-faint">
                    No journal vouchers match the selected filter. Click &quot;New Journal Voucher&quot; to post a transaction.
                  </td>
                </tr>
              ) : (
                filteredVouchers.map((v) => (
                  <tr key={v.id} className="hover:bg-control/30">
                    <td className="px-4 py-2.5 font-mono font-semibold text-ink">{v.voucherNumber}</td>
                    <td className="px-4 py-2.5 text-ink-muted">{v.transactionDate}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant="neutral">{v.journalType}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-ink-muted">{v.officeName}</td>
                    <td className="max-w-xs truncate px-4 py-2.5 text-ink">
                      <div>
                        <span className="font-medium text-ink">{v.narration || "General Journal Entry"}</span>
                        <p className="text-[10px] text-ink-faint">
                          {v.lines.map((l) => `${l.accountCode} (${l.debit > 0 ? "Dr" : "Cr"})`).join(" • ")}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-ink">৳{v.totalDebit.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-ink">৳{v.totalCredit.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-center">
                      <Badge
                        variant={
                          v.status === "POSTED"
                            ? "success"
                            : v.status === "REVERSED"
                            ? "neutral"
                            : "warning"
                        }
                      >
                        {v.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => setViewingVoucher(v)} title="View Details">
                          <Eye className="size-3.5" />
                        </Button>
                        {v.status === "DRAFT" || v.status === "PENDING" ? (
                          <Button size="sm" variant="primary" onClick={() => postVoucher(v.id)}>
                            Post GL
                          </Button>
                        ) : null}
                        {v.status === "POSTED" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setReversalTarget(v);
                              setReversalReason("");
                            }}
                            className="text-rose-600 hover:text-rose-700"
                            title="Reverse Voucher"
                          >
                            <RotateCcw className="size-3.5" />
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

      {/* Create Journal Voucher Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>New Double-Entry Journal Voucher</DialogTitle>
            <DialogDescription>
              Post a balanced general ledger transaction across multiple debit and credit lines.
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-2 text-xs font-medium text-rose-600 dark:bg-rose-950/40">
              <AlertCircle className="size-4 shrink-0" /> {formError}
            </div>
          )}

          {formSuccess && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-2 text-xs font-medium text-emerald-600 dark:bg-emerald-950/40">
              <CheckCircle2 className="size-4 shrink-0" /> {formSuccess}
            </div>
          )}

          <form onSubmit={handleSubmitVoucher} className="space-y-4 py-2 text-xs">
            {/* Header info */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="mb-1 block font-medium text-ink">Transaction Date *</label>
                <input
                  type="date"
                  required
                  value={newVoucherHeader.transactionDate}
                  onChange={(e) => setNewVoucherHeader({ ...newVoucherHeader, transactionDate: e.target.value })}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-ink">Journal Type *</label>
                <select
                  value={newVoucherHeader.journalType}
                  onChange={(e) => setNewVoucherHeader({ ...newVoucherHeader, journalType: e.target.value as JournalType })}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
                >
                  <option value="GENERAL">General Journal</option>
                  <option value="PAYMENT">Payment Voucher</option>
                  <option value="RECEIPT">Receipt Voucher</option>
                  <option value="CONTRA">Contra / Transfer</option>
                  <option value="ADJUSTMENT">Adjustment</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block font-medium text-ink">Office / Branch</label>
                <select
                  value={newVoucherHeader.officeId}
                  onChange={(e) => {
                    const name = e.target.value === "office-main" ? "Dhaka Corporate HQ" : "Chittagong Plant";
                    setNewVoucherHeader({ ...newVoucherHeader, officeId: e.target.value, officeName: name });
                  }}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
                >
                  <option value="office-main">Dhaka Corporate HQ</option>
                  <option value="office-ctg">Chittagong Plant</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block font-medium text-ink">Posting Action</label>
                <select
                  value={newVoucherHeader.status}
                  onChange={(e) => setNewVoucherHeader({ ...newVoucherHeader, status: e.target.value as VoucherStatus })}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
                >
                  <option value="POSTED">Post Directly to GL</option>
                  <option value="PENDING">Save as Pending Approval</option>
                  <option value="DRAFT">Save as Draft</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="mb-1 block font-medium text-ink">Narration / Description *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Settlement of monthly administrative bills"
                  value={newVoucherHeader.narration}
                  onChange={(e) => setNewVoucherHeader({ ...newVoucherHeader, narration: e.target.value })}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-ink">Reference #</label>
                <input
                  type="text"
                  placeholder="e.g. BILL-9921 / CHQ-1002"
                  value={newVoucherHeader.referenceNumber}
                  onChange={(e) => setNewVoucherHeader({ ...newVoucherHeader, referenceNumber: e.target.value })}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Multi-line table */}
            <div className="rounded-lg border border-line overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-line bg-control/50 font-semibold text-ink">
                  <tr>
                    <th className="px-3 py-2">General Ledger Account *</th>
                    <th className="px-3 py-2">Line Narration</th>
                    <th className="w-28 px-3 py-2 text-right">Debit (৳)</th>
                    <th className="w-28 px-3 py-2 text-right">Credit (৳)</th>
                    <th className="w-10 px-2 py-2 text-center" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {lines.map((line) => (
                    <tr key={line.id}>
                      <td className="p-2">
                        <select
                          value={line.accountId}
                          onChange={(e) => handleLineChange(line.id, { accountId: e.target.value })}
                          className="w-full rounded border border-line bg-surface p-1.5 text-xs text-ink outline-none"
                        >
                          {accounts
                            .filter((a) => !a.isGroup)
                            .map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.code} - {a.name} ({a.accountType})
                              </option>
                            ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          placeholder="Line note"
                          value={line.narration || ""}
                          onChange={(e) => handleLineChange(line.id, { narration: e.target.value })}
                          className="w-full rounded border border-line bg-surface p-1.5 text-xs text-ink outline-none"
                        />
                      </td>
                      <td className="p-2 text-right">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={line.debit || ""}
                          onChange={(e) => handleLineChange(line.id, { debit: Number(e.target.value) || 0 })}
                          className="w-full rounded border border-line bg-surface p-1.5 text-right text-xs font-medium text-ink outline-none"
                        />
                      </td>
                      <td className="p-2 text-right">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={line.credit || ""}
                          onChange={(e) => handleLineChange(line.id, { credit: Number(e.target.value) || 0 })}
                          className="w-full rounded border border-line bg-surface p-1.5 text-right text-xs font-medium text-ink outline-none"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(line.id)}
                          className="text-ink-muted hover:text-rose-600"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-line bg-control/30 font-semibold">
                  <tr>
                    <td colSpan={2} className="px-3 py-2 text-right text-ink">
                      Total:
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-ink">৳{totalDebit.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-bold text-ink">৳{totalCredit.toLocaleString()}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex items-center justify-between">
              <Button type="button" variant="secondary" size="sm" onClick={handleAddLine}>
                <Plus className="mr-1.5 size-3.5" /> Add Debit/Credit Line
              </Button>

              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-ink-muted">Balance Check:</span>
                {isBalanced ? (
                  <Badge variant="success" className="gap-1">
                    <CheckCircle2 className="size-3" /> Balanced (৳0.00 Difference)
                  </Badge>
                ) : (
                  <Badge variant="warning" className="gap-1">
                    <AlertCircle className="size-3" /> Difference: ৳{Math.abs(totalDebit - totalCredit).toLocaleString()}
                  </Badge>
                )}
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={!isBalanced}>
                Save Voucher
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reversal Confirmation Dialog */}
      <Dialog open={!!reversalTarget} onOpenChange={(open) => !open && setReversalTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reverse Posted Journal Voucher</DialogTitle>
            <DialogDescription>
              Create an auditable reversal voucher referencing {reversalTarget?.voucherNumber}. This will restore ledger balances atomically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <label className="mb-1 block font-medium text-ink">Reason for Reversal *</label>
              <textarea
                required
                rows={3}
                placeholder="e.g. Erroneous account selection or transaction cancellation..."
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setReversalTarget(null)}>
              Cancel
            </Button>
            <Button variant="primary" className="bg-rose-600 hover:bg-rose-700" onClick={handleConfirmReversal}>
              Confirm Reversal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Voucher Details / Print Dialog */}
      <Dialog open={!!viewingVoucher} onOpenChange={(open) => !open && setViewingVoucher(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Journal Voucher Details</DialogTitle>
              <Badge variant="neutral">{viewingVoucher?.status}</Badge>
            </div>
          </DialogHeader>

          {viewingVoucher && (
            <div className="space-y-4 py-2 text-xs">
              <div className="grid grid-cols-3 gap-2 border-b border-line pb-3">
                <div>
                  <span className="text-ink-muted">Voucher Number:</span>
                  <p className="font-semibold text-ink">{viewingVoucher.voucherNumber}</p>
                </div>
                <div>
                  <span className="text-ink-muted">Transaction Date:</span>
                  <p className="font-semibold text-ink">{viewingVoucher.transactionDate}</p>
                </div>
                <div>
                  <span className="text-ink-muted">Journal Type:</span>
                  <p className="font-semibold text-ink">{viewingVoucher.journalType}</p>
                </div>
                <div>
                  <span className="text-ink-muted">Office / Branch:</span>
                  <p className="font-semibold text-ink">{viewingVoucher.officeName}</p>
                </div>
                <div>
                  <span className="text-ink-muted">Reference #:</span>
                  <p className="font-semibold text-ink">{viewingVoucher.referenceNumber || "—"}</p>
                </div>
                <div>
                  <span className="text-ink-muted">Created By:</span>
                  <p className="font-semibold text-ink">{viewingVoucher.createdBy}</p>
                </div>
              </div>

              <div>
                <span className="text-ink-muted">Narration:</span>
                <p className="font-medium text-ink">{viewingVoucher.narration}</p>
              </div>

              <div className="rounded-lg border border-line overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-line bg-control/50 font-semibold">
                    <tr>
                      <th className="px-3 py-2">Account Code & Title</th>
                      <th className="px-3 py-2">Line Narration</th>
                      <th className="px-3 py-2 text-right">Debit (৳)</th>
                      <th className="px-3 py-2 text-right">Credit (৳)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {viewingVoucher.lines.map((l) => (
                      <tr key={l.id}>
                        <td className="px-3 py-2 font-medium text-ink">
                          {l.accountCode} - {l.accountName}
                        </td>
                        <td className="px-3 py-2 text-ink-muted">{l.narration || "—"}</td>
                        <td className="px-3 py-2 text-right font-medium text-ink">
                          {l.debit > 0 ? `৳${l.debit.toLocaleString()}` : "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-ink">
                          {l.credit > 0 ? `৳${l.credit.toLocaleString()}` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-line bg-control/30 font-bold">
                    <tr>
                      <td colSpan={2} className="px-3 py-2 text-right">
                        Total:
                      </td>
                      <td className="px-3 py-2 text-right">৳{viewingVoucher.totalDebit.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">৳{viewingVoucher.totalCredit.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <DialogFooter>
                <Button variant="secondary" onClick={() => window.print()}>
                  <Printer className="mr-1.5 size-3.5" /> Print Voucher
                </Button>
                <Button variant="ghost" onClick={() => setViewingVoucher(null)}>
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
