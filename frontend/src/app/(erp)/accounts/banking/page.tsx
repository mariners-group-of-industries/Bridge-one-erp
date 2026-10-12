"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  Banknote,
  Building2,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  Download,
  Landmark,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
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
import type { BankAccountItem, DepositItem, FactoringItem, LoanItem } from "@/features/accounts/types";

export default function FinanceBankingPage() {
  const bankAccounts = useAccountingStore((s) => s.bankAccounts);
  const deposits = useAccountingStore((s) => s.deposits);
  const loans = useAccountingStore((s) => s.loans);
  const factoring = useAccountingStore((s) => s.factoring);
  const accounts = useAccountingStore((s) => s.accounts);
  const addBankAccount = useAccountingStore((s) => s.addBankAccount);
  const addDeposit = useAccountingStore((s) => s.addDeposit);
  const addLoan = useAccountingStore((s) => s.addLoan);

  const [activeTab, setActiveTab] = useState<"banking" | "deposits" | "loans" | "factoring">("banking");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [isNewBankOpen, setIsNewBankOpen] = useState(false);
  const [isNewDepositOpen, setIsNewDepositOpen] = useState(false);
  const [isNewLoanOpen, setIsNewLoanOpen] = useState(false);

  // Bank Form
  const [bankForm, setBankForm] = useState({
    accountNumber: "",
    bankName: "",
    branchName: "",
    accountHolder: "BridgeOne Industrial Solutions Ltd",
    accountType: "CURRENT" as BankAccountItem["accountType"],
    currency: "BDT",
    glAccountId: "acc-1120",
    glAccountName: "Cash at Bank - Sonali Bank",
    openingBalance: 0,
    reconciliationStatus: "RECONCILED" as const,
    isActive: true,
  });

  // Deposit Form
  const [depositForm, setDepositForm] = useState({
    bankAccountId: "bank-1",
    bankName: "Sonali Bank PLC",
    depositType: "FIXED" as const,
    principalAmount: 500000,
    interestRate: 8.5,
    openingDate: new Date().toISOString().split("T")[0],
    maturityDate: new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0],
    maturityValue: 542500,
    interestEarned: 42500,
    status: "ACTIVE" as const,
  });

  // Loan Form
  const [loanForm, setLoanForm] = useState({
    lenderName: "Eastern Bank PLC",
    loanType: "WORKING_CAPITAL" as const,
    principalAmount: 2000000,
    interestRate: 9.0,
    disbursementDate: new Date().toISOString().split("T")[0],
    maturityDate: new Date(Date.now() + 730 * 86400000).toISOString().split("T")[0],
    installmentAmount: 95000,
    outstandingPrincipal: 2000000,
    accruedInterest: 0,
    status: "ACTIVE" as const,
  });

  const filteredBanks = useMemo(() => {
    return bankAccounts.filter(
      (b) =>
        b.bankName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.accountNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.branchName.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [bankAccounts, searchQuery]);

  const handleSaveBank = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankForm.accountNumber || !bankForm.bankName) return;
    addBankAccount(bankForm);
    setIsNewBankOpen(false);
  };

  const handleSaveDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    if (depositForm.principalAmount <= 0) return;
    addDeposit(depositForm);
    setIsNewDepositOpen(false);
  };

  const handleSaveLoan = (e: React.FormEvent) => {
    e.preventDefault();
    if (loanForm.principalAmount <= 0) return;
    addLoan(loanForm);
    setIsNewLoanOpen(false);
  };

  return (
    <PageContainer>
      <PageHead
        title="Finance & Banking"
        subtitle="Manage company bank accounts, fixed term deposits, credit facilities, and factoring receivables"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              <Printer className="mr-1.5 size-3.5" /> Print Statements
            </Button>
            {activeTab === "banking" && (
              <Button variant="primary" size="sm" onClick={() => setIsNewBankOpen(true)}>
                <Plus className="mr-1.5 size-3.5" /> Add Bank Account
              </Button>
            )}
            {activeTab === "deposits" && (
              <Button variant="primary" size="sm" onClick={() => setIsNewDepositOpen(true)}>
                <Plus className="mr-1.5 size-3.5" /> Open Fixed Deposit
              </Button>
            )}
            {activeTab === "loans" && (
              <Button variant="primary" size="sm" onClick={() => setIsNewLoanOpen(true)}>
                <Plus className="mr-1.5 size-3.5" /> Register Bank Loan
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
              onClick={() => setActiveTab("banking")}
              className={`rounded-md px-3.5 py-1.5 transition ${activeTab === "banking" ? "bg-control font-semibold text-ink shadow-xs" : "text-ink-muted hover:text-ink"}`}
            >
              Regular Banking ({bankAccounts.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("deposits")}
              className={`rounded-md px-3.5 py-1.5 transition ${activeTab === "deposits" ? "bg-control font-semibold text-ink shadow-xs" : "text-ink-muted hover:text-ink"}`}
            >
              Deposits / FDR ({deposits.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("loans")}
              className={`rounded-md px-3.5 py-1.5 transition ${activeTab === "loans" ? "bg-control font-semibold text-ink shadow-xs" : "text-ink-muted hover:text-ink"}`}
            >
              Loans & Credit ({loans.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("factoring")}
              className={`rounded-md px-3.5 py-1.5 transition ${activeTab === "factoring" ? "bg-control font-semibold text-ink shadow-xs" : "text-ink-muted hover:text-ink"}`}
            >
              Factoring Report
            </button>
          </div>

          <div className="relative w-64">
            <Search className="absolute top-2.5 left-2.5 size-3.5 text-ink-faint" />
            <input
              type="text"
              placeholder="Search bank name, account #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface py-1.5 pr-3 pl-8 text-xs text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none"
            />
          </div>
        </div>
      </Card>

      {/* Tab 1: Regular Banking */}
      {activeTab === "banking" && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredBanks.map((b) => (
              <Card key={b.id} className="p-4 transition hover:shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-ink">{b.bankName}</h4>
                    <p className="text-xs text-ink-muted">{b.branchName}</p>
                  </div>
                  <Badge variant={b.isActive ? "success" : "neutral"}>{b.accountType}</Badge>
                </div>

                <div className="mt-4 space-y-2 border-t border-line pt-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-ink-muted">Account Number:</span>
                    <span className="font-mono font-medium text-ink">{b.accountNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-muted">Linked GL Account:</span>
                    <span className="font-medium text-ink">{b.glAccountName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-muted">Reconciliation:</span>
                    <span className="flex items-center gap-1 font-medium text-emerald-600">
                      <ShieldCheck className="size-3" /> {b.reconciliationStatus}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-line/60 pt-2 text-sm">
                    <span className="font-medium text-ink">Ledger Balance:</span>
                    <span className="font-bold text-primary">৳{b.currentBalance.toLocaleString()}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Deposits */}
      {activeTab === "deposits" && (
        <Card className="mt-4 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line bg-control/40 font-semibold text-ink">
                <tr>
                  <th className="px-4 py-2.5">Deposit #</th>
                  <th className="px-4 py-2.5">Bank Name</th>
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5 text-right">Principal (৳)</th>
                  <th className="px-4 py-2.5 text-right">Rate (%)</th>
                  <th className="px-4 py-2.5">Opening Date</th>
                  <th className="px-4 py-2.5">Maturity Date</th>
                  <th className="px-4 py-2.5 text-right">Maturity Value (৳)</th>
                  <th className="px-4 py-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {deposits.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-ink-faint">
                      No fixed deposit records. Click &quot;Open Fixed Deposit&quot; to register term deposits.
                    </td>
                  </tr>
                ) : (
                  deposits.map((d) => (
                    <tr key={d.id} className="hover:bg-control/30">
                      <td className="px-4 py-2.5 font-mono font-semibold text-ink">{d.depositNumber}</td>
                      <td className="px-4 py-2.5 font-medium text-ink">{d.bankName}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="neutral">{d.depositType}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-ink">৳{d.principalAmount.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-emerald-600">{d.interestRate}%</td>
                      <td className="px-4 py-2.5 text-ink-muted">{d.openingDate}</td>
                      <td className="px-4 py-2.5 text-ink-muted">{d.maturityDate}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-primary">৳{d.maturityValue.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-center">
                        <Badge variant="success">{d.status}</Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 3: Loans */}
      {activeTab === "loans" && (
        <Card className="mt-4 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line bg-control/40 font-semibold text-ink">
                <tr>
                  <th className="px-4 py-2.5">Loan #</th>
                  <th className="px-4 py-2.5">Lender Name</th>
                  <th className="px-4 py-2.5">Loan Type</th>
                  <th className="px-4 py-2.5 text-right">Principal (৳)</th>
                  <th className="px-4 py-2.5 text-right">Interest Rate</th>
                  <th className="px-4 py-2.5 text-right">Installment (৳)</th>
                  <th className="px-4 py-2.5 text-right">Outstanding (৳)</th>
                  <th className="px-4 py-2.5">Maturity Date</th>
                  <th className="px-4 py-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {loans.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-ink-faint">
                      No loan records found. Click &quot;Register Bank Loan&quot; to manage credit facilities.
                    </td>
                  </tr>
                ) : (
                  loans.map((l) => (
                    <tr key={l.id} className="hover:bg-control/30">
                      <td className="px-4 py-2.5 font-mono font-semibold text-ink">{l.loanNumber}</td>
                      <td className="px-4 py-2.5 font-medium text-ink">{l.lenderName}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="neutral">{l.loanType}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-ink">৳{l.principalAmount.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-amber-600">{l.interestRate}%</td>
                      <td className="px-4 py-2.5 text-right text-ink">৳{l.installmentAmount.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-rose-600">৳{l.outstandingPrincipal.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-ink-muted">{l.maturityDate}</td>
                      <td className="px-4 py-2.5 text-center">
                        <Badge variant="success">{l.status}</Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 4: Factoring Report */}
      {activeTab === "factoring" && (
        <Card className="mt-4 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-ink">Receivables Factoring Register</h3>
              <p className="text-xs text-ink-muted">Tracking discounted customer invoices and factoring advances</p>
            </div>
            <Badge variant="neutral">0 Active Factoring Deals</Badge>
          </div>
          <div className="py-12 text-center text-xs text-ink-faint">
            All customer accounts receivable are currently collected directly. Factoring lines will be registered upon finance approval.
          </div>
        </Card>
      )}

      {/* Dialog: New Bank Account */}
      <Dialog open={isNewBankOpen} onOpenChange={setIsNewBankOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Register Bank Account</DialogTitle>
            <DialogDescription>Link a corporate bank account with General Ledger mapping.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveBank} className="space-y-3 py-2 text-xs">
            <div>
              <label className="mb-1 block font-medium text-ink">Bank Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Dutch-Bangla Bank PLC"
                value={bankForm.bankName}
                onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })}
                className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-medium text-ink">Branch Name</label>
                <input
                  type="text"
                  placeholder="e.g. Agrabad Branch"
                  value={bankForm.branchName}
                  onChange={(e) => setBankForm({ ...bankForm, branchName: e.target.value })}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-ink">Account Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 110123456789"
                  value={bankForm.accountNumber}
                  onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value })}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-medium text-ink">Account Type</label>
                <select
                  value={bankForm.accountType}
                  onChange={(e) => setBankForm({ ...bankForm, accountType: e.target.value as BankAccountItem["accountType"] })}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
                >
                  <option value="CURRENT">Current Account</option>
                  <option value="SAVINGS">Savings Account</option>
                  <option value="ESCROW">Escrow Account</option>
                  <option value="SALARY">Salary Account</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block font-medium text-ink">Opening Balance (৳)</label>
                <input
                  type="number"
                  value={bankForm.openingBalance || ""}
                  onChange={(e) => setBankForm({ ...bankForm, openingBalance: Number(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block font-medium text-ink">Linked General Ledger Account *</label>
              <select
                value={bankForm.glAccountId}
                onChange={(e) => {
                  const acc = accounts.find((a) => a.id === e.target.value);
                  setBankForm({
                    ...bankForm,
                    glAccountId: e.target.value,
                    glAccountName: acc?.name || "Bank Account",
                  });
                }}
                className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
              >
                {accounts
                  .filter((a) => a.accountSubtype === "Bank" || a.accountSubtype === "Cash")
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} - {a.name}
                    </option>
                  ))}
              </select>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsNewBankOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Save Account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: New Deposit */}
      <Dialog open={isNewDepositOpen} onOpenChange={setIsNewDepositOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Open Fixed Deposit (FDR)</DialogTitle>
            <DialogDescription>Record long-term capital deposits and maturity interest calculations.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveDeposit} className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-medium text-ink">Principal Amount (৳) *</label>
                <input
                  type="number"
                  required
                  min="1000"
                  value={depositForm.principalAmount}
                  onChange={(e) => {
                    const p = Number(e.target.value) || 0;
                    const interest = (p * depositForm.interestRate) / 100;
                    setDepositForm({
                      ...depositForm,
                      principalAmount: p,
                      interestEarned: interest,
                      maturityValue: p + interest,
                    });
                  }}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-ink">Interest Rate (%) *</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={depositForm.interestRate}
                  onChange={(e) => {
                    const r = Number(e.target.value) || 0;
                    const interest = (depositForm.principalAmount * r) / 100;
                    setDepositForm({
                      ...depositForm,
                      interestRate: r,
                      interestEarned: interest,
                      maturityValue: depositForm.principalAmount + interest,
                    });
                  }}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-medium text-ink">Opening Date</label>
                <input
                  type="date"
                  required
                  value={depositForm.openingDate}
                  onChange={(e) => setDepositForm({ ...depositForm, openingDate: e.target.value })}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-ink">Maturity Date</label>
                <input
                  type="date"
                  required
                  value={depositForm.maturityDate}
                  onChange={(e) => setDepositForm({ ...depositForm, maturityDate: e.target.value })}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="rounded-lg bg-control p-2.5">
              <div className="flex justify-between">
                <span className="text-ink-muted">Expected Interest:</span>
                <span className="font-semibold text-emerald-600">৳{depositForm.interestEarned.toLocaleString()}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-ink-muted">Maturity Payout:</span>
                <span className="font-bold text-ink">৳{depositForm.maturityValue.toLocaleString()}</span>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsNewDepositOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Confirm Deposit
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: New Loan */}
      <Dialog open={isNewLoanOpen} onOpenChange={setIsNewLoanOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Register Loan Facility</DialogTitle>
            <DialogDescription>Record term loans, bank credit limits, and monthly debt amortization.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveLoan} className="space-y-3 py-2 text-xs">
            <div>
              <label className="mb-1 block font-medium text-ink">Lender / Financial Institution *</label>
              <input
                type="text"
                required
                placeholder="e.g. City Bank PLC"
                value={loanForm.lenderName}
                onChange={(e) => setLoanForm({ ...loanForm, lenderName: e.target.value })}
                className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-medium text-ink">Principal (৳) *</label>
                <input
                  type="number"
                  required
                  min="1000"
                  value={loanForm.principalAmount}
                  onChange={(e) =>
                    setLoanForm({
                      ...loanForm,
                      principalAmount: Number(e.target.value) || 0,
                      outstandingPrincipal: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-ink">Interest Rate (%) *</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={loanForm.interestRate}
                  onChange={(e) => setLoanForm({ ...loanForm, interestRate: Number(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-medium text-ink">Monthly Installment (৳)</label>
                <input
                  type="number"
                  required
                  value={loanForm.installmentAmount}
                  onChange={(e) => setLoanForm({ ...loanForm, installmentAmount: Number(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-ink">Maturity Date</label>
                <input
                  type="date"
                  required
                  value={loanForm.maturityDate}
                  onChange={(e) => setLoanForm({ ...loanForm, maturityDate: e.target.value })}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsNewLoanOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Save Facility
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
