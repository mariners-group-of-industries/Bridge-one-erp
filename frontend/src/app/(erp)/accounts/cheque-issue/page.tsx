"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  Clock,
  Download,
  Filter,
  Plus,
  Printer,
  RotateCcw,
  Search,
  XCircle,
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
import type { ChequeIssueItem, ChequeStatus } from "@/features/accounts/types";

export default function ChequeIssuePage() {
  const cheques = useAccountingStore((s) => s.cheques);
  const chequeBooks = useAccountingStore((s) => s.chequeBooks);
  const bankAccounts = useAccountingStore((s) => s.bankAccounts);
  const issueCheque = useAccountingStore((s) => s.issueCheque);
  const updateChequeStatus = useAccountingStore((s) => s.updateChequeStatus);

  const [activeTab, setActiveTab] = useState<"ALL" | "ISSUED" | "POST_DATED" | "CLEARED" | "BOUNCED" | "CANCELLED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [isIssueOpen, setIsIssueOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<ChequeIssueItem | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Printable Cheque preview
  const [printingCheque, setPrintingCheque] = useState<ChequeIssueItem | null>(null);

  const [form, setForm] = useState({
    bankAccountId: "bank-1",
    bankName: "Sonali Bank PLC",
    chequeBookId: "cb-1",
    chequeNumber: "SB-1001",
    payeeName: "",
    issueDate: new Date().toISOString().split("T")[0],
    chequeDate: new Date().toISOString().split("T")[0],
    amount: 0,
    purpose: "",
    referenceVoucher: "",
    status: "ISSUED" as ChequeStatus,
  });

  const filteredCheques = useMemo(() => {
    return cheques.filter((c) => {
      const matchSearch =
        c.chequeNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.payeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.bankName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.purpose.toLowerCase().includes(searchQuery.toLowerCase());
      const matchTab = activeTab === "ALL" ? true : c.status === activeTab;
      return matchSearch && matchTab;
    });
  }, [cheques, searchQuery, activeTab]);

  const handleBankChange = (bankId: string) => {
    const bank = bankAccounts.find((b) => b.id === bankId);
    const books = chequeBooks.filter((b) => b.bankAccountId === bankId && b.remainingLeaves > 0);
    const firstBook = books[0] || chequeBooks[0];

    if (bank) {
      setForm({
        ...form,
        bankAccountId: bank.id,
        bankName: bank.bankName,
        chequeBookId: firstBook?.id || "",
        chequeNumber: firstBook ? `${firstBook.startChequeNumber}` : "",
      });
    }
  };

  const handleSaveIssue = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!form.payeeName.trim() || form.amount <= 0 || !form.chequeNumber.trim()) {
      setErrorMessage("Payee name, valid cheque number, and amount are required.");
      return;
    }

    const isPostDated = new Date(form.chequeDate) > new Date(form.issueDate);
    const status: ChequeStatus = isPostDated ? "POST_DATED" : "ISSUED";

    const res = issueCheque({
      ...form,
      status,
    });

    if (!res.success) {
      setErrorMessage(res.message);
      return;
    }

    setSuccessMessage(res.message);
    setTimeout(() => {
      setIsIssueOpen(false);
      setSuccessMessage("");
    }, 1000);
  };

  const handleConfirmCancel = () => {
    if (!cancelTarget) return;
    if (!cancelReason.trim()) {
      alert("Please provide a reason for cancellation.");
      return;
    }
    updateChequeStatus(cancelTarget.id, "CANCELLED", cancelReason);
    setCancelTarget(null);
    setCancelReason("");
  };

  return (
    <PageContainer>
      <PageHead
        title="Cheque Issue & Register"
        subtitle="Issue bank cheques, monitor post-dated leaves, clearance settlement, and bounce workflows"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              <Printer className="mr-1.5 size-3.5" /> Print Register
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setErrorMessage("");
                setSuccessMessage("");
                setIsIssueOpen(true);
              }}
            >
              <Plus className="mr-1.5 size-3.5" /> Issue Cheque
            </Button>
          </div>
        }
      />

      {/* Tabs */}
      <Card className="mt-4 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap rounded-lg border border-line bg-surface p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab("ALL")}
              className={`rounded-md px-3 py-1.5 transition ${activeTab === "ALL" ? "bg-control font-semibold text-ink shadow-xs" : "text-ink-muted hover:text-ink"}`}
            >
              Cheque Register ({cheques.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("ISSUED")}
              className={`rounded-md px-3 py-1.5 transition ${activeTab === "ISSUED" ? "bg-control font-semibold text-ink shadow-xs" : "text-ink-muted hover:text-ink"}`}
            >
              Outgoing / Issued ({cheques.filter((c) => c.status === "ISSUED").length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("POST_DATED")}
              className={`rounded-md px-3 py-1.5 transition ${activeTab === "POST_DATED" ? "bg-control font-semibold text-ink shadow-xs" : "text-ink-muted hover:text-ink"}`}
            >
              Post-Dated ({cheques.filter((c) => c.status === "POST_DATED").length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("CLEARED")}
              className={`rounded-md px-3 py-1.5 transition ${activeTab === "CLEARED" ? "bg-control font-semibold text-ink shadow-xs" : "text-ink-muted hover:text-ink"}`}
            >
              Cleared ({cheques.filter((c) => c.status === "CLEARED").length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("BOUNCED")}
              className={`rounded-md px-3 py-1.5 transition ${activeTab === "BOUNCED" ? "bg-control font-semibold text-ink shadow-xs" : "text-ink-muted hover:text-ink"}`}
            >
              Bounced ({cheques.filter((c) => c.status === "BOUNCED").length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("CANCELLED")}
              className={`rounded-md px-3 py-1.5 transition ${activeTab === "CANCELLED" ? "bg-control font-semibold text-ink shadow-xs" : "text-ink-muted hover:text-ink"}`}
            >
              Cancelled ({cheques.filter((c) => c.status === "CANCELLED").length})
            </button>
          </div>

          <div className="relative w-64">
            <Search className="absolute top-2.5 left-2.5 size-3.5 text-ink-faint" />
            <input
              type="text"
              placeholder="Search cheque #, payee, bank..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface py-1.5 pr-3 pl-8 text-xs text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none"
            />
          </div>
        </div>
      </Card>

      {/* Cheques Table */}
      <Card className="mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-line bg-control/40 font-semibold text-ink">
              <tr>
                <th className="px-4 py-2.5">Cheque #</th>
                <th className="px-4 py-2.5">Bank Name</th>
                <th className="px-4 py-2.5">Payee</th>
                <th className="px-4 py-2.5">Issue Date</th>
                <th className="px-4 py-2.5">Cheque Date</th>
                <th className="px-4 py-2.5 text-right">Amount (৳)</th>
                <th className="px-4 py-2.5">Purpose</th>
                <th className="px-4 py-2.5 text-center">Status</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredCheques.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-ink-faint">
                    No cheque records found. Click &quot;Issue Cheque&quot; to register a leaf disbursement.
                  </td>
                </tr>
              ) : (
                filteredCheques.map((c) => (
                  <tr key={c.id} className="hover:bg-control/30">
                    <td className="px-4 py-2.5 font-mono font-semibold text-ink">{c.chequeNumber}</td>
                    <td className="px-4 py-2.5 font-medium text-ink">{c.bankName}</td>
                    <td className="px-4 py-2.5 font-medium text-ink">{c.payeeName}</td>
                    <td className="px-4 py-2.5 text-ink-muted">{c.issueDate}</td>
                    <td className="px-4 py-2.5 text-ink-muted">{c.chequeDate}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-ink">৳{c.amount.toLocaleString()}</td>
                    <td className="max-w-xs truncate px-4 py-2.5 text-ink-muted">{c.purpose}</td>
                    <td className="px-4 py-2.5 text-center">
                      <Badge
                        variant={
                          c.status === "CLEARED"
                            ? "success"
                            : c.status === "POST_DATED"
                            ? "neutral"
                            : c.status === "BOUNCED" || c.status === "CANCELLED"
                            ? "danger"
                            : "warning"
                        }
                      >
                        {c.status.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => setPrintingCheque(c)} title="Print Cheque Layout">
                          <Printer className="size-3.5" />
                        </Button>
                        {(c.status === "ISSUED" || c.status === "POST_DATED") && (
                          <>
                            <Button size="sm" variant="primary" onClick={() => updateChequeStatus(c.id, "CLEARED")}>
                              Clear
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-amber-600"
                              onClick={() => updateChequeStatus(c.id, "BOUNCED", "Insufficient funds")}
                            >
                              Bounce
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-rose-600"
                              onClick={() => {
                                setCancelTarget(c);
                                setCancelReason("");
                              }}
                            >
                              Cancel
                            </Button>
                          </>
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

      {/* Issue Cheque Modal */}
      <Dialog open={isIssueOpen} onOpenChange={setIsIssueOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Issue Bank Cheque</DialogTitle>
            <DialogDescription>
              Disburse an authorized cheque leaf to a verified payee or vendor.
            </DialogDescription>
          </DialogHeader>

          {errorMessage && (
            <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-2 text-xs font-medium text-rose-600 dark:bg-rose-950/40">
              <AlertCircle className="size-4 shrink-0" /> {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-2 text-xs font-medium text-emerald-600 dark:bg-emerald-950/40">
              <CheckCircle2 className="size-4 shrink-0" /> {successMessage}
            </div>
          )}

          <form onSubmit={handleSaveIssue} className="space-y-3 py-2 text-xs">
            <div>
              <label className="mb-1 block font-medium text-ink">Bank Account *</label>
              <select
                value={form.bankAccountId}
                onChange={(e) => handleBankChange(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
              >
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bankName} - {b.accountNumber}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-medium text-ink">Cheque Book *</label>
                <select
                  value={form.chequeBookId}
                  onChange={(e) => setForm({ ...form, chequeBookId: e.target.value })}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
                >
                  {chequeBooks
                    .filter((b) => b.bankAccountId === form.bankAccountId)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bookName} ({b.remainingLeaves} leaves)
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block font-medium text-ink">Cheque Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SB-1002"
                  value={form.chequeNumber}
                  onChange={(e) => setForm({ ...form, chequeNumber: e.target.value })}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary font-mono"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block font-medium text-ink">Payee Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Meghna Petroleum Limited"
                value={form.payeeName}
                onChange={(e) => setForm({ ...form, payeeName: e.target.value })}
                className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-medium text-ink">Amount (৳) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={form.amount || ""}
                  onChange={(e) => setForm({ ...form, amount: Number(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary font-bold"
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-ink">Cheque Date (Maturity) *</label>
                <input
                  type="date"
                  required
                  value={form.chequeDate}
                  onChange={(e) => setForm({ ...form, chequeDate: e.target.value })}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block font-medium text-ink">Purpose & Reference Voucher</label>
              <input
                type="text"
                placeholder="e.g. Vendor settlement for Purchase Order PO-2026-004"
                value={form.purpose}
                onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsIssueOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Issue Cheque Leaf
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Cheque Cancellation Dialog */}
      <Dialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Issued Cheque</DialogTitle>
            <DialogDescription>
              Cancel leaf {cancelTarget?.chequeNumber} issued to {cancelTarget?.payeeName}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <label className="mb-1 block font-medium text-ink">Cancellation Reason *</label>
              <textarea
                required
                rows={3}
                placeholder="e.g. Incorrect amount printed or payee requested electronic bank transfer..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setCancelTarget(null)}>
              Abort
            </Button>
            <Button variant="primary" className="bg-rose-600 hover:bg-rose-700" onClick={handleConfirmCancel}>
              Confirm Cancellation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cheque Print Preview Dialog */}
      <Dialog open={!!printingCheque} onOpenChange={(open) => !open && setPrintingCheque(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Cheque Print Preview</DialogTitle>
          </DialogHeader>

          {printingCheque && (
            <div className="space-y-4 py-2 text-xs">
              {/* Visual Realistic Cheque Leaf */}
              <div className="relative rounded-xl border-2 border-emerald-700/60 bg-emerald-50/40 p-5 shadow-xs dark:bg-emerald-950/20">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-ink">{printingCheque.bankName}</h3>
                    <p className="text-[10px] text-ink-muted">Principal Corporate Branch</p>
                  </div>
                  <div className="rounded border border-line bg-surface px-2 py-0.5 font-mono text-[11px] font-semibold text-ink">
                    DATE: {printingCheque.chequeDate}
                  </div>
                </div>

                <div className="mt-4 space-y-2 border-b border-dashed border-line pb-3">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium text-ink-muted">PAY TO:</span>
                    <span className="flex-1 border-b border-line pb-0.5 font-bold text-ink">
                      {printingCheque.payeeName}
                    </span>
                    <span className="font-medium text-ink-muted">OR BEARER</span>
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="font-medium text-ink-muted">TAKA:</span>
                    <span className="flex-1 border-b border-line pb-0.5 font-medium text-ink">
                      (Taka {printingCheque.amount.toLocaleString()} Only)
                    </span>
                    <div className="rounded border border-ink bg-surface px-2.5 py-1 font-mono font-bold text-ink">
                      ৳{printingCheque.amount.toLocaleString()}/=
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-end justify-between font-mono text-[10px] text-ink-muted">
                  <span>CHEQUE NO: {printingCheque.chequeNumber}</span>
                  <div className="text-right">
                    <p className="border-t border-line px-4 pt-1 font-sans text-xs font-semibold text-ink">
                      Authorised Signature
                    </p>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="secondary" onClick={() => window.print()}>
                  <Printer className="mr-1.5 size-3.5" /> Print Cheque
                </Button>
                <Button variant="ghost" onClick={() => setPrintingCheque(null)}>
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
