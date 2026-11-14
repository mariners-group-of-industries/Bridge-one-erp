"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  ChevronDown,
  Download,
  Inbox,
  Printer,
} from "lucide-react";
import { useAccountingStore } from "@/features/accounts/store/accounting-store";
import { localToday } from "@/features/purchase/lib/client";

/** The first day of the current month, yyyy-mm-dd. */
const monthStart = () => `${localToday().slice(0, 8)}01`;

/** Report and ledger types as iBOS lists them. */
const REPORT_TYPES = ["Ledger", "Trial Balance", "Income Statement", "Balance Sheet", "Cash Flow"] as const;
const LEDGER_TYPES = [
  "General Ledger",
  "Bank Account",
  "Customer",
  "Supplier",
  "Loan Partner",
  "Loan Employee",
  "Inter Company Receivable",
  "Promoter",
  "Customer & Supplier[Both]",
  "Customer, Supplier, Customer & Supplier[Both] & Loan Partner",
  "Advance to Employee",
] as const;
/** Ledger types BridgeOne keeps no records for yet. */
const UNRECORDED_LEDGERS = new Set(["Loan Employee", "Inter Company Receivable", "Promoter"]);

interface PartyOption {
  id: string;
  code: string;
  name: string;
}
/** One row of any ledger: GL, bank, party, loan partner or employee advance. */
interface LedgerRow {
  date: string;
  voucherNumber: string;
  particulars: string;
  detail?: string;
  officeName?: string;
  debit: number;
  credit: number;
  balance: number;
}

/** Cash-flow section of the account on the other side of a cash or bank movement. */
function cashFlowSection(acc: { name: string; accountSubtype: string; accountType: string } | undefined): "Operating" | "Investing" | "Financing" {
  if (!acc) return "Operating";
  const text = `${acc.name} ${acc.accountSubtype}`;
  if (acc.accountType === "EQUITY") return "Financing";
  if (acc.accountType === "LIABILITY" && /loan|borrow|debenture|lease|overdraft/i.test(text)) return "Financing";
  if (acc.accountType === "ASSET" && /fixed|property|plant|equipment|non.?current|investment|land|building|vehicle|furniture|machinery/i.test(text)) return "Investing";
  return "Operating";
}
const isCashOrBank = (a: { accountType: string; isGroup: boolean; name: string; accountSubtype: string }) =>
  a.accountType === "ASSET" && !a.isGroup && /cash|bank/i.test(`${a.name} ${a.accountSubtype}`);

export default function FinancialReportsPage() {
  const accounts = useAccountingStore((s) => s.accounts);
  const getTrialBalance = useAccountingStore((s) => s.getTrialBalance);
  const getProfitAndLoss = useAccountingStore((s) => s.getProfitAndLoss);
  const getBalanceSheet = useAccountingStore((s) => s.getBalanceSheet);
  const getGeneralLedger = useAccountingStore((s) => s.getGeneralLedger);
  const offices = useAccountingStore((s) => s.offices);
  const vouchers = useAccountingStore((s) => s.vouchers);
  const bankAccounts = useAccountingStore((s) => s.bankAccounts);
  const advances = useAccountingStore((s) => s.advances);
  const loanPartners = useAccountingStore((s) => s.loanPartners);

  // Suppliers and customers for the party ledgers, loaded when such a ledger type is chosen.
  const [suppliers, setSuppliers] = useState<PartyOption[]>([]);
  const [customers, setCustomers] = useState<PartyOption[]>([]);

  // Filter States from Screenshot 3
  const [reportType, setReportType] = useState<string>("Ledger");
  const [selectedOffice, setSelectedOffice] = useState<string>("ALL");
  const [ledgerType, setLedgerType] = useState<string>("General Ledger");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>(monthStart);
  const [toDate, setToDate] = useState<string>(localToday);
  const [officeWise, setOfficeWise] = useState<boolean>(false);
  const [withoutDecimal, setWithoutDecimal] = useState<boolean>(false);

  // Active view state
  const [hasViewed, setHasViewed] = useState<boolean>(true);
  const [activeReport, setActiveReport] = useState<{
    reportType: string;
    office: string;
    ledgerType: string;
    accountId: string;
    fromDate: string;
    toDate: string;
    officeWise: boolean;
    withoutDecimal: boolean;
  }>({
    reportType: "Ledger",
    office: "ALL",
    ledgerType: "General Ledger",
    accountId: "",
    fromDate: monthStart(),
    toDate: localToday(),
    officeWise: false,
    withoutDecimal: false,
  });

  const handleView = () => {
    setActiveReport({
      reportType,
      office: selectedOffice,
      ledgerType,
      accountId: selectedAccountId,
      fromDate,
      toDate,
      officeWise,
      withoutDecimal,
    });
    setHasViewed(true);
  };

  // Format numbers helper
  const formatAmount = (val: number | undefined | null) => {
    if (val === undefined || val === null) return "0.00";
    if (activeReport.withoutDecimal) {
      return Math.round(val).toLocaleString();
    }
    return val.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const needsSuppliers = ["Supplier", "Customer & Supplier[Both]", "Customer, Supplier, Customer & Supplier[Both] & Loan Partner"].includes(ledgerType);
  const needsCustomers = ["Customer", "Customer & Supplier[Both]", "Customer, Supplier, Customer & Supplier[Both] & Loan Partner"].includes(ledgerType);
  useEffect(() => {
    let cancelled = false;
    const load = async (list: "SUPPLIER" | "CUSTOMER", set: (rows: PartyOption[]) => void) => {
      const res = await fetch(`/api/accounts/party-ledger?list=${list}`, { cache: "no-store" }).catch(() => null);
      const json = res && res.ok ? await res.json().catch(() => null) : null;
      if (!cancelled && json?.success) set(json.data as PartyOption[]);
    };
    if (needsSuppliers && suppliers.length === 0) void load("SUPPLIER", setSuppliers);
    if (needsCustomers && customers.length === 0) void load("CUSTOMER", setCustomers);
    return () => {
      cancelled = true;
    };
  }, [needsSuppliers, needsCustomers, suppliers.length, customers.length]);

  /** What the "Chart Of Account" box offers for the chosen ledger type; values are "KIND:id". */
  const choiceOptions = useMemo(() => {
    const both = ledgerType === "Customer & Supplier[Both]" || ledgerType.startsWith("Customer, Supplier");
    const partyOpts = (rows: PartyOption[], kind: string, tag: string) =>
      rows.map((r) => ({ value: `${kind}:${r.id}`, label: `${r.code} - ${r.name}${tag}` }));
    const partnerOpts = loanPartners.map((lp) => ({ value: `PARTNER:${lp.id}`, label: `${lp.partnerName} (Loan Partner)` }));
    switch (ledgerType) {
      case "General Ledger":
        return accounts.filter((a) => !a.isGroup).map((a) => ({ value: `GL:${a.id}`, label: `${a.code} - ${a.name}` }));
      case "Bank Account":
        return bankAccounts.map((b) => ({ value: `BANK:${b.id}`, label: `${b.bankName} - ${b.accountNumber}` }));
      case "Customer":
        return partyOpts(customers, "CUSTOMER", "");
      case "Supplier":
        return partyOpts(suppliers, "SUPPLIER", "");
      case "Loan Partner":
        return partnerOpts.map((o) => ({ ...o, label: o.label.replace(" (Loan Partner)", "") }));
      case "Advance to Employee":
        return [...new Set(advances.map((a) => a.employeeName).filter(Boolean))].sort().map((name) => ({ value: `EMPLOYEE:${name}`, label: name }));
      default:
        if (both) {
          return [
            ...partyOpts(customers, "CUSTOMER", " (Customer)"),
            ...partyOpts(suppliers, "SUPPLIER", " (Supplier)"),
            ...(ledgerType.startsWith("Customer, Supplier") ? partnerOpts : []),
          ];
        }
        return [];
    }
  }, [ledgerType, accounts, bankAccounts, customers, suppliers, loanPartners, advances]);
  const choicePlaceholder = UNRECORDED_LEDGERS.has(ledgerType)
    ? "Not recorded in BridgeOne yet"
    : ledgerType === "General Ledger"
      ? "Select Chart Of Account (all)"
      : `Select ${ledgerType}`;

  const [activeKind, activeId] = (() => {
    const i = activeReport.accountId.indexOf(":");
    return i < 0 ? ["", ""] : [activeReport.accountId.slice(0, i), activeReport.accountId.slice(i + 1)];
  })();

  // Supplier and customer ledgers come from the server; the result is kept with the request it answers.
  const partyKey =
    activeReport.reportType === "Ledger" && (activeKind === "SUPPLIER" || activeKind === "CUSTOMER")
      ? `${activeKind}|${activeId}|${activeReport.fromDate}|${activeReport.toDate}`
      : "";
  const [partyResult, setPartyResult] = useState<{ key: string; data: { opening: number; entries: LedgerRow[] } | null; error: string }>({ key: "", data: null, error: "" });
  useEffect(() => {
    if (!partyKey) return;
    let cancelled = false;
    const [type, partyId, fromDate, toDate] = partyKey.split("|");
    const q = new URLSearchParams({ type, partyId, fromDate, toDate });
    fetch(`/api/accounts/party-ledger?${q.toString()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (!json?.success) {
          setPartyResult({ key: partyKey, data: null, error: typeof json?.error === "string" ? json.error : json?.error?.message ?? "Could not load the ledger." });
          return;
        }
        setPartyResult({ key: partyKey, data: { opening: json.data.opening, entries: json.data.entries as LedgerRow[] }, error: "" });
      })
      .catch(() => !cancelled && setPartyResult({ key: partyKey, data: null, error: "Could not load the ledger." }));
    return () => {
      cancelled = true;
    };
  }, [partyKey]);
  const partyCurrent = partyKey !== "" && partyResult.key === partyKey;
  const partyLedger = partyCurrent ? partyResult.data : null;
  const partyLoading = partyKey !== "" && !partyCurrent;
  const partyError = partyCurrent ? partyResult.error : "";

  // Selected Account details
  const currentAccount = useMemo(() => {
    if (activeKind !== "GL") return null;
    return accounts.find((a) => a.id === activeId);
  }, [accounts, activeKind, activeId]);
  const choiceLabel = choiceOptions.find((o) => o.value === activeReport.accountId)?.label;

  // The ledger for the chosen ledger type, as rows with a running balance (debit minus credit).
  const { ledgerEntries, ledgerNote } = useMemo((): { ledgerEntries: LedgerRow[]; ledgerNote: string | null } => {
    const inPeriod = (d: string) => (!activeReport.fromDate || d >= activeReport.fromDate) && (!activeReport.toDate || d <= activeReport.toDate);
    const withBalance = (rows: Omit<LedgerRow, "balance">[], opening = 0) => {
      let bal = opening;
      return rows.map((r) => ({ ...r, balance: (bal += r.debit - r.credit) }));
    };
    const glRows = (accountId: string | undefined) => {
      const raw = getGeneralLedger(accountId, activeReport.fromDate, activeReport.toDate).filter(
        // Exact match: office names can share a prefix ("MG …").
        (r) => activeReport.office === "ALL" || r.officeName === activeReport.office,
      );
      return raw.map((g) => ({ date: g.date, voucherNumber: g.voucherNumber, particulars: g.narration || "General Journal Entry", detail: g.accountName, officeName: g.officeName, debit: g.debit, credit: g.credit, balance: g.runningBalance }));
    };

    if (UNRECORDED_LEDGERS.has(activeReport.ledgerType)) {
      return { ledgerEntries: [], ledgerNote: `${activeReport.ledgerType} balances are not recorded in BridgeOne yet.` };
    }
    if (activeReport.ledgerType === "General Ledger") return { ledgerEntries: glRows(activeKind === "GL" ? activeId : undefined), ledgerNote: null };
    if (!activeReport.accountId) return { ledgerEntries: [], ledgerNote: `Select the ${activeReport.ledgerType.toLowerCase()} and press View.` };

    switch (activeKind) {
      case "BANK": {
        const bank = bankAccounts.find((b) => b.id === activeId);
        if (!bank?.glAccountId) return { ledgerEntries: [], ledgerNote: "This bank account is not linked to a GL account. Link it under Finance & Banking." };
        return { ledgerEntries: glRows(bank.glAccountId), ledgerNote: null };
      }
      case "SUPPLIER":
      case "CUSTOMER":
        if (partyLoading) return { ledgerEntries: [], ledgerNote: "Loading…" };
        if (partyError) return { ledgerEntries: [], ledgerNote: partyError };
        return { ledgerEntries: partyLedger?.entries ?? [], ledgerNote: null };
      case "PARTNER": {
        const lp = loanPartners.find((x) => x.id === activeId);
        if (!lp) return { ledgerEntries: [], ledgerNote: null };
        const day = (lp.createdAt || "").slice(0, 10);
        const repaid = Math.max(0, (lp.principalFacility || 0) - (lp.outstanding || 0));
        const rows = inPeriod(day)
          ? [
              { date: day, voucherNumber: lp.accountType, particulars: "Facility received", detail: lp.group, officeName: lp.officeName, debit: 0, credit: lp.principalFacility || 0 },
              ...(repaid ? [{ date: day, voucherNumber: lp.accountType, particulars: "Repaid to date", detail: lp.group, officeName: lp.officeName, debit: repaid, credit: 0 }] : []),
            ]
          : [];
        return { ledgerEntries: withBalance(rows), ledgerNote: null };
      }
      case "EMPLOYEE": {
        const rows = advances
          .filter((a) => a.employeeName === activeId && inPeriod((a.date || "").slice(0, 10)))
          .filter((a) => activeReport.office === "ALL" || a.officeName === activeReport.office)
          .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
          .map((a) => ({ date: (a.date || "").slice(0, 10), voucherNumber: a.code || a.advanceNumber, particulars: a.purpose || "Advance", detail: `Adjusted ${(a.settledAmount || 0).toLocaleString()}`, officeName: a.officeName, debit: a.approvedAmount || 0, credit: a.settledAmount || 0 }));
        return { ledgerEntries: withBalance(rows), ledgerNote: null };
      }
      default:
        return { ledgerEntries: [], ledgerNote: null };
    }
  }, [getGeneralLedger, activeReport, activeKind, activeId, bankAccounts, partyLedger, partyLoading, partyError, loanPartners, advances]);

  // Cash flow: every movement of cash and bank accounts, by the account on the other side.
  const cashFlow = useMemo(() => {
    const cashIds = new Set(accounts.filter(isCashOrBank).map((a) => a.id));
    const byId = new Map(accounts.map((a) => [a.id, a]));
    const officeOk = (name: string) => activeReport.office === "ALL" || name === activeReport.office;
    let opening = accounts.filter(isCashOrBank).reduce((s2, a) => s2 + (a.openingBalance || 0), 0);
    const sections = { Operating: new Map<string, number>(), Investing: new Map<string, number>(), Financing: new Map<string, number>() };
    for (const v of vouchers) {
      if (v.status !== "POSTED" || !officeOk(v.officeName)) continue;
      const day = (v.transactionDate || "").slice(0, 10);
      const cashNet = v.lines.filter((l) => cashIds.has(l.accountId)).reduce((s2, l) => s2 + (l.debit || 0) - (l.credit || 0), 0);
      if (Math.abs(cashNet) < 0.005) continue;
      if (activeReport.fromDate && day < activeReport.fromDate) {
        opening += cashNet;
        continue;
      }
      if (activeReport.toDate && day > activeReport.toDate) continue;
      for (const l of v.lines) {
        if (cashIds.has(l.accountId)) continue;
        const acc = byId.get(l.accountId);
        const map = sections[cashFlowSection(acc)];
        const key = acc ? `${acc.code} - ${acc.name}` : l.accountName;
        map.set(key, (map.get(key) ?? 0) + (l.credit || 0) - (l.debit || 0));
      }
    }
    const list = (m: Map<string, number>) => [...m.entries()].filter(([, a]) => Math.abs(a) >= 0.005).map(([name, amount]) => ({ name, amount })).sort((a, b) => a.name.localeCompare(b.name));
    const out = (["Operating", "Investing", "Financing"] as const).map((k) => {
      const items = list(sections[k]);
      return { title: `Cash flow from ${k.toLowerCase()} activities`, items, total: items.reduce((s2, i) => s2 + i.amount, 0) };
    });
    const net = out.reduce((s2, x) => s2 + x.total, 0);
    return { opening, sections: out, net, closing: opening + net };
  }, [accounts, vouchers, activeReport]);

  const totalDebit = useMemo(
    () => ledgerEntries.reduce((sum, r) => sum + r.debit, 0),
    [ledgerEntries],
  );
  const totalCredit = useMemo(
    () => ledgerEntries.reduce((sum, r) => sum + r.credit, 0),
    [ledgerEntries],
  );

  // Trial Balance Data
  const tbData = useMemo(() => getTrialBalance(), [getTrialBalance]);

  // Profit & Loss Data
  const plData = useMemo(
    () => getProfitAndLoss(activeReport.fromDate, activeReport.toDate),
    [getProfitAndLoss, activeReport.fromDate, activeReport.toDate],
  );

  // Balance Sheet Data
  const bsData = useMemo(() => getBalanceSheet(), [getBalanceSheet]);

  const handleExportCSV = () => {
    let rows: string[] = [];
    if (activeReport.reportType === "Ledger") {
      rows = ["Date,Voucher No,Particulars,Detail,Office,Debit,Credit,Balance"].concat(
        ledgerEntries.map(
          (g) => `"${g.date}","${g.voucherNumber}","${g.particulars.replace(/"/g, '""')}","${(g.detail ?? "").replace(/"/g, '""')}","${g.officeName ?? ""}",${g.debit},${g.credit},${g.balance}`,
        ),
      );
    } else if (activeReport.reportType === "Cash Flow") {
      rows = ["Section,Account,Amount", `"Opening cash & bank","",${cashFlow.opening}`]
        .concat(cashFlow.sections.flatMap((sec) => sec.items.map((i) => `"${sec.title}","${i.name}",${i.amount}`)))
        .concat([`"Closing cash & bank","",${cashFlow.closing}`]);
    } else if (activeReport.reportType === "Trial Balance") {
      rows = ["Code,Name,Type,Debit,Credit"].concat(
        tbData.rows.map(
          (r) => `"${r.code}","${r.name}","${r.type}",${r.debit},${r.credit}`,
        ),
      );
    } else if (activeReport.reportType === "Income Statement") {
      rows = ["Class,Account,Amount"]
        .concat(plData.revenues.map((r) => `"Revenue","${r.name}",${r.amount}`))
        .concat(plData.expenses.map((e) => `"Expense","${e.name}",${e.amount}`));
    } else {
      rows = ["Category,Title,Amount"]
        .concat(bsData.assets.map((a) => `"Asset","${a.name}",${a.amount}`))
        .concat(bsData.liabilities.map((l) => `"Liability","${l.name}",${l.amount}`))
        .concat(bsData.equity.map((e) => `"Equity","${e.name}",${e.amount}`));
    }

    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeReport.reportType.toLowerCase().replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans pb-16">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP TAB BAR */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-4 flex items-center">
          <div className="relative pb-2.5 pt-2 px-4 text-[13px] font-semibold text-[#2563eb] cursor-pointer">
            Financial Report
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#2563eb]" />
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. FILTER BAR (Matching Screenshot 3) */}
      {/* ------------------------------------------------------------- */}
      <div className="px-4 py-3 bg-white border-b border-slate-200/90 shadow-2xs space-y-2.5">
        {/* Top Dropdowns Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-2.5 text-xs">
          {/* Report Type */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Report Type
            </label>
            <div className="relative">
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="w-full h-8 px-2.5 pr-7 border border-slate-300 rounded text-xs bg-white text-slate-800 appearance-none focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
              >
                {REPORT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Office */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Office</label>
            <div className="relative">
              <select
                value={selectedOffice}
                onChange={(e) => setSelectedOffice(e.target.value)}
                className="w-full h-8 px-2.5 pr-7 border border-slate-300 rounded text-xs bg-white text-slate-800 appearance-none focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
              >
                <option value="ALL">ALL</option>
                {offices.map((o) => (
                  <option key={o.id} value={o.name}>
                    {o.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Ledger Type with Red Asterisk */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              <span className="text-rose-500 font-bold">* </span>Ledger Type
            </label>
            <div className="relative">
              <select
                value={ledgerType}
                onChange={(e) => {
                  setLedgerType(e.target.value);
                  setSelectedAccountId("");
                }}
                className="w-full h-8 px-2.5 pr-7 border border-slate-300 rounded text-xs bg-white text-slate-800 appearance-none focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
              >
                {LEDGER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Chart Of Account */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Chart Of Account
            </label>
            <div className="relative">
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                disabled={UNRECORDED_LEDGERS.has(ledgerType) || reportType !== "Ledger"}
                className="w-full h-8 px-2.5 pr-7 border border-slate-300 rounded text-xs bg-white text-slate-800 appearance-none disabled:bg-slate-50 disabled:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
              >
                <option value="">{choicePlaceholder}</option>
                {choiceOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* From Date */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
            />
          </div>

          {/* To Date */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full h-8 px-2.5 border border-slate-300 rounded text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
            />
          </div>
        </div>

        {/* Checkboxes & View Button Row */}
        <div className="flex items-center gap-6 pt-1 text-xs">
          <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700">
            <input
              type="checkbox"
              checked={officeWise}
              onChange={(e) => setOfficeWise(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-slate-300 text-[#2563eb] focus:ring-[#2563eb]"
            />
            <span>Office Wise</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700">
            <input
              type="checkbox"
              checked={withoutDecimal}
              onChange={(e) => setWithoutDecimal(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-slate-300 text-[#2563eb] focus:ring-[#2563eb]"
            />
            <span>Without Decimal</span>
          </label>

          <button
            type="button"
            onClick={handleView}
            className="h-7 px-5 bg-[#2563eb] hover:bg-blue-700 text-white font-medium text-xs rounded transition shadow-2xs"
          >
            View
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. REPORT OUTPUT VIEW */}
      {/* ------------------------------------------------------------- */}
      <div className="px-4 mt-3">
        {hasViewed && (
          <div className="bg-white border border-slate-200 rounded shadow-2xs p-4 space-y-4">
            {/* Report Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-200 pb-3 gap-3">
              <div className="flex items-center gap-3">
                <div className="relative w-28 h-8">
                  <Image
                    src="/logo.png"
                    alt="Bridge One ERP"
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight">
                    {activeReport.reportType === "Ledger" ? `Ledger — ${activeReport.ledgerType}` : activeReport.reportType}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Period: <span className="font-medium text-slate-700">{activeReport.fromDate} to {activeReport.toDate}</span> • Office:{" "}
                    <span className="font-medium text-slate-700">{activeReport.office}</span>
                    {activeReport.reportType === "Ledger" && (currentAccount || choiceLabel) && (
                      <span> • <span className="font-semibold text-blue-600">{currentAccount ? `${currentAccount.code} - ${currentAccount.name}` : choiceLabel}</span></span>
                    )}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="h-8 px-3 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs rounded flex items-center gap-1.5 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="h-8 px-3 bg-slate-800 hover:bg-slate-900 text-white text-xs rounded flex items-center gap-1.5 transition"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
              </div>
            </div>

            {/* A. LEDGER TABLE */}
            {activeReport.reportType === "Ledger" && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-slate-200">
                  <thead className="bg-[#f8fafc] border-b border-slate-200 text-[11px] font-semibold text-slate-700">
                    <tr>
                      <th className="px-2.5 py-2 text-center w-12 border-r border-slate-200">SL</th>
                      <th className="px-3 py-2 border-r border-slate-200 w-24">Date</th>
                      <th className="px-3 py-2 border-r border-slate-200 w-32">Voucher No</th>
                      <th className="px-3 py-2 border-r border-slate-200">Particulars / Narration</th>
                      {activeReport.officeWise && (
                        <th className="px-3 py-2 border-r border-slate-200 w-32">Office</th>
                      )}
                      <th className="px-3 py-2 text-right border-r border-slate-200 w-28">Debit (৳)</th>
                      <th className="px-3 py-2 text-right border-r border-slate-200 w-28">Credit (৳)</th>
                      <th className="px-3 py-2 text-right w-32">Balance (৳)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {partyLedger && partyLedger.opening !== 0 && (
                      <tr className="bg-slate-50/70">
                        <td colSpan={activeReport.officeWise ? 7 : 6} className="px-3 py-2 text-right text-[11px] font-semibold uppercase text-slate-600">
                          Opening balance
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-slate-900 whitespace-nowrap">{formatAmount(partyLedger.opening)}</td>
                      </tr>
                    )}
                    {ledgerEntries.length === 0 ? (
                      <tr>
                        <td colSpan={activeReport.officeWise ? 8 : 7} className="py-16 text-center text-slate-400">
                          <Inbox className="w-6 h-6 mx-auto mb-1 stroke-[1.5] text-slate-300" />
                          <span>{ledgerNote ?? "No transaction records found for the selected period."}</span>
                        </td>
                      </tr>
                    ) : (
                      ledgerEntries.map((entry, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/70">
                          <td className="px-2.5 py-2 text-center text-slate-500 border-r border-slate-200/70">
                            {idx + 1}
                          </td>
                          <td className="px-3 py-2 text-slate-700 border-r border-slate-200/70 whitespace-nowrap">
                            {entry.date}
                          </td>
                          <td className="px-3 py-2 font-mono font-medium text-blue-600 border-r border-slate-200/70 whitespace-nowrap">
                            {entry.voucherNumber}
                          </td>
                          <td className="px-3 py-2 border-r border-slate-200/70">
                            <div className="font-medium text-slate-800">{entry.particulars}</div>
                            {entry.detail && <div className="text-[10px] text-slate-400 font-mono">{entry.detail}</div>}
                          </td>
                          {activeReport.officeWise && (
                            <td className="px-3 py-2 text-slate-600 border-r border-slate-200/70 text-[11px]">
                              {entry.officeName}
                            </td>
                          )}
                          <td className="px-3 py-2 text-right font-medium text-slate-900 border-r border-slate-200/70 whitespace-nowrap">
                            {entry.debit > 0 ? formatAmount(entry.debit) : "—"}
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-slate-900 border-r border-slate-200/70 whitespace-nowrap">
                            {entry.credit > 0 ? formatAmount(entry.credit) : "—"}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-slate-900 whitespace-nowrap">
                            {formatAmount(entry.balance)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {ledgerEntries.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-50 font-bold border-t-2 border-slate-300 text-slate-900">
                        <td
                          colSpan={activeReport.officeWise ? 5 : 4}
                          className="px-3 py-2.5 text-right uppercase text-[11px] tracking-wider"
                        >
                          Period Totals:
                        </td>
                        <td className="px-3 py-2.5 text-right border-r border-slate-200">
                          ৳{formatAmount(totalDebit)}
                        </td>
                        <td className="px-3 py-2.5 text-right border-r border-slate-200">
                          ৳{formatAmount(totalCredit)}
                        </td>
                        <td className="px-3 py-2.5 text-right text-blue-700">
                          ৳{formatAmount(totalDebit - totalCredit)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}

            {/* B. TRIAL BALANCE TABLE */}
            {activeReport.reportType === "Trial Balance" && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-slate-200">
                  <thead className="bg-[#f8fafc] border-b border-slate-200 text-[11px] font-semibold text-slate-700">
                    <tr>
                      <th className="px-3 py-2 w-28 border-r border-slate-200">Account Code</th>
                      <th className="px-3 py-2 border-r border-slate-200">Account Head</th>
                      <th className="px-3 py-2 border-r border-slate-200 w-32">Classification</th>
                      <th className="px-3 py-2 text-right border-r border-slate-200 w-36">Debit (৳)</th>
                      <th className="px-3 py-2 text-right w-36">Credit (৳)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tbData.rows.map((row) => (
                      <tr key={row.code} className="hover:bg-slate-50/70">
                        <td className="px-3 py-2 font-mono text-blue-600 font-semibold border-r border-slate-200/70">
                          {row.code}
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-800 border-r border-slate-200/70">
                          {row.name}
                        </td>
                        <td className="px-3 py-2 text-slate-500 border-r border-slate-200/70 text-[11px]">
                          {row.type}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-slate-900 border-r border-slate-200/70">
                          {row.debit > 0 ? formatAmount(row.debit) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-slate-900">
                          {row.credit > 0 ? formatAmount(row.credit) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 font-bold border-t-2 border-slate-300 text-slate-900">
                      <td colSpan={3} className="px-3 py-2.5 text-right uppercase text-[11px]">
                        Total:
                      </td>
                      <td className="px-3 py-2.5 text-right border-r border-slate-200">
                        ৳{formatAmount(tbData.totalDebit)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        ৳{formatAmount(tbData.totalCredit)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* C. PROFIT & LOSS / BALANCE SHEET */}
            {(activeReport.reportType === "Income Statement" || activeReport.reportType === "Balance Sheet") && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded p-3 bg-slate-50/50">
                  <h4 className="font-bold text-xs text-slate-800 border-b border-slate-200 pb-2 mb-2">
                    {activeReport.reportType === "Income Statement" ? "Operating Revenues" : "Assets"}
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    {(activeReport.reportType === "Income Statement" ? plData.revenues : bsData.assets).map(
                      (item, i) => (
                        <div key={i} className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-700">{item.name}</span>
                          <span className="font-semibold text-slate-900">৳{formatAmount(item.amount)}</span>
                        </div>
                      ),
                    )}
                  </div>
                </div>

                <div className="border border-slate-200 rounded p-3 bg-slate-50/50">
                  <h4 className="font-bold text-xs text-slate-800 border-b border-slate-200 pb-2 mb-2">
                    {activeReport.reportType === "Income Statement" ? "Operating Expenses" : "Liabilities & Equity"}
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    {(activeReport.reportType === "Income Statement" ? plData.expenses : [...bsData.liabilities, ...bsData.equity]).map(
                      (item, i) => (
                        <div key={i} className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-700">{item.name}</span>
                          <span className="font-semibold text-slate-900">৳{formatAmount(item.amount)}</span>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </div>
            )}
            {/* D. CASH FLOW */}
            {activeReport.reportType === "Cash Flow" && (
              <div className="border border-slate-200 rounded p-3 bg-slate-50/50 text-xs space-y-3">
                <div className="flex justify-between font-semibold text-slate-800 border-b border-slate-200 pb-2">
                  <span>Opening cash &amp; bank balance</span>
                  <span>৳{formatAmount(cashFlow.opening)}</span>
                </div>
                {cashFlow.sections.map((sec) => (
                  <div key={sec.title}>
                    <h4 className="font-bold text-slate-800 mb-1">{sec.title}</h4>
                    {sec.items.length === 0 ? (
                      <p className="py-1 text-slate-400">No movements.</p>
                    ) : (
                      sec.items.map((i) => (
                        <div key={i.name} className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-700">{i.name}</span>
                          <span className={`font-semibold ${i.amount < 0 ? "text-rose-600" : "text-slate-900"}`}>৳{formatAmount(i.amount)}</span>
                        </div>
                      ))
                    )}
                    <div className="flex justify-between py-1 font-semibold text-slate-800">
                      <span>Net {sec.title.toLowerCase()}</span>
                      <span>৳{formatAmount(sec.total)}</span>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between font-bold text-slate-900 border-t-2 border-slate-300 pt-2">
                  <span>Closing cash &amp; bank balance</span>
                  <span>৳{formatAmount(cashFlow.closing)}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
