"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  DollarSign,
  Download,
  Filter,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Send,
  Truck,
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
import type { FundTransferRecord, FundTransferStatus } from "@/features/accounts/types";

export default function FundTransferPage() {
  const transfers = useAccountingStore((s) => s.transfers);
  const accounts = useAccountingStore((s) => s.accounts);
  const bankAccounts = useAccountingStore((s) => s.bankAccounts);
  const createTransfer = useAccountingStore((s) => s.createTransfer);
  const approveTransfer = useAccountingStore((s) => s.approveTransfer);
  const dispatchTransfer = useAccountingStore((s) => s.dispatchTransfer);
  const receiveTransfer = useAccountingStore((s) => s.receiveTransfer);
  const returnTransfer = useAccountingStore((s) => s.returnTransfer);

  const [activeTab, setActiveTab] = useState<
    "all" | "requests" | "out" | "in_transit" | "received" | "returned"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [isNewOpen, setIsNewOpen] = useState(false);
  const [returnTarget, setReturnTarget] = useState<FundTransferRecord | null>(null);
  const [returnReason, setReturnReason] = useState("");

  const [form, setForm] = useState({
    requestDate: new Date().toISOString().split("T")[0],
    expectedDate: new Date(Date.now() + 86400000).toISOString().split("T")[0],
    fromOfficeId: "office-main",
    fromOfficeName: "Dhaka Corporate HQ",
    toOfficeId: "office-ctg",
    toOfficeName: "Chittagong Plant",
    fromAccountId: "acc-1120",
    fromAccountName: "Cash at Bank - Sonali Bank",
    toAccountId: "acc-1121",
    toAccountName: "Cash at Bank - BRAC Bank",
    requestedAmount: 0,
    responsiblePerson: "Mohammad Arif",
    purpose: "Working capital replenishment for factory payroll",
    referenceNumber: "",
    status: "PENDING_APPROVAL" as FundTransferStatus,
  });

  const filteredTransfers = useMemo(() => {
    return transfers.filter((t) => {
      const matchSearch =
        t.transferNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.fromOfficeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.toOfficeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.purpose.toLowerCase().includes(searchQuery.toLowerCase());

      if (activeTab === "requests") return matchSearch && (t.status === "DRAFT" || t.status === "SUBMITTED" || t.status === "PENDING_APPROVAL");
      if (activeTab === "out") return matchSearch && t.status === "APPROVED";
      if (activeTab === "in_transit") return matchSearch && t.status === "IN_TRANSIT";
      if (activeTab === "received") return matchSearch && t.status === "RECEIVED";
      if (activeTab === "returned") return matchSearch && t.status === "RETURNED";
      return matchSearch;
    });
  }, [transfers, searchQuery, activeTab]);

  const handleSaveTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.requestedAmount <= 0) return;
    createTransfer(form);
    setIsNewOpen(false);
  };

  const handleConfirmReturn = () => {
    if (!returnTarget) return;
    if (!returnReason.trim()) {
      alert("Please specify the reason for transfer return.");
      return;
    }
    returnTransfer(returnTarget.id, returnReason);
    setReturnTarget(null);
    setReturnReason("");
  };

  return (
    <PageContainer>
      <PageHead
        title="Fund Transfer Management"
        subtitle="Inter-branch and inter-bank fund transfers with in-transit status and zero-sum double-entry posting"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              <Printer className="mr-1.5 size-3.5" /> Print Transfer Log
            </Button>
            <Button variant="primary" size="sm" onClick={() => setIsNewOpen(true)}>
              <Plus className="mr-1.5 size-3.5" /> Request Fund Transfer
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
              onClick={() => setActiveTab("all")}
              className={`rounded-md px-3 py-1.5 transition ${activeTab === "all" ? "bg-control font-semibold text-ink shadow-xs" : "text-ink-muted hover:text-ink"}`}
            >
              All Transfers ({transfers.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("requests")}
              className={`rounded-md px-3 py-1.5 transition ${activeTab === "requests" ? "bg-control font-semibold text-ink shadow-xs" : "text-ink-muted hover:text-ink"}`}
            >
              Requests ({transfers.filter((t) => t.status === "PENDING_APPROVAL" || t.status === "DRAFT").length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("out")}
              className={`rounded-md px-3 py-1.5 transition ${activeTab === "out" ? "bg-control font-semibold text-ink shadow-xs" : "text-ink-muted hover:text-ink"}`}
            >
              Transfer Out ({transfers.filter((t) => t.status === "APPROVED").length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("in_transit")}
              className={`rounded-md px-3 py-1.5 transition ${activeTab === "in_transit" ? "bg-control font-semibold text-ink shadow-xs" : "text-ink-muted hover:text-ink"}`}
            >
              In Transit ({transfers.filter((t) => t.status === "IN_TRANSIT").length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("received")}
              className={`rounded-md px-3 py-1.5 transition ${activeTab === "received" ? "bg-control font-semibold text-ink shadow-xs" : "text-ink-muted hover:text-ink"}`}
            >
              Received ({transfers.filter((t) => t.status === "RECEIVED").length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("returned")}
              className={`rounded-md px-3 py-1.5 transition ${activeTab === "returned" ? "bg-control font-semibold text-ink shadow-xs" : "text-ink-muted hover:text-ink"}`}
            >
              Returns ({transfers.filter((t) => t.status === "RETURNED").length})
            </button>
          </div>

          <div className="relative w-64">
            <Search className="absolute top-2.5 left-2.5 size-3.5 text-ink-faint" />
            <input
              type="text"
              placeholder="Search transfer #, office, purpose..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface py-1.5 pr-3 pl-8 text-xs text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none"
            />
          </div>
        </div>
      </Card>

      {/* Transfers Table */}
      <Card className="mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-line bg-control/40 font-semibold text-ink">
              <tr>
                <th className="px-4 py-2.5">Transfer #</th>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Origin Office</th>
                <th className="px-4 py-2.5">Destination Office</th>
                <th className="px-4 py-2.5">Source &rarr; Target Account</th>
                <th className="px-4 py-2.5 text-right">Amount (৳)</th>
                <th className="px-4 py-2.5">Responsible</th>
                <th className="px-4 py-2.5 text-center">Status</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredTransfers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-ink-faint">
                    No fund transfer records found in this category. Click &quot;Request Fund Transfer&quot; to initiate a transfer.
                  </td>
                </tr>
              ) : (
                filteredTransfers.map((t) => (
                  <tr key={t.id} className="hover:bg-control/30">
                    <td className="px-4 py-2.5 font-mono font-semibold text-ink">{t.transferNumber}</td>
                    <td className="px-4 py-2.5 text-ink-muted">{t.requestDate}</td>
                    <td className="px-4 py-2.5 font-medium text-ink">{t.fromOfficeName}</td>
                    <td className="px-4 py-2.5 font-medium text-ink">{t.toOfficeName}</td>
                    <td className="px-4 py-2.5 text-ink">
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span>{t.fromAccountName}</span>
                        <ArrowRight className="size-3 text-ink-faint" />
                        <span>{t.toAccountName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-ink">৳{t.requestedAmount.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-ink-muted">{t.responsiblePerson}</td>
                    <td className="px-4 py-2.5 text-center">
                      <Badge
                        variant={
                          t.status === "RECEIVED"
                            ? "success"
                            : t.status === "IN_TRANSIT"
                            ? "primary"
                            : t.status === "RETURNED"
                            ? "danger"
                            : "warning"
                        }
                      >
                        {t.status.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {t.status === "PENDING_APPROVAL" && (
                          <Button size="sm" variant="primary" onClick={() => approveTransfer(t.id, t.requestedAmount)}>
                            Approve
                          </Button>
                        )}
                        {t.status === "APPROVED" && (
                          <Button size="sm" variant="primary" onClick={() => dispatchTransfer(t.id)}>
                            <Truck className="mr-1 size-3" /> Dispatch (In-Transit)
                          </Button>
                        )}
                        {t.status === "IN_TRANSIT" && (
                          <>
                            <Button size="sm" variant="primary" onClick={() => receiveTransfer(t.id)}>
                              Confirm Receipt
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-rose-600"
                              onClick={() => {
                                setReturnTarget(t);
                                setReturnReason("");
                              }}
                            >
                              Return
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

      {/* New Transfer Modal */}
      <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Internal Fund Transfer</DialogTitle>
            <DialogDescription>
              Transfer liquid funds between offices or bank accounts. Entries will flow through &quot;Fund in Transit&quot; until confirmed.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveTransfer} className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-medium text-ink">Source Office *</label>
                <select
                  value={form.fromOfficeId}
                  onChange={(e) => {
                    const name = e.target.value === "office-main" ? "Dhaka Corporate HQ" : "Chittagong Plant";
                    setForm({ ...form, fromOfficeId: e.target.value, fromOfficeName: name });
                  }}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
                >
                  <option value="office-main">Dhaka Corporate HQ</option>
                  <option value="office-ctg">Chittagong Plant</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block font-medium text-ink">Receiving Office *</label>
                <select
                  value={form.toOfficeId}
                  onChange={(e) => {
                    const name = e.target.value === "office-ctg" ? "Chittagong Plant" : "Dhaka Corporate HQ";
                    setForm({ ...form, toOfficeId: e.target.value, toOfficeName: name });
                  }}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
                >
                  <option value="office-ctg">Chittagong Plant</option>
                  <option value="office-main">Dhaka Corporate HQ</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-medium text-ink">Source Account (Out) *</label>
                <select
                  value={form.fromAccountId}
                  onChange={(e) => {
                    const acc = accounts.find((a) => a.id === e.target.value);
                    setForm({ ...form, fromAccountId: e.target.value, fromAccountName: acc?.name || "Source" });
                  }}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
                >
                  {accounts
                    .filter((a) => (a.accountSubtype === "Bank" || a.accountSubtype === "Cash") && !a.isGroup)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} - {a.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block font-medium text-ink">Target Account (In) *</label>
                <select
                  value={form.toAccountId}
                  onChange={(e) => {
                    const acc = accounts.find((a) => a.id === e.target.value);
                    setForm({ ...form, toAccountId: e.target.value, toAccountName: acc?.name || "Target" });
                  }}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
                >
                  {accounts
                    .filter((a) => (a.accountSubtype === "Bank" || a.accountSubtype === "Cash") && !a.isGroup)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} - {a.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-medium text-ink">Transfer Amount (৳) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={form.requestedAmount || ""}
                  onChange={(e) => setForm({ ...form, requestedAmount: Number(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-ink">Expected Date</label>
                <input
                  type="date"
                  required
                  value={form.expectedDate}
                  onChange={(e) => setForm({ ...form, expectedDate: e.target.value })}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block font-medium text-ink">Responsible Officer</label>
              <input
                type="text"
                value={form.responsiblePerson}
                onChange={(e) => setForm({ ...form, responsiblePerson: e.target.value })}
                className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="mb-1 block font-medium text-ink">Purpose & Scope</label>
              <textarea
                rows={2}
                value={form.purpose}
                onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsNewOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Submit Request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Return Dialog */}
      <Dialog open={!!returnTarget} onOpenChange={(open) => !open && setReturnTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Return Fund Transfer</DialogTitle>
            <DialogDescription>
              Return in-transit fund {returnTarget?.transferNumber} back to origin source account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <label className="mb-1 block font-medium text-ink">Return Justification *</label>
              <textarea
                required
                rows={3}
                placeholder="e.g. Account mismatch or branch request revoked..."
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setReturnTarget(null)}>
              Cancel
            </Button>
            <Button variant="primary" className="bg-rose-600 hover:bg-rose-700" onClick={handleConfirmReturn}>
              Confirm Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
