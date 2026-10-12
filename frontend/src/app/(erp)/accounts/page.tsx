"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  Filter,
  Layers,
  PieChart,
  RefreshCw,
  Scale,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAccountingStore } from "@/features/accounts/store/accounting-store";

export default function AccountDashboardPage() {
  const [dateRange, setDateRange] = useState({ from: "2026-07-01", to: "2027-06-30" });
  const [selectedOffice, setSelectedOffice] = useState("all");

  const getDashboardKPIs = useAccountingStore((s) => s.getDashboardKPIs);
  const vouchers = useAccountingStore((s) => s.vouchers);
  const expenses = useAccountingStore((s) => s.expenses);
  const transfers = useAccountingStore((s) => s.transfers);
  const cheques = useAccountingStore((s) => s.cheques);
  const costCenters = useAccountingStore((s) => s.costCenters);

  const kpis = useMemo(() => getDashboardKPIs(), [getDashboardKPIs]);

  // Derived financial ratios
  const currentAssets = kpis.cashInHand + kpis.cashAtBank + kpis.accountsReceivable;
  const currentLiabilities = Math.max(1, kpis.accountsPayable);
  const currentRatio = (currentAssets / currentLiabilities).toFixed(2);
  const quickRatio = ((kpis.cashInHand + kpis.cashAtBank + kpis.accountsReceivable * 0.9) / currentLiabilities).toFixed(2);
  const profitMargin = kpis.totalIncome > 0 ? ((kpis.currentPeriodProfitLoss / kpis.totalIncome) * 100).toFixed(1) : "0.0";

  const recentVouchers = useMemo(() => {
    return vouchers.slice(0, 6);
  }, [vouchers]);

  const pendingApprovals = useMemo(() => {
    const pendingV = vouchers.filter((v) => v.status === "PENDING" || v.status === "DRAFT").map((v) => ({
      id: v.id,
      title: `Voucher ${v.voucherNumber}`,
      subtitle: `${v.journalType} • ${v.officeName}`,
      amount: v.totalDebit,
      href: "/accounts/journal",
      type: "Voucher",
    }));
    const pendingE = expenses.filter((e) => e.status === "PENDING").map((e) => ({
      id: e.id,
      title: `Expense ${e.expenseNumber}`,
      subtitle: `${e.expenseType} • ${e.payeeName}`,
      amount: e.amount,
      href: "/accounts/expenses",
      type: "Expense",
    }));
    const pendingT = transfers.filter((t) => t.status === "PENDING_APPROVAL" || t.status === "IN_TRANSIT").map((t) => ({
      id: t.id,
      title: `Transfer ${t.transferNumber}`,
      subtitle: `${t.fromOfficeName} → ${t.toOfficeName}`,
      amount: t.requestedAmount,
      href: "/accounts/fund-transfers",
      type: "Transfer",
    }));
    return [...pendingV, ...pendingE, ...pendingT].slice(0, 5);
  }, [vouchers, expenses, transfers]);

  return (
    <PageContainer>
      <PageHead
        title="Account Dashboard"
        subtitle="Real-time financial status, double-entry KPIs, cash flows, and approval workflows"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs text-ink-muted">
              <Calendar className="size-3.5" />
              <span>FY 2026–2027</span>
            </div>
            <select
              value={selectedOffice}
              onChange={(e) => setSelectedOffice(e.target.value)}
              className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink outline-none transition focus:border-primary"
            >
              <option value="all">All Offices & Branches</option>
              <option value="hq">Dhaka Corporate HQ</option>
              <option value="ctg">Chittagong Plant</option>
            </select>
            <Link href="/accounts/journal">
              <Button variant="primary" size="sm">
                <BookOpen className="mr-1.5 size-3.5" />
                New Journal Voucher
              </Button>
            </Link>
          </div>
        }
      />

      {/* Primary KPI Ribbon (16 Requirements) */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8">
        {/* Row 1 */}
        <div className="rounded-xl border border-line bg-surface p-3 shadow-xs">
          <p className="text-[11px] font-medium text-ink-muted">Accounts Receivable</p>
          <p className="mt-1 text-base font-bold text-ink">৳{kpis.accountsReceivable.toLocaleString()}</p>
          <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-600">
            <ArrowUpRight className="size-3" />
            <span>Customer Dues</span>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-3 shadow-xs">
          <p className="text-[11px] font-medium text-ink-muted">Accounts Payable</p>
          <p className="mt-1 text-base font-bold text-ink">৳{kpis.accountsPayable.toLocaleString()}</p>
          <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-600">
            <ArrowDownRight className="size-3" />
            <span>Supplier Bills</span>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-3 shadow-xs">
          <p className="text-[11px] font-medium text-ink-muted">Cash in Hand</p>
          <p className="mt-1 text-base font-bold text-ink">৳{kpis.cashInHand.toLocaleString()}</p>
          <div className="mt-1 flex items-center gap-1 text-[10px] text-ink-faint">
            <Wallet className="size-3" />
            <span>Vault & Petty Cash</span>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-3 shadow-xs">
          <p className="text-[11px] font-medium text-ink-muted">Cash at Bank</p>
          <p className="mt-1 text-base font-bold text-ink">৳{kpis.cashAtBank.toLocaleString()}</p>
          <div className="mt-1 flex items-center gap-1 text-[10px] text-primary">
            <Banknote className="size-3" />
            <span>Bank Accounts</span>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-3 shadow-xs">
          <p className="text-[11px] font-medium text-ink-muted">Total Income</p>
          <p className="mt-1 text-base font-bold text-emerald-600">৳{kpis.totalIncome.toLocaleString()}</p>
          <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-600">
            <TrendingUp className="size-3" />
            <span>Gross Revenue</span>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-3 shadow-xs">
          <p className="text-[11px] font-medium text-ink-muted">Total Expenses</p>
          <p className="mt-1 text-base font-bold text-rose-600">৳{kpis.totalExpenses.toLocaleString()}</p>
          <div className="mt-1 flex items-center gap-1 text-[10px] text-rose-600">
            <TrendingDown className="size-3" />
            <span>Operational & Admin</span>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-3 shadow-xs">
          <p className="text-[11px] font-medium text-ink-muted">Opening Cash & Bank</p>
          <p className="mt-1 text-base font-bold text-ink">৳{kpis.openingCashAndBank.toLocaleString()}</p>
          <div className="mt-1 text-[10px] text-ink-faint">Start of Period</div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-3 shadow-xs">
          <p className="text-[11px] font-medium text-ink-muted">Closing Cash & Bank</p>
          <p className="mt-1 text-base font-bold text-primary">৳{kpis.closingCashAndBank.toLocaleString()}</p>
          <div className="mt-1 text-[10px] text-ink-faint">Available Liquidity</div>
        </div>
      </div>

      {/* Row 2 KPI Cards */}
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8">
        <div className="rounded-xl border border-line bg-surface p-3 shadow-xs">
          <p className="text-[11px] font-medium text-ink-muted">Total Receipts</p>
          <p className="mt-1 text-base font-bold text-emerald-600">৳{kpis.totalReceipts.toLocaleString()}</p>
          <div className="mt-1 text-[10px] text-ink-faint">Period Inflows</div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-3 shadow-xs">
          <p className="text-[11px] font-medium text-ink-muted">Total Payments</p>
          <p className="mt-1 text-base font-bold text-amber-600">৳{kpis.totalPayments.toLocaleString()}</p>
          <div className="mt-1 text-[10px] text-ink-faint">Period Outflows</div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-3 shadow-xs">
          <p className="text-[11px] font-medium text-ink-muted">Current Period P&L</p>
          <p className={`mt-1 text-base font-bold ${kpis.currentPeriodProfitLoss >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            ৳{kpis.currentPeriodProfitLoss.toLocaleString()}
          </p>
          <div className="mt-1 text-[10px] text-ink-faint">{kpis.currentPeriodProfitLoss >= 0 ? "Net Profit" : "Net Loss"}</div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-3 shadow-xs">
          <p className="text-[11px] font-medium text-ink-muted">Pending Vouchers</p>
          <p className="mt-1 text-base font-bold text-amber-600">{kpis.pendingJournalVouchers}</p>
          <div className="mt-1 text-[10px] text-ink-faint">Awaiting Posting</div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-3 shadow-xs">
          <p className="text-[11px] font-medium text-ink-muted">Pending Expenses</p>
          <p className="mt-1 text-base font-bold text-amber-600">{kpis.pendingExpenseApprovals}</p>
          <div className="mt-1 text-[10px] text-ink-faint">Needs Approval</div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-3 shadow-xs">
          <p className="text-[11px] font-medium text-ink-muted">Pending Transfers</p>
          <p className="mt-1 text-base font-bold text-blue-600">{kpis.pendingFundTransfers}</p>
          <div className="mt-1 text-[10px] text-ink-faint">In Transit / Pending</div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-3 shadow-xs">
          <p className="text-[11px] font-medium text-ink-muted">Outstanding Cheques</p>
          <p className="mt-1 text-base font-bold text-violet-600">{kpis.outstandingCheques}</p>
          <div className="mt-1 text-[10px] text-ink-faint">Un-cleared Leaves</div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-3 shadow-xs">
          <p className="text-[11px] font-medium text-ink-muted">Budget Utilization</p>
          <p className="mt-1 text-base font-bold text-ink">{kpis.budgetUtilization.toFixed(1)}%</p>
          <div className="mt-1 text-[10px] text-ink-faint">CapEx & OpEx</div>
        </div>
      </div>

      {/* Main Grid: Visual Trend Breakdown & Ratios */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Income vs Expense & Cash Flow Visuals */}
        <div className="space-y-4 lg:col-span-2">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-ink">Income vs. Expense Trend</h3>
                <p className="text-xs text-ink-muted">Monthly financial performance & operating margin</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 font-medium text-emerald-600">
                  <span className="size-2.5 rounded-full bg-emerald-500" /> Income
                </span>
                <span className="flex items-center gap-1.5 font-medium text-rose-600">
                  <span className="size-2.5 rounded-full bg-rose-500" /> Expense
                </span>
              </div>
            </div>

            {/* Visual Bar representation */}
            <div className="mt-6 space-y-4">
              <div>
                <div className="flex justify-between text-xs font-medium text-ink">
                  <span>Operating Revenue</span>
                  <span>৳{kpis.totalIncome.toLocaleString()}</span>
                </div>
                <div className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-control">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${Math.min(100, (kpis.totalIncome / Math.max(1, kpis.totalIncome + kpis.totalExpenses)) * 100)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium text-ink">
                  <span>Total Operational & Administrative Expense</span>
                  <span>৳{kpis.totalExpenses.toLocaleString()}</span>
                </div>
                <div className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-control">
                  <div
                    className="h-full rounded-full bg-rose-500 transition-all duration-500"
                    style={{ width: `${Math.min(100, (kpis.totalExpenses / Math.max(1, kpis.totalIncome + kpis.totalExpenses)) * 100)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium text-ink">
                  <span>Cash Flow Inflow vs. Outflow</span>
                  <span>Net Flow: ৳{(kpis.totalReceipts - kpis.totalPayments).toLocaleString()}</span>
                </div>
                <div className="mt-1.5 flex h-3 w-full overflow-hidden rounded-full bg-control">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${Math.min(100, (kpis.totalReceipts / Math.max(1, kpis.totalReceipts + kpis.totalPayments)) * 100)}%` }}
                  />
                  <div
                    className="h-full bg-amber-500"
                    style={{ width: `${Math.min(100, (kpis.totalPayments / Math.max(1, kpis.totalReceipts + kpis.totalPayments)) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Quick Summary Footnote */}
            <div className="mt-6 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center text-xs">
              <div>
                <p className="text-ink-muted">Net Cash Flow</p>
                <p className="mt-0.5 font-semibold text-ink">৳{(kpis.totalReceipts - kpis.totalPayments).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-ink-muted">Liquid Assets</p>
                <p className="mt-0.5 font-semibold text-ink">৳{(kpis.cashInHand + kpis.cashAtBank).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-ink-muted">Operating Margin</p>
                <p className="mt-0.5 font-semibold text-emerald-600">{profitMargin}%</p>
              </div>
            </div>
          </Card>

          {/* Recent Posted Vouchers */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-ink">Recent Journal Transactions</h3>
                <p className="text-xs text-ink-muted">Chronological audit stream from General Ledger</p>
              </div>
              <Link href="/accounts/journal" className="text-xs font-medium text-primary hover:underline">
                View Journal Repository →
              </Link>
            </div>

            <div className="mt-3 divide-y divide-line">
              {recentVouchers.length === 0 ? (
                <div className="py-8 text-center text-xs text-ink-faint">
                  No journal vouchers recorded yet. Click &quot;New Journal Voucher&quot; to post entries.
                </div>
              ) : (
                recentVouchers.map((v) => (
                  <div key={v.id} className="flex items-center justify-between py-2.5 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-ink">{v.voucherNumber}</span>
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
                      </div>
                      <p className="mt-0.5 text-ink-muted">
                        {v.transactionDate} • {v.narration || "General transaction entry"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-ink">৳{v.totalDebit.toLocaleString()}</p>
                      <p className="text-[10px] text-ink-faint">{v.officeName}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Right Sidebar: Ratio Analysis & Pending Approvals */}
        <div className="space-y-4">
          {/* Financial Ratios Panel */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-ink">Financial Ratio Analysis</h3>
            <p className="text-xs text-ink-muted">Key balance sheet liquidity & solvency metrics</p>

            <div className="mt-4 space-y-3.5">
              <div className="flex items-center justify-between border-b border-line pb-2.5">
                <div>
                  <p className="text-xs font-medium text-ink">Current Ratio</p>
                  <p className="text-[10px] text-ink-faint">Current Assets / Current Liabilities</p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-ink">{currentRatio}x</span>
                  <p className="text-[10px] text-emerald-600">Benchmark: &gt; 1.5x</p>
                </div>
              </div>

              <div className="flex items-center justify-between border-b border-line pb-2.5">
                <div>
                  <p className="text-xs font-medium text-ink">Quick Ratio (Acid-Test)</p>
                  <p className="text-[10px] text-ink-faint">(Cash + Receivables) / Current Liab.</p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-ink">{quickRatio}x</span>
                  <p className="text-[10px] text-emerald-600">Benchmark: &gt; 1.0x</p>
                </div>
              </div>

              <div className="flex items-center justify-between border-b border-line pb-2.5">
                <div>
                  <p className="text-xs font-medium text-ink">Net Profit Margin</p>
                  <p className="text-[10px] text-ink-faint">Net Income / Total Revenue</p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-emerald-600">{profitMargin}%</span>
                  <p className="text-[10px] text-ink-faint">Net Return</p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-ink">Debt-to-Equity</p>
                  <p className="text-[10px] text-ink-faint">Total Liabilities / Shareholder Equity</p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-ink">
                    {(kpis.accountsPayable / 2700000).toFixed(2)}x
                  </span>
                  <p className="text-[10px] text-emerald-600">Healthy Solvency</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Pending Approvals Panel */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink">Pending Approvals</h3>
              <Badge variant="warning">{pendingApprovals.length}</Badge>
            </div>
            <p className="text-xs text-ink-muted">Tasks awaiting authorized verification</p>

            <div className="mt-3 divide-y divide-line">
              {pendingApprovals.length === 0 ? (
                <div className="py-6 text-center text-xs text-emerald-600">
                  <CheckCircle2 className="mx-auto mb-1.5 size-5" />
                  All vouchers and payments are up to date!
                </div>
              ) : (
                pendingApprovals.map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-2 text-xs">
                    <div>
                      <p className="font-medium text-ink">{item.title}</p>
                      <p className="text-[10px] text-ink-muted">{item.subtitle}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-ink">৳{item.amount.toLocaleString()}</p>
                      <Link href={item.href} className="text-[10px] font-medium text-primary hover:underline">
                        Review →
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Quick Access Tiles */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-ink">Accounting Shortcuts</h3>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <Link
                href="/accounts/chart-of-accounts"
                className="flex items-center gap-2 rounded-lg border border-line p-2.5 transition hover:bg-control"
              >
                <Layers className="size-4 text-primary" />
                <span className="font-medium text-ink">Chart of Accounts</span>
              </Link>
              <Link
                href="/accounts/expenses"
                className="flex items-center gap-2 rounded-lg border border-line p-2.5 transition hover:bg-control"
              >
                <Wallet className="size-4 text-emerald-600" />
                <span className="font-medium text-ink">Expense Claim</span>
              </Link>
              <Link
                href="/accounts/fund-transfers"
                className="flex items-center gap-2 rounded-lg border border-line p-2.5 transition hover:bg-control"
              >
                <DollarSign className="size-4 text-blue-600" />
                <span className="font-medium text-ink">Fund Transfer</span>
              </Link>
              <Link
                href="/accounts/financial-reports"
                className="flex items-center gap-2 rounded-lg border border-line p-2.5 transition hover:bg-control"
              >
                <FileText className="size-4 text-violet-600" />
                <span className="font-medium text-ink">Financial Reports</span>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
