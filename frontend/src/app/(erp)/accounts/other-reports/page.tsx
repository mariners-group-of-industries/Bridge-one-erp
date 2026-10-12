"use client";

import { useMemo, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Landmark,
  Layers,
  Percent,
  Printer,
  Search,
  ShieldCheck,
} from "lucide-react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAccountingStore } from "@/features/accounts/store/accounting-store";

export default function OtherReportsPage() {
  const [selectedReport, setSelectedReport] = useState<string>("vat_register");
  const [selectedOffice, setSelectedOffice] = useState("all");
  const [fromDate, setFromDate] = useState("2026-07-01");
  const [toDate, setToDate] = useState("2027-06-30");
  const [taxRate, setTaxRate] = useState("15");

  const accounts = useAccountingStore((s) => s.accounts);
  const vouchers = useAccountingStore((s) => s.vouchers);
  const expenses = useAccountingStore((s) => s.expenses);
  const cheques = useAccountingStore((s) => s.cheques);
  const budgets = useAccountingStore((s) => s.budgets);
  const costCenters = useAccountingStore((s) => s.costCenters);

  // Computed Tax & VAT transactions
  const taxTransactions = useMemo(() => {
    return [
      {
        id: "tax-1",
        date: "2026-09-12",
        voucherNo: "JV-2026-0012",
        beneficiary: "Universal Raw Materials Ltd",
        invoiceAmount: 250000,
        taxType: "VAT",
        rate: 15,
        withholdingAmount: 37500,
        depositStatus: "CHALLAN_DEPOSITED",
        treasuryChallanNo: "TR-NBR-98711",
      },
      {
        id: "tax-2",
        date: "2026-09-20",
        voucherNo: "JV-2026-0015",
        beneficiary: "TechnoSoft Solutions BD",
        invoiceAmount: 120000,
        taxType: "AIT / TDS",
        rate: 10,
        withholdingAmount: 12000,
        depositStatus: "PENDING_DEPOSIT",
        treasuryChallanNo: "—",
      },
      {
        id: "tax-3",
        date: "2026-10-02",
        voucherNo: "JV-2026-0021",
        beneficiary: "Standard Logistics Express",
        invoiceAmount: 85000,
        taxType: "AIT / TDS",
        rate: 5,
        withholdingAmount: 4250,
        depositStatus: "CHALLAN_DEPOSITED",
        treasuryChallanNo: "TR-NBR-99042",
      },
    ];
  }, []);

  const handleExportCSV = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      ["Date,Voucher No,Beneficiary,Invoice Amount,Tax Type,Rate %,Withholding Amount,Status,Treasury Challan"]
        .concat(
          taxTransactions.map(
            (t) =>
              `"${t.date}","${t.voucherNo}","${t.beneficiary}",${t.invoiceAmount},"${t.taxType}",${t.rate},${t.withholdingAmount},"${t.depositStatus}","${t.treasuryChallanNo}"`,
          ),
        )
        .join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${selectedReport}_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <PageContainer>
      <PageHead
        title="Other Reports & Statutory Registers"
        subtitle="VAT 9.1 Register, AIT/TDS withholding reports, audit journals, and analytical center summaries"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleExportCSV}>
              <Download className="mr-1.5 size-3.5" /> Export Excel / CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              <Printer className="mr-1.5 size-3.5" /> Print Layout
            </Button>
          </div>
        }
      />

      {/* Report Selector Ribbon */}
      <Card className="mt-4 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 text-xs">
          <div>
            <label className="mb-1 block font-medium text-ink">Statutory Report Type *</label>
            <select
              value={selectedReport}
              onChange={(e) => setSelectedReport(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface p-2 text-xs font-semibold text-ink outline-none focus:border-primary"
            >
              <option value="vat_register">VAT Register (Mushak 9.1)</option>
              <option value="ait_tds">AIT / TDS Withholding Summary</option>
              <option value="ait_month">AIT / TDS Month-Wise Breakdown</option>
              <option value="ait_details">AIT / TDS Certificate Register</option>
              <option value="expense_summary">Expense Category Summary</option>
              <option value="bank_txn">Bank Transactions Audit Report</option>
              <option value="cheque_reg">Cheque Clearance Register</option>
              <option value="cash_bank_bal">Cash & Bank Balances</option>
              <option value="ar_ap_aging">Receivables & Payables Aging</option>
              <option value="budget_util">Budget Utilization Performance</option>
              <option value="cost_center">Cost Center-Wise Financial Report</option>
              <option value="jv_audit">Journal Voucher Audit Register</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block font-medium text-ink">Office Scope</label>
            <select
              value={selectedOffice}
              onChange={(e) => setSelectedOffice(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
            >
              <option value="all">All Offices & Branches</option>
              <option value="hq">Dhaka Corporate HQ</option>
              <option value="ctg">Chittagong Plant</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block font-medium text-ink">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="mb-1 block font-medium text-ink">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="mb-1 block font-medium text-ink">Standard Tax / VAT Code</label>
            <select
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
            >
              <option value="15">NBR Standard VAT (15%)</option>
              <option value="10">Consultancy / Service TDS (10%)</option>
              <option value="5">Supply Contract TDS (5%)</option>
              <option value="3">Special Commercial Rate (3%)</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Report Content Body */}
      <Card className="mt-4 p-6">
        <div className="border-b border-line pb-4 text-center">
          <h2 className="text-base font-bold text-ink uppercase tracking-wide">
            BridgeOne Industrial Solutions Ltd
          </h2>
          <p className="text-sm font-semibold text-primary">
            {selectedReport === "vat_register" && "National Board of Revenue (NBR) — VAT Register"}
            {selectedReport === "ait_tds" && "Advance Income Tax (AIT) / TDS Withholding Register"}
            {selectedReport === "ait_month" && "AIT / TDS Monthly Statutory Tax Return"}
            {selectedReport === "expense_summary" && "Departmental Expense Summary Report"}
            {selectedReport === "budget_util" && "Annual Budget Utilization Variance Report"}
            {selectedReport === "cost_center" && "Cost Center Financial Performance Matrix"}
            {selectedReport === "jv_audit" && "Double-Entry General Journal Audit Trail"}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Period: {fromDate} to {toDate} • Regulatory Jurisdiction: Bangladesh NBR
          </p>
        </div>

        {/* 1. VAT & Tax Tables */}
        {(selectedReport === "vat_register" || selectedReport === "ait_tds" || selectedReport === "ait_month" || selectedReport === "ait_details") && (
          <div className="mt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-line bg-control/40 font-semibold text-ink">
                  <tr>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Voucher #</th>
                    <th className="px-4 py-2.5">Beneficiary / Vendor</th>
                    <th className="px-4 py-2.5 text-right">Invoice Amount (৳)</th>
                    <th className="px-4 py-2.5">Tax Category</th>
                    <th className="px-4 py-2.5 text-right">Rate</th>
                    <th className="px-4 py-2.5 text-right">Withholding (৳)</th>
                    <th className="px-4 py-2.5">Treasury Challan #</th>
                    <th className="px-4 py-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {taxTransactions.map((t) => (
                    <tr key={t.id} className="hover:bg-control/30">
                      <td className="px-4 py-2.5 text-ink-muted">{t.date}</td>
                      <td className="px-4 py-2.5 font-mono font-medium text-ink">{t.voucherNo}</td>
                      <td className="px-4 py-2.5 font-medium text-ink">{t.beneficiary}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-ink">৳{t.invoiceAmount.toLocaleString()}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="neutral">{t.taxType}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-ink">{t.rate}%</td>
                      <td className="px-4 py-2.5 text-right font-bold text-primary">
                        ৳{t.withholdingAmount.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-ink-muted">{t.treasuryChallanNo}</td>
                      <td className="px-4 py-2.5 text-center">
                        <Badge variant={t.depositStatus === "CHALLAN_DEPOSITED" ? "success" : "warning"}>
                          {t.depositStatus.replace("_", " ")}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-ink bg-control/50 text-xs font-bold text-ink">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-right">
                      Statutory Total:
                    </td>
                    <td className="px-4 py-3 text-right">
                      ৳{taxTransactions.reduce((s, t) => s + t.invoiceAmount, 0).toLocaleString()}
                    </td>
                    <td colSpan={2} />
                    <td className="px-4 py-3 text-right font-bold text-primary">
                      ৳{taxTransactions.reduce((s, t) => s + t.withholdingAmount, 0).toLocaleString()}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* 2. Budget Utilization Report */}
        {selectedReport === "budget_util" && (
          <div className="mt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-line bg-control/40 font-semibold text-ink">
                  <tr>
                    <th className="px-4 py-2.5">Budget Code</th>
                    <th className="px-4 py-2.5">Budget Title</th>
                    <th className="px-4 py-2.5">Cost Center</th>
                    <th className="px-4 py-2.5 text-right">Allocated (৳)</th>
                    <th className="px-4 py-2.5 text-right">Utilized (৳)</th>
                    <th className="px-4 py-2.5 text-right">Remaining (৳)</th>
                    <th className="px-4 py-2.5 text-right">Utilization %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {budgets.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-ink-faint">
                        No budget allocations recorded.
                      </td>
                    </tr>
                  ) : (
                    budgets.map((b) => {
                      const utilPercent = b.allocatedAmount > 0 ? (b.utilizedAmount / b.allocatedAmount) * 100 : 0;
                      return (
                        <tr key={b.id} className="hover:bg-control/30">
                          <td className="px-4 py-2.5 font-mono font-medium text-ink">{b.budgetCode}</td>
                          <td className="px-4 py-2.5 font-medium text-ink">{b.budgetName}</td>
                          <td className="px-4 py-2.5 text-ink-muted">{b.costCenterName}</td>
                          <td className="px-4 py-2.5 text-right text-ink">৳{b.allocatedAmount.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-right font-medium text-amber-600">
                            ৳{b.utilizedAmount.toLocaleString()}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-emerald-600">
                            ৳{b.remainingAmount.toLocaleString()}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-ink">
                            {utilPercent.toFixed(1)}%
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

        {/* 3. Cost Center Report */}
        {selectedReport === "cost_center" && (
          <div className="mt-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {costCenters.map((cc) => (
                <div key={cc.id} className="rounded-xl border border-line p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-ink">{cc.name}</h4>
                      <p className="text-xs text-ink-muted">{cc.officeName} • {cc.type}</p>
                    </div>
                    <Badge variant="neutral">{cc.code}</Badge>
                  </div>
                  <div className="mt-4 border-t border-line pt-3 text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-ink-muted">Allocated Budgets:</span>
                      <span className="font-semibold text-ink">
                        ৳{budgets.filter((b) => b.costCenterId === cc.id).reduce((s, b) => s + b.allocatedAmount, 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-muted">Active Headcount / Scope:</span>
                      <span className="text-ink">Executive Division</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. Journal Voucher Audit */}
        {selectedReport === "jv_audit" && (
          <div className="mt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-line bg-control/40 font-semibold text-ink">
                  <tr>
                    <th className="px-4 py-2.5">Voucher #</th>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Type</th>
                    <th className="px-4 py-2.5">Narration</th>
                    <th className="px-4 py-2.5 text-right">Total Debit (৳)</th>
                    <th className="px-4 py-2.5 text-right">Total Credit (৳)</th>
                    <th className="px-4 py-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {vouchers.map((v) => (
                    <tr key={v.id} className="hover:bg-control/30">
                      <td className="px-4 py-2.5 font-mono font-medium text-ink">{v.voucherNumber}</td>
                      <td className="px-4 py-2.5 text-ink-muted">{v.transactionDate}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="neutral">{v.journalType}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-ink">{v.narration}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-ink">৳{v.totalDebit.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-ink">৳{v.totalCredit.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-center">
                        <Badge variant={v.status === "POSTED" ? "success" : "neutral"}>{v.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
