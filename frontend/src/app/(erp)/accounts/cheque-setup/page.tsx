"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  CheckSquare,
  CreditCard,
  Download,
  Landmark,
  Plus,
  Printer,
  Search,
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

export default function ChequeSetupPage() {
  const chequeBooks = useAccountingStore((s) => s.chequeBooks);
  const bankAccounts = useAccountingStore((s) => s.bankAccounts);
  const addChequeBook = useAccountingStore((s) => s.addChequeBook);

  const [searchQuery, setSearchQuery] = useState("");
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

  const filteredBooks = useMemo(() => {
    return chequeBooks.filter(
      (b) =>
        b.bookName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.bankName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.accountNumber.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [chequeBooks, searchQuery]);

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

    if (!form.bookName.trim()) {
      setErrorMessage("Cheque book name is required.");
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
    }, 1000);
  };

  return (
    <PageContainer>
      <PageHead
        title="Cheque Setup"
        subtitle="Register bank cheque books, leaf serial ranges, and inventory status"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              <Printer className="mr-1.5 size-3.5" /> Print Inventory
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setErrorMessage("");
                setSuccessMessage("");
                setIsRegisterOpen(true);
              }}
            >
              <Plus className="mr-1.5 size-3.5" /> Register Cheque Book
            </Button>
          </div>
        }
      />

      {/* Filter Bar */}
      <Card className="mt-4 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-72">
            <Search className="absolute top-2.5 left-2.5 size-3.5 text-ink-faint" />
            <input
              type="text"
              placeholder="Search by book name, bank, or account #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface py-1.5 pr-3 pl-8 text-xs text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-4 text-xs text-ink-muted">
            <span>
              Total Cheque Books: <strong className="text-ink">{chequeBooks.length}</strong>
            </span>
            <span>
              Active Books:{" "}
              <strong className="text-emerald-600">
                {chequeBooks.filter((b) => b.status === "ACTIVE").length}
              </strong>
            </span>
            <span>
              Available Leaves:{" "}
              <strong className="text-primary">
                {chequeBooks.reduce((sum, b) => sum + b.remainingLeaves, 0)}
              </strong>
            </span>
          </div>
        </div>
      </Card>

      {/* Cheque Books Table */}
      <Card className="mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-line bg-control/40 font-semibold text-ink">
              <tr>
                <th className="px-4 py-2.5">Cheque Book Name</th>
                <th className="px-4 py-2.5">Bank Name</th>
                <th className="px-4 py-2.5">Account Number</th>
                <th className="px-4 py-2.5 font-mono">Start Serial</th>
                <th className="px-4 py-2.5 font-mono">End Serial</th>
                <th className="px-4 py-2.5 text-right">Total Leaves</th>
                <th className="px-4 py-2.5 text-right">Issued Leaves</th>
                <th className="px-4 py-2.5 text-right">Remaining Leaves</th>
                <th className="px-4 py-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredBooks.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-ink-faint">
                    No cheque books registered. Click &quot;Register Cheque Book&quot; to add a new inventory book.
                  </td>
                </tr>
              ) : (
                filteredBooks.map((b) => (
                  <tr key={b.id} className="hover:bg-control/30">
                    <td className="px-4 py-2.5 font-semibold text-ink">{b.bookName}</td>
                    <td className="px-4 py-2.5 font-medium text-ink">{b.bankName}</td>
                    <td className="px-4 py-2.5 font-mono text-ink-muted">{b.accountNumber}</td>
                    <td className="px-4 py-2.5 font-mono text-ink">{b.startChequeNumber}</td>
                    <td className="px-4 py-2.5 font-mono text-ink">{b.endChequeNumber}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-ink">{b.totalLeaves}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-amber-600">{b.usedLeaves}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-emerald-600">{b.remainingLeaves}</td>
                    <td className="px-4 py-2.5 text-center">
                      <Badge variant={b.status === "ACTIVE" ? "success" : "neutral"}>{b.status}</Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Register Cheque Book Modal */}
      <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Register Bank Cheque Book</DialogTitle>
            <DialogDescription>
              Assign a new leaf range to an authorized company bank account.
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

          <form onSubmit={handleSave} className="space-y-3 py-2 text-xs">
            <div>
              <label className="mb-1 block font-medium text-ink">Cheque Book Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. BRAC-Corporate-01"
                value={form.bookName}
                onChange={(e) => setForm({ ...form, bookName: e.target.value })}
                className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="mb-1 block font-medium text-ink">Bank Account *</label>
              <select
                value={form.bankAccountId}
                onChange={(e) => handleBankChange(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
              >
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bankName} - {b.accountNumber} ({b.accountType})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-medium text-ink">Start Leaf Serial *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BB-2001"
                  value={form.startChequeNumber}
                  onChange={(e) => setForm({ ...form, startChequeNumber: e.target.value })}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary font-mono"
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-ink">End Leaf Serial *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BB-2050"
                  value={form.endChequeNumber}
                  onChange={(e) => setForm({ ...form, endChequeNumber: e.target.value })}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary font-mono"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsRegisterOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Register Leaves
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
