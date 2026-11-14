import type { Prisma, PrismaClient } from "@/generated/prisma/client";

type DbClient = PrismaClient | Prisma.TransactionClient;

export interface StandardCoaSeedNode {
  code: string;
  name: string;
  parentCode: string | null;
  accountType: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
  accountSubtype: string;
  tierLevel: "Group" | "Class" | "Category" | "GL";
  normalBalance: "DEBIT" | "CREDIT";
  isGroup: boolean;
}

/**
 * Standard hierarchical Chart of Accounts structure (Group -> Class -> Category -> GL)
 * matching the corporate accounting structure without disturbing existing GL accounts.
 */
export const STANDARD_COA_NODES: StandardCoaSeedNode[] = [
  // 1 - Current Assets
  { code: "1", name: "Current Assets", parentCode: null, accountType: "ASSET", accountSubtype: "CURRENT_ASSET", tierLevel: "Group", normalBalance: "DEBIT", isGroup: true },
  { code: "101", name: "Cash And Cash Equivalent", parentCode: "1", accountType: "ASSET", accountSubtype: "CURRENT_ASSET", tierLevel: "Class", normalBalance: "DEBIT", isGroup: true },
  { code: "10101", name: "Cash Account", parentCode: "101", accountType: "ASSET", accountSubtype: "CASH_IN_HAND", tierLevel: "Category", normalBalance: "DEBIT", isGroup: true },
  { code: "10101001", name: "Cash In Hand", parentCode: "10101", accountType: "ASSET", accountSubtype: "CASH_IN_HAND", tierLevel: "GL", normalBalance: "DEBIT", isGroup: false },
  { code: "10102", name: "Cash At Bank", parentCode: "101", accountType: "ASSET", accountSubtype: "CASH_AT_BANK", tierLevel: "Category", normalBalance: "DEBIT", isGroup: true },
  { code: "102", name: "Accounts Receivable", parentCode: "1", accountType: "ASSET", accountSubtype: "ACCOUNTS_RECEIVABLE", tierLevel: "Class", normalBalance: "DEBIT", isGroup: true },
  { code: "10201", name: "Trade Receivables", parentCode: "102", accountType: "ASSET", accountSubtype: "ACCOUNTS_RECEIVABLE", tierLevel: "Category", normalBalance: "DEBIT", isGroup: true },
  { code: "103", name: "Inventory", parentCode: "1", accountType: "ASSET", accountSubtype: "INVENTORY", tierLevel: "Class", normalBalance: "DEBIT", isGroup: true },
  { code: "10301", name: "Inventory & Stores", parentCode: "103", accountType: "ASSET", accountSubtype: "INVENTORY", tierLevel: "Category", normalBalance: "DEBIT", isGroup: true },
  { code: "105", name: "Advance, Deposits & Pre-Payments", parentCode: "1", accountType: "ASSET", accountSubtype: "ADVANCE_PREPAYMENT", tierLevel: "Class", normalBalance: "DEBIT", isGroup: true },
  { code: "10501", name: "Employee & Supplier Advances", parentCode: "105", accountType: "ASSET", accountSubtype: "ADVANCE_PREPAYMENT", tierLevel: "GL", normalBalance: "DEBIT", isGroup: false },

  // 2 - Non-Current Assets
  { code: "2", name: "Non-Current Assets", parentCode: null, accountType: "ASSET", accountSubtype: "NON_CURRENT_ASSET", tierLevel: "Group", normalBalance: "DEBIT", isGroup: true },
  { code: "201", name: "Property, Plant & Equipment", parentCode: "2", accountType: "ASSET", accountSubtype: "FIXED_ASSET", tierLevel: "Class", normalBalance: "DEBIT", isGroup: true },
  { code: "20101", name: "Machinery & Equipment", parentCode: "201", accountType: "ASSET", accountSubtype: "FIXED_ASSET", tierLevel: "Category", normalBalance: "DEBIT", isGroup: true },

  // 3 - Current Liabilities
  { code: "3", name: "Current Liabilities", parentCode: null, accountType: "LIABILITY", accountSubtype: "CURRENT_LIABILITY", tierLevel: "Group", normalBalance: "CREDIT", isGroup: true },
  { code: "301", name: "Accounts Payable", parentCode: "3", accountType: "LIABILITY", accountSubtype: "ACCOUNTS_PAYABLE", tierLevel: "Class", normalBalance: "CREDIT", isGroup: true },
  { code: "30101", name: "Trade Suppliers Payable", parentCode: "301", accountType: "LIABILITY", accountSubtype: "ACCOUNTS_PAYABLE", tierLevel: "Category", normalBalance: "CREDIT", isGroup: true },
  { code: "302", name: "Tax & VAT Payable", parentCode: "3", accountType: "LIABILITY", accountSubtype: "TAX_PAYABLE", tierLevel: "Class", normalBalance: "CREDIT", isGroup: true },
  { code: "30201", name: "VAT & Withholding Tax", parentCode: "302", accountType: "LIABILITY", accountSubtype: "TAX_PAYABLE", tierLevel: "GL", normalBalance: "CREDIT", isGroup: false },
  { code: "303", name: "Payables, Provision And Accruals", parentCode: "3", accountType: "LIABILITY", accountSubtype: "ACCRUED_LIABILITY", tierLevel: "Class", normalBalance: "CREDIT", isGroup: true },
  { code: "30301", name: "Salary & Utility Provisions", parentCode: "303", accountType: "LIABILITY", accountSubtype: "ACCRUED_LIABILITY", tierLevel: "GL", normalBalance: "CREDIT", isGroup: false },

  // 4 - Non-Current Liabilities
  { code: "4", name: "Non-Current Liabilities", parentCode: null, accountType: "LIABILITY", accountSubtype: "NON_CURRENT_LIABILITY", tierLevel: "Group", normalBalance: "CREDIT", isGroup: true },
  { code: "401", name: "Long Term Borrowings", parentCode: "4", accountType: "LIABILITY", accountSubtype: "LONG_TERM_LOAN", tierLevel: "Class", normalBalance: "CREDIT", isGroup: true },
  { code: "40101", name: "Term Bank Loan", parentCode: "401", accountType: "LIABILITY", accountSubtype: "LONG_TERM_LOAN", tierLevel: "GL", normalBalance: "CREDIT", isGroup: false },

  // 5 - Equity
  { code: "5", name: "Equity", parentCode: null, accountType: "EQUITY", accountSubtype: "EQUITY", tierLevel: "Group", normalBalance: "CREDIT", isGroup: true },
  { code: "501", name: "Share Capital & Reserves", parentCode: "5", accountType: "EQUITY", accountSubtype: "CAPITAL", tierLevel: "Class", normalBalance: "CREDIT", isGroup: true },
  { code: "50101", name: "Paid-Up Capital", parentCode: "501", accountType: "EQUITY", accountSubtype: "CAPITAL", tierLevel: "Category", normalBalance: "CREDIT", isGroup: true },
  { code: "502", name: "Retained Earnings", parentCode: "5", accountType: "EQUITY", accountSubtype: "RETAINED_EARNINGS", tierLevel: "Class", normalBalance: "CREDIT", isGroup: true },

  // 6 - Income
  { code: "6", name: "Income", parentCode: null, accountType: "REVENUE", accountSubtype: "OPERATING_INCOME", tierLevel: "Group", normalBalance: "CREDIT", isGroup: true },
  { code: "601", name: "Operating Revenue", parentCode: "6", accountType: "REVENUE", accountSubtype: "SALES_REVENUE", tierLevel: "Class", normalBalance: "CREDIT", isGroup: true },
  { code: "60101", name: "Product Sales Revenue", parentCode: "601", accountType: "REVENUE", accountSubtype: "SALES_REVENUE", tierLevel: "Category", normalBalance: "CREDIT", isGroup: true },
  { code: "602", name: "Other Income", parentCode: "6", accountType: "REVENUE", accountSubtype: "OTHER_INCOME", tierLevel: "Class", normalBalance: "CREDIT", isGroup: true },
  { code: "60201", name: "Miscellaneous Income", parentCode: "602", accountType: "REVENUE", accountSubtype: "OTHER_INCOME", tierLevel: "GL", normalBalance: "CREDIT", isGroup: false },

  // 7 - Cost Of Sales
  { code: "7", name: "Cost Of Sales", parentCode: null, accountType: "EXPENSE", accountSubtype: "COGS", tierLevel: "Group", normalBalance: "DEBIT", isGroup: true },
  { code: "701", name: "Direct Material & Production Cost", parentCode: "7", accountType: "EXPENSE", accountSubtype: "COGS", tierLevel: "Class", normalBalance: "DEBIT", isGroup: true },
  { code: "70101", name: "Direct Purchases & COGS", parentCode: "701", accountType: "EXPENSE", accountSubtype: "COGS", tierLevel: "Category", normalBalance: "DEBIT", isGroup: true },

  // 8 - Expense
  { code: "8", name: "Expense", parentCode: null, accountType: "EXPENSE", accountSubtype: "OPERATING_EXPENSE", tierLevel: "Group", normalBalance: "DEBIT", isGroup: true },
  { code: "801", name: "Administrative & Operating Expenses", parentCode: "8", accountType: "EXPENSE", accountSubtype: "OPERATING_EXPENSE", tierLevel: "Class", normalBalance: "DEBIT", isGroup: true },
  { code: "80101", name: "General Operating Expenses", parentCode: "801", accountType: "EXPENSE", accountSubtype: "OPERATING_EXPENSE", tierLevel: "Category", normalBalance: "DEBIT", isGroup: true },
  { code: "80101001", name: "Administrative & Operating Expense", parentCode: "80101", accountType: "EXPENSE", accountSubtype: "OPERATING_EXPENSE", tierLevel: "GL", normalBalance: "DEBIT", isGroup: false },
];

function inferParentForLegacyAccount(acc: { code: string; name: string; accountType: string; accountSubtype: string }): string | null {
  const nameLower = acc.name.toLowerCase();
  const code = acc.code;
  if (["1", "2", "3", "4", "5", "6", "7", "8"].includes(code)) return null;

  if (acc.accountType === "ASSET") {
    if (nameLower.includes("bank") || code === "1120") return "10102";
    if (nameLower.includes("cash") || nameLower.includes("transit") || code === "1110" || code === "1150") return "10101";
    if (nameLower.includes("receivable") || code === "1210") return "10201";
    if (nameLower.includes("inventory") || nameLower.includes("stock") || code === "1310") return "10301";
    if (nameLower.includes("advance") || nameLower.includes("deposit")) return "105";
    if (nameLower.includes("fixed") || nameLower.includes("equipment") || nameLower.includes("machinery") || code.startsWith("2")) return "20101";
    return "1";
  }
  if (acc.accountType === "LIABILITY") {
    if (nameLower.includes("vat") || nameLower.includes("tax")) return "302";
    if (nameLower.includes("loan") || acc.accountSubtype.includes("NON_CURRENT")) return "401";
    if (nameLower.includes("provision") || nameLower.includes("accrual")) return "303";
    if (nameLower.includes("payable") || code === "2110") return "30101";
    return "3";
  }
  if (acc.accountType === "EQUITY") {
    if (nameLower.includes("retained")) return "502";
    return "50101";
  }
  if (acc.accountType === "REVENUE") {
    if (nameLower.includes("other")) return "602";
    return "60101";
  }
  if (acc.accountType === "EXPENSE") {
    if (nameLower.includes("cost of goods") || nameLower.includes("cogs") || code === "5100") return "70101";
    return "80101";
  }
  return null;
}

/**
 * Ensures the standard 8-root hierarchy exists in DB and links any orphaned
 * top-level legacy GL rows into their proper Category without altering existing IDs or balances.
 */
export async function ensureStandardCoaHierarchy(prisma: DbClient) {
  await prisma.account.createMany({
    data: STANDARD_COA_NODES.map((n) => ({
      code: n.code,
      name: n.name,
      parentCode: n.parentCode,
      accountType: n.accountType,
      accountSubtype: n.accountSubtype,
      tierLevel: n.tierLevel,
      normalBalance: n.normalBalance,
      isGroup: n.isGroup,
      openingBalance: 0,
      currentBalance: 0,
      currency: "BDT",
      status: "ACTIVE",
    })),
    skipDuplicates: true,
  });

  const roots = new Set(["1", "2", "3", "4", "5", "6", "7", "8"]);
  const existingOrphans = await prisma.account.findMany({
    where: { parentCode: null },
    select: { id: true, code: true, name: true, accountType: true, accountSubtype: true, isGroup: true },
  });

  for (const acc of existingOrphans) {
    if (roots.has(acc.code) || acc.isGroup) continue;
    const parentCode = inferParentForLegacyAccount(acc);
    if (parentCode) {
      await prisma.account.update({
        where: { id: acc.id },
        data: { parentCode, tierLevel: "GL" },
      });
    }
  }
}

export interface VoucherLineInput {
  accountId?: string | null;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  narration?: string | null;
  costCenterId?: string | null;
}

export interface PostVoucherInput {
  voucherNumber?: string;
  transactionDate: Date;
  officeId?: string | null;
  officeName?: string | null;
  fiscalYear?: string;
  journalType: string;
  transType?: string | null;
  narration: string;
  referenceNumber?: string | null;
  status?: "DRAFT" | "PENDING_APPROVAL" | "POSTED";
  createdBy: string;
  approvedBy?: string | null;
  lines: VoucherLineInput[];
}

export function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/**
 * Creates a JournalVoucher inside a DB transaction and, when status === "POSTED",
 * atomically updates each touched GL Account's currentBalance.
 */
export async function createVoucherInTx(tx: Prisma.TransactionClient, input: PostVoucherInput) {
  const totalDebit = round2(input.lines.reduce((s, l) => s + Number(l.debit || 0), 0));
  const totalCredit = round2(input.lines.reduce((s, l) => s + Number(l.credit || 0), 0));

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Journal voucher is unbalanced: Debit ${totalDebit.toFixed(2)} != Credit ${totalCredit.toFixed(2)}.`);
  }
  if (totalDebit <= 0 || input.lines.length < 2) {
    throw new Error("Journal voucher requires at least two balanced non-zero lines.");
  }

  const voucherNumber =
    input.voucherNumber ||
    `${input.journalType.slice(0, 2).toUpperCase()}-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  const status = input.status || "POSTED";

  // Resolve accountIds cleanly if only accountCode is provided
  const resolvedLines = await Promise.all(
    input.lines.map(async (line, idx) => {
      let accountId = line.accountId || null;
      let accountCode = line.accountCode;
      let accountName = line.accountName;
      if (!accountId && accountCode) {
        const found = await tx.account.findUnique({
          where: { code: accountCode },
          select: { id: true, code: true, name: true },
        });
        if (found) {
          accountId = found.id;
          accountCode = found.code;
          accountName = found.name;
        }
      } else if (accountId) {
        const found = await tx.account.findUnique({
          where: { id: accountId },
          select: { id: true, code: true, name: true },
        });
        if (found) {
          accountCode = found.code;
          accountName = found.name;
        }
      }
      return {
        lineNo: idx + 1,
        accountId,
        accountCode,
        accountName,
        costCenterId: line.costCenterId || null,
        narration: line.narration || null,
        debit: round2(line.debit),
        credit: round2(line.credit),
      };
    })
  );

  const voucher = await tx.journalVoucher.create({
    data: {
      voucherNumber,
      transactionDate: input.transactionDate,
      officeId: input.officeId || null,
      officeName: input.officeName || "Corporate HO",
      fiscalYear: input.fiscalYear || `${input.transactionDate.getUTCFullYear()}-${input.transactionDate.getUTCFullYear() + 1}`,
      journalType: input.journalType,
      transType: input.transType || null,
      narration: input.narration,
      referenceNumber: input.referenceNumber || null,
      totalDebit,
      totalCredit,
      amount: totalDebit,
      status,
      createdBy: input.createdBy,
      preparedBy: input.createdBy,
      approvedBy: status === "POSTED" ? input.approvedBy || input.createdBy : null,
      postedAt: status === "POSTED" ? new Date() : null,
      lines: { create: resolvedLines },
    },
    include: { lines: true },
  });

  if (status === "POSTED") {
    await applyVoucherLinesToAccounts(tx, voucher.lines, 1);
  }

  return voucher;
}

/**
 * Applies (+1) or reverses (-1) posted journal lines against Account.currentBalance.
 */
export async function applyVoucherLinesToAccounts(
  tx: Prisma.TransactionClient,
  lines: Array<{ accountId: string | null; debit: unknown; credit: unknown }>,
  direction: 1 | -1
) {
  for (const line of lines) {
    if (!line.accountId) continue;
    const acc = await tx.account.findUnique({
      where: { id: line.accountId },
      select: { id: true, normalBalance: true, currentBalance: true },
    });
    if (!acc) continue;
    const debit = Number(line.debit || 0);
    const credit = Number(line.credit || 0);
    const netDelta = acc.normalBalance === "DEBIT" ? debit - credit : credit - debit;
    await tx.account.update({
      where: { id: acc.id },
      data: { currentBalance: round2(Number(acc.currentBalance) + netDelta * direction) },
    });
  }
}

export interface DashboardRatioRow {
  sl: string;
  ratioName: string;
  stdRatio: string;
  actRatio: string;
  metric: string;
  isSectionHeader?: boolean;
}

export interface DashboardResponseData {
  filters: {
    officeId: string;
    fromDate: string;
    toDate: string;
    year: number;
    offices: Array<{ id: string; name: string }>;
  };
  accountBalance: {
    accountsPayable: number;
    accountsReceivable: number;
  };
  incomeAndExpense: {
    cashInHand: number;
    income: number;
    cashAtBank: number;
    totalExpense: number;
  };
  cashAndEquivalent: {
    cashInHand: number;
    cashAtBank: number;
  };
  cashflow: {
    opening: number;
    closing: number;
    receive: number;
    payments: number;
  };
  ratios: DashboardRatioRow[];
  monthlyStatistics: Array<{
    month: string;
    income: number;
    expense: number;
    negativeExpense: number;
  }>;
}

function classifyGlAccount(acc: { code: string; name: string; accountType: string; accountSubtype: string }) {
  const name = acc.name.toLowerCase();
  const code = acc.code;
  const sub = acc.accountSubtype.toUpperCase();

  const isCashInHand =
    sub === "CASH_IN_HAND" ||
    code === "1110" ||
    code.startsWith("10101") ||
    (acc.accountType === "ASSET" && name.includes("cash in hand"));

  const isCashAtBank =
    sub === "CASH_AT_BANK" ||
    code === "1120" ||
    code.startsWith("10102") ||
    (acc.accountType === "ASSET" && (name.includes("cash at bank") || name.includes("bank")));

  const isReceivable =
    sub === "ACCOUNTS_RECEIVABLE" ||
    code === "1210" ||
    code.startsWith("102") ||
    (acc.accountType === "ASSET" && name.includes("receivable"));

  const isPayable =
    sub === "ACCOUNTS_PAYABLE" ||
    code === "2110" ||
    code.startsWith("301") ||
    (acc.accountType === "LIABILITY" && name.includes("payable"));

  const isInventory =
    sub === "INVENTORY" ||
    code === "1310" ||
    code.startsWith("103") ||
    (acc.accountType === "ASSET" && (name.includes("inventory") || name.includes("stock")));

  const isCogs =
    sub === "COGS" ||
    code === "5100" ||
    code.startsWith("7") ||
    name.includes("cost of goods") ||
    name.includes("cost of sales");

  const isCurrentAsset =
    acc.accountType === "ASSET" &&
    (sub.includes("CURRENT_ASSET") || sub === "CASH_IN_HAND" || sub === "CASH_AT_BANK" || sub === "ACCOUNTS_RECEIVABLE" || sub === "INVENTORY" || sub === "ADVANCE_PREPAYMENT" || code.startsWith("1")) &&
    !code.startsWith("2");

  const isCurrentLiability =
    acc.accountType === "LIABILITY" &&
    (sub.includes("CURRENT_LIABILITY") || sub === "ACCOUNTS_PAYABLE" || sub === "TAX_PAYABLE" || sub === "ACCRUED_LIABILITY" || code.startsWith("3") || code === "2110");

  return {
    isCashInHand,
    isCashAtBank,
    isReceivable,
    isPayable,
    isInventory,
    isCogs,
    isCurrentAsset,
    isCurrentLiability,
  };
}

function parseDateStart(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function parseDateEnd(iso: string): Date {
  return new Date(`${iso}T23:59:59.999Z`);
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Computes real PostgreSQL-backed KPIs, Financial Ratios, and Monthly Statistics
 * filtered by Office, From Date, To Date, and Chart Year.
 */
export async function computeAccountsDashboard(
  prisma: DbClient,
  params: { officeId?: string | null; fromDate?: string | null; toDate?: string | null; year?: number | null }
): Promise<DashboardResponseData> {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");

  const fromDate = params.fromDate || `${yyyy}-${mm}-01`;
  const toDate = params.toDate || `${yyyy}-${mm}-${dd}`;
  const year = params.year && Number.isFinite(params.year) ? params.year : Number(toDate.slice(0, 4)) || yyyy;
  const officeId = params.officeId && params.officeId !== "ALL" ? params.officeId : "ALL";

  const fromDt = parseDateStart(fromDate);
  const toDt = parseDateEnd(toDate);
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

  const officeFilter = officeId !== "ALL" ? { officeId } : {};

  const [offices, accounts, bankAccounts, vouchersToDate, yearVouchers] = await Promise.all([
    prisma.office.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.account.findMany({ where: { status: "ACTIVE" }, orderBy: { code: "asc" } }),
    prisma.bankAccount.findMany({ where: { isActive: true } }),
    prisma.journalVoucher.findMany({
      where: {
        status: "POSTED",
        ...officeFilter,
      },
      include: { lines: true },
      orderBy: { transactionDate: "asc" },
    }),
    prisma.journalVoucher.findMany({
      where: {
        status: "POSTED",
        ...officeFilter,
        transactionDate: { gte: yearStart, lte: yearEnd },
      },
      include: { lines: true },
    }),
  ]);

  const leafAccounts = accounts.filter((a) => !a.isGroup);
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const accountByCode = new Map(accounts.map((a) => [a.code, a]));

  const resolveLineAccount = (l: { accountId: string | null; accountCode: string }) =>
    (l.accountId ? accountById.get(l.accountId) : undefined) || accountByCode.get(l.accountCode);

  // Track cumulative balances as on toDate AND pre-fromDate opening cash balance.
  // When officeId === "ALL", Account.currentBalance holds opening + all posted JVs to date;
  // subtract any posted JV lines after toDate to reconstruct exact "As on Till Date" snapshot.
  const balanceAsOfToDate = new Map<string, number>();
  const cashOpeningBeforeFrom = new Map<string, number>();

  for (const acc of leafAccounts) {
    const base = officeId === "ALL" ? Number(acc.currentBalance || 0) : acc.officeId === officeId ? Number(acc.openingBalance || 0) : 0;
    balanceAsOfToDate.set(acc.id, base);
    cashOpeningBeforeFrom.set(acc.id, officeId === "ALL" ? Number(acc.openingBalance || 0) : acc.officeId === officeId ? Number(acc.openingBalance || 0) : 0);
  }

  let periodIncome = 0;
  let periodExpense = 0;
  let periodCogs = 0;
  let periodCashInHandNet = 0;
  let periodCashAtBankNet = 0;
  let cashReceiveInPeriod = 0;
  let cashPaymentsInPeriod = 0;

  for (const v of vouchersToDate) {
    const vTime = v.transactionDate.getTime();
    const isBeforeFrom = vTime < fromDt.getTime();
    const isInPeriod = vTime >= fromDt.getTime() && vTime <= toDt.getTime();
    const isAfterTo = vTime > toDt.getTime();

    for (const line of v.lines) {
      const acc = resolveLineAccount(line);
      if (!acc) continue;
      const debit = Number(line.debit || 0);
      const credit = Number(line.credit || 0);
      const signed = acc.normalBalance === "DEBIT" ? debit - credit : credit - debit;

      if (officeId === "ALL") {
        // Subtract transactions strictly after toDt from live currentBalance
        if (isAfterTo) {
          balanceAsOfToDate.set(acc.id, (balanceAsOfToDate.get(acc.id) ?? 0) - signed);
        }
        // Accumulate opening up to fromDt directly from openingBalance + pre-fromDt posted JVs
        if (isBeforeFrom) {
          cashOpeningBeforeFrom.set(acc.id, (cashOpeningBeforeFrom.get(acc.id) ?? 0) + signed);
        }
      } else {
        if (vTime <= toDt.getTime()) {
          balanceAsOfToDate.set(acc.id, (balanceAsOfToDate.get(acc.id) ?? 0) + signed);
        }
        if (isBeforeFrom) {
          cashOpeningBeforeFrom.set(acc.id, (cashOpeningBeforeFrom.get(acc.id) ?? 0) + signed);
        }
      }

      if (isInPeriod) {
        const cls = classifyGlAccount(acc);
        if (acc.accountType === "REVENUE") {
          periodIncome += credit - debit;
        } else if (acc.accountType === "EXPENSE") {
          periodExpense += debit - credit;
          if (cls.isCogs) periodCogs += debit - credit;
        }
        if (cls.isCashInHand) {
          periodCashInHandNet += debit - credit;
          cashReceiveInPeriod += debit;
          cashPaymentsInPeriod += credit;
        } else if (cls.isCashAtBank) {
          periodCashAtBankNet += debit - credit;
          cashReceiveInPeriod += debit;
          cashPaymentsInPeriod += credit;
        }
      }
    }
  }

  // Reconcile opening balance for "ALL" when vouchers have already been posted (or fallback to current - period net if vouchers weren't posted from opening)
  let totalCashInHand = 0;
  let totalCashAtBank = 0;
  let totalPayable = 0;
  let totalReceivable = 0;
  let totalInventory = 0;
  let totalCurrentAssets = 0;
  let totalCurrentLiabilities = 0;
  let totalAssets = 0;
  let totalEquity = 0;
  let totalRevenueAll = 0;
  let totalCogsAll = 0;
  let totalExpenseAll = 0;
  let openingCashAndBank = 0;

  for (const acc of leafAccounts) {
    const bal = balanceAsOfToDate.get(acc.id) ?? 0;
    const cls = classifyGlAccount(acc);
    if (cls.isCashInHand) totalCashInHand += bal;
    if (cls.isCashAtBank) totalCashAtBank += bal;
    if (cls.isReceivable) totalReceivable += bal;
    if (cls.isPayable) totalPayable += bal;
    if (cls.isInventory) totalInventory += bal;
    if (cls.isCurrentAsset) totalCurrentAssets += bal;
    if (cls.isCurrentLiability) totalCurrentLiabilities += bal;
    if (acc.accountType === "ASSET") totalAssets += bal;
    if (acc.accountType === "EQUITY") totalEquity += bal;
    if (acc.accountType === "REVENUE") totalRevenueAll += bal;
    if (acc.accountType === "EXPENSE") {
      totalExpenseAll += bal;
      if (cls.isCogs) totalCogsAll += bal;
    }

    if (cls.isCashInHand || cls.isCashAtBank) {
      openingCashAndBank += cashOpeningBeforeFrom.get(acc.id) ?? 0;
    }
  }

  // Include active BankAccount records not yet mirrored in Bank GLs if CashAtBank GL balance is 0 (only for ALL view)
  if (officeId === "ALL" && totalCashAtBank === 0 && bankAccounts.length > 0) {
    const bankTableSum = bankAccounts.reduce((s, b) => s + Number(b.currentBalance || 0), 0);
    if (bankTableSum > 0) {
      totalCashAtBank = bankTableSum;
      if (openingCashAndBank === 0 && cashReceiveInPeriod === 0 && cashPaymentsInPeriod === 0) {
        openingCashAndBank = bankAccounts.reduce((s, b) => s + Number(b.openingBalance || 0), 0);
      }
    }
  }

  const closingCashAndBank = round2(totalCashInHand + totalCashAtBank);
  // Ensure cashflow equation holds cleanly: if opening hadn't captured direct Account opening, derive consistently
  const openingCashflow =
    vouchersToDate.length === 0 ? closingCashAndBank : round2(openingCashAndBank);

  // Ratios calculation
  const revForRatio = periodIncome !== 0 ? periodIncome : totalRevenueAll;
  const cogsForRatio = periodCogs !== 0 ? periodCogs : totalCogsAll;
  const expForRatio = periodExpense !== 0 ? periodExpense : totalExpenseAll;
  const grossProfit = revForRatio - cogsForRatio;
  const netProfit = revForRatio - expForRatio;

  const fmtRatio = (val: number) => (Number.isFinite(val) ? round2(val).toString() : "0");
  const quickRatio = totalCurrentLiabilities > 0 ? (totalCurrentAssets - totalInventory) / totalCurrentLiabilities : 0;
  const currentRatio = totalCurrentLiabilities > 0 ? totalCurrentAssets / totalCurrentLiabilities : 0;
  const netWorkingCapitalRatio = totalCurrentLiabilities > 0 ? (totalCurrentAssets - totalCurrentLiabilities) / totalCurrentLiabilities : 0;
  const grossProfitRatio = revForRatio > 0 ? (grossProfit / revForRatio) * 100 : 0;
  const netProfitRatio = revForRatio > 0 ? (netProfit / revForRatio) * 100 : 0;
  const ocfRatio = totalCurrentLiabilities > 0 ? ((cashReceiveInPeriod - cashPaymentsInPeriod) / totalCurrentLiabilities) * 100 : 0;
  const operatingProfitRatio = revForRatio > 0 ? ((revForRatio - expForRatio) / revForRatio) * 100 : 0;
  const roa = totalAssets > 0 ? (netProfit / totalAssets) * 100 : 0;
  const effectiveEquity = totalEquity > 0 ? totalEquity : Math.max(0, totalAssets - totalCurrentLiabilities);
  const roe = effectiveEquity > 0 ? (netProfit / effectiveEquity) * 100 : 0;
  const assetTurnover = totalAssets > 0 ? revForRatio / totalAssets : 0;

  const ratios: DashboardRatioRow[] = [
    { sl: "1", ratioName: "Liquidity Analysis Ratios:", stdRatio: "", actRatio: "0", metric: "", isSectionHeader: true },
    { sl: "1.01", ratioName: "Quick Ratio", stdRatio: "1:1", actRatio: fmtRatio(quickRatio), metric: "Times" },
    { sl: "1.02", ratioName: "Current Ratio", stdRatio: "2:1", actRatio: fmtRatio(currentRatio), metric: "Times" },
    { sl: "1.03", ratioName: "Net Working Capital Ratio", stdRatio: "1:1", actRatio: fmtRatio(netWorkingCapitalRatio), metric: "Times" },
    { sl: "2", ratioName: "Profitability Analysis Ratios:", stdRatio: "", actRatio: "0", metric: "", isSectionHeader: true },
    { sl: "2.01", ratioName: "Gross Profit Ratio", stdRatio: "30", actRatio: fmtRatio(grossProfitRatio), metric: "Percent" },
    { sl: "2.02", ratioName: "Net Profit Ratio/Return On Sales", stdRatio: "10-15", actRatio: fmtRatio(netProfitRatio), metric: "Percent" },
    { sl: "2.03", ratioName: "Operating Cash Flow Ratio (OCF)", stdRatio: "", actRatio: fmtRatio(ocfRatio), metric: "Percent" },
    { sl: "2.04", ratioName: "Operating Profit Ratio", stdRatio: "15-18", actRatio: fmtRatio(operatingProfitRatio), metric: "Percent" },
    { sl: "2.05", ratioName: "Return on Assets (ROA)", stdRatio: "6", actRatio: fmtRatio(roa), metric: "Percent" },
    { sl: "2.06", ratioName: "Return on Equity (ROE)", stdRatio: "15", actRatio: fmtRatio(roe), metric: "Percent" },
    { sl: "3", ratioName: "Activity Analysis Ratios/Management Efficiency:", stdRatio: "", actRatio: "0", metric: "", isSectionHeader: true },
    { sl: "3.01", ratioName: "Asset Turnover Ratio", stdRatio: "2", actRatio: fmtRatio(assetTurnover), metric: "Times" },
  ];

  // Monthly statistics for selected year
  const monthlyIncome = new Array(12).fill(0);
  const monthlyExpense = new Array(12).fill(0);

  for (const v of yearVouchers) {
    const m = v.transactionDate.getUTCMonth();
    if (m < 0 || m > 11) continue;
    for (const line of v.lines) {
      const acc = resolveLineAccount(line);
      if (!acc) continue;
      const debit = Number(line.debit || 0);
      const credit = Number(line.credit || 0);
      if (acc.accountType === "REVENUE") monthlyIncome[m] += credit - debit;
      if (acc.accountType === "EXPENSE") monthlyExpense[m] += debit - credit;
    }
  }

  const monthlyStatistics = MONTH_NAMES.map((month, idx) => {
    const income = round2(monthlyIncome[idx]);
    const expense = round2(monthlyExpense[idx]);
    return {
      month,
      income,
      expense,
      negativeExpense: expense > 0 ? -expense : 0,
    };
  });

  return {
    filters: { officeId, fromDate, toDate, year, offices },
    accountBalance: {
      accountsPayable: round2(totalPayable),
      accountsReceivable: round2(totalReceivable),
    },
    incomeAndExpense: {
      cashInHand: round2(periodCashInHandNet),
      income: round2(periodIncome),
      cashAtBank: round2(periodCashAtBankNet),
      totalExpense: round2(periodExpense),
    },
    cashAndEquivalent: {
      cashInHand: round2(totalCashInHand),
      cashAtBank: round2(totalCashAtBank),
    },
    cashflow: {
      opening: round2(openingCashflow),
      closing: round2(closingCashAndBank),
      receive: round2(cashReceiveInPeriod),
      payments: round2(cashPaymentsInPeriod),
    },
    ratios,
    monthlyStatistics,
  };
}

