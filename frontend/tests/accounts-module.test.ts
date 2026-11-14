import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { ruleForRequest } from "@/lib/permissions/api-rules";
import {
  applyVoucherLinesToAccounts,
  computeAccountsDashboard,
  createVoucherInTx,
  ensureStandardCoaHierarchy,
} from "@/lib/accounting/accounts-service";
import { businessUnitInput, companyInput, officeInput } from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb } from "./helpers/test-db";

vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});

describe("Accounts API RBAC mappings", () => {
  it("maps dashboard, coa-permissions, chart-of-accounts, expenses, fund-transfers and banking routes", () => {
    expect(ruleForRequest("/api/accounts/dashboard")?.feature).toBe("/accounts");
    expect(ruleForRequest("/api/accounts/coa-permissions")?.feature).toBe("/accounts/chart-of-accounts");
    expect(ruleForRequest("/api/accounts/chart-of-accounts/123")?.feature).toBe("/accounts/chart-of-accounts");
    expect(ruleForRequest("/api/accounts/expenses/123")).toBeTruthy();
    expect(ruleForRequest("/api/accounts/fund-transfers/123")).toBeTruthy();
    expect(ruleForRequest("/api/accounts/banking/123")?.feature).toBe("/accounts/banking");
  });
});

describe("Accounts Module PostgreSQL workflow & Dashboard Analytics", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = await startTestDb();
  }, 60_000);

  beforeEach(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await stopTestDb();
  });

  async function seedOrgAndHierarchy() {
    const company = await prisma.company.create({ data: companyInput });
    const bu = await prisma.businessUnit.create({ data: { ...businessUnitInput, companyId: company.id } });
    const officeA = await prisma.office.create({ data: { ...officeInput, businessUnitId: bu.id, name: "Dhaka Head Office" } });
    const officeB = await prisma.office.create({ data: { ...officeInput, businessUnitId: bu.id, name: "MG Sirajganj Factory" } });

    // Simulate legacy flat GL accounts existing before standard hierarchy initialization
    const legacyBank = await prisma.account.create({
      data: {
        code: "1120",
        name: "Cash at Bank - Pubali Bank Ltd",
        accountType: "ASSET",
        accountSubtype: "CURRENT_ASSET",
        tierLevel: "GL",
        normalBalance: "DEBIT",
        openingBalance: 100000,
        currentBalance: 100000,
        isGroup: false,
        status: "ACTIVE",
      },
    });
    const legacyAr = await prisma.account.create({
      data: {
        code: "1210",
        name: "Trade Accounts Receivable",
        accountType: "ASSET",
        accountSubtype: "CURRENT_ASSET",
        tierLevel: "GL",
        normalBalance: "DEBIT",
        openingBalance: 0,
        currentBalance: 0,
        isGroup: false,
        status: "ACTIVE",
      },
    });
    const legacyAp = await prisma.account.create({
      data: {
        code: "2110",
        name: "Trade Accounts Payable",
        accountType: "LIABILITY",
        accountSubtype: "CURRENT_LIABILITY",
        tierLevel: "GL",
        normalBalance: "CREDIT",
        openingBalance: 0,
        currentBalance: 0,
        isGroup: false,
        status: "ACTIVE",
      },
    });
    const legacyRev = await prisma.account.create({
      data: {
        code: "4100",
        name: "Product Sales Revenue",
        accountType: "REVENUE",
        accountSubtype: "OPERATING_INCOME",
        tierLevel: "GL",
        normalBalance: "CREDIT",
        openingBalance: 0,
        currentBalance: 0,
        isGroup: false,
        status: "ACTIVE",
      },
    });

    await ensureStandardCoaHierarchy(prisma);
    return { officeA, officeB, legacyBank, legacyAr, legacyAp, legacyRev };
  }

  it("initializes 8-group standard COA hierarchy and links legacy GLs without changing their IDs", async () => {
    const { legacyBank, legacyAp } = await seedOrgAndHierarchy();

    const roots = await prisma.account.findMany({
      where: { parentCode: null },
      orderBy: { code: "asc" },
    });
    expect(roots.map((r) => r.code)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"]);

    const refreshedBank = await prisma.account.findUniqueOrThrow({ where: { id: legacyBank.id } });
    const refreshedAp = await prisma.account.findUniqueOrThrow({ where: { id: legacyAp.id } });
    expect(refreshedBank.parentCode).toBe("10102");
    expect(Number(refreshedBank.currentBalance)).toBe(100000);
    expect(refreshedAp.parentCode).toBe("30101");
  });

  it("posts double-entry vouchers, updates Account balances, reverses cleanly, and feeds live Dashboard KPIs, Ratios & Monthly Chart", async () => {
    const { officeA, officeB } = await seedOrgAndHierarchy();
    const cashAcc = await prisma.account.findUniqueOrThrow({ where: { code: "10101001" } });
    const bankAcc = await prisma.account.findUniqueOrThrow({ where: { code: "1120" } });
    const arAcc = await prisma.account.findUniqueOrThrow({ where: { code: "1210" } });
    const apAcc = await prisma.account.findUniqueOrThrow({ where: { code: "2110" } });
    const revAcc = await prisma.account.findUniqueOrThrow({ where: { code: "4100" } });
    const expAcc = await prisma.account.findUniqueOrThrow({ where: { code: "80101001" } });

    await prisma.$transaction(async (tx) => {
      // Sales revenue received into Cash In Hand + AR in Nov 2026 (Office A)
      await createVoucherInTx(tx, {
        voucherNumber: "JV-2026-0001",
        transactionDate: new Date("2026-11-05T00:00:00Z"),
        officeId: officeA.id,
        officeName: officeA.name,
        journalType: "RECEIPT",
        narration: "Sales collection + credit billing",
        status: "POSTED",
        createdBy: "Tester",
        lines: [
          { accountId: cashAcc.id, accountCode: cashAcc.code, accountName: cashAcc.name, debit: 60000, credit: 0 },
          { accountId: arAcc.id, accountCode: arAcc.code, accountName: arAcc.name, debit: 40000, credit: 0 },
          { accountId: revAcc.id, accountCode: revAcc.code, accountName: revAcc.name, debit: 0, credit: 100000 },
        ],
      });

      // Supplier bill + Expense in Nov 2026 (Office B)
      await createVoucherInTx(tx, {
        voucherNumber: "JV-2026-0002",
        transactionDate: new Date("2026-11-08T00:00:00Z"),
        officeId: officeB.id,
        officeName: officeB.name,
        journalType: "PAYMENT",
        narration: "Utility & AP accrual",
        status: "POSTED",
        createdBy: "Tester",
        lines: [
          { accountId: expAcc.id, accountCode: expAcc.code, accountName: expAcc.name, debit: 30000, credit: 0 },
          { accountId: bankAcc.id, accountCode: bankAcc.code, accountName: bankAcc.name, debit: 0, credit: 10000 },
          { accountId: apAcc.id, accountCode: apAcc.code, accountName: apAcc.name, debit: 0, credit: 20000 },
        ],
      });
    });

    const dashAll = await computeAccountsDashboard(prisma, {
      officeId: "ALL",
      fromDate: "2026-11-01",
      toDate: "2026-11-12",
      year: 2026,
    });

    expect(dashAll.accountBalance.accountsReceivable).toBe(40000);
    expect(dashAll.accountBalance.accountsPayable).toBe(20000);
    expect(dashAll.incomeAndExpense.income).toBe(100000);
    expect(dashAll.incomeAndExpense.totalExpense).toBe(30000);
    expect(dashAll.cashAndEquivalent.cashInHand).toBe(60000);
    expect(dashAll.cashAndEquivalent.cashAtBank).toBe(90000);
    expect(dashAll.cashflow.receive).toBe(60000);
    expect(dashAll.cashflow.payments).toBe(10000);
    expect(dashAll.ratios).toHaveLength(13);
    expect(dashAll.ratios.find((r) => r.sl === "1.02")?.ratioName).toBe("Current Ratio");

    const nov = dashAll.monthlyStatistics.find((m) => m.month === "Nov");
    expect(nov?.income).toBe(100000);
    expect(nov?.expense).toBe(30000);
    expect(nov?.negativeExpense).toBe(-30000);

    // Office A filter isolates only Office A activity
    const dashOfficeA = await computeAccountsDashboard(prisma, {
      officeId: officeA.id,
      fromDate: "2026-11-01",
      toDate: "2026-11-12",
      year: 2026,
    });
    expect(dashOfficeA.incomeAndExpense.income).toBe(100000);
    expect(dashOfficeA.incomeAndExpense.totalExpense).toBe(0);
    expect(dashOfficeA.accountBalance.accountsPayable).toBe(0);

    // Reverse voucher updates balances back
    const v1 = await prisma.journalVoucher.findUniqueOrThrow({
      where: { voucherNumber: "JV-2026-0001" },
      include: { lines: true },
    });
    await prisma.$transaction(async (tx) => {
      await applyVoucherLinesToAccounts(tx, v1.lines, -1);
    });
    const cashAfterRev = await prisma.account.findUniqueOrThrow({ where: { id: cashAcc.id } });
    expect(Number(cashAfterRev.currentBalance)).toBe(0);
  });

  it("creates CoaPermission linked to real Employee & Account and enforces uniqueness", async () => {
    const { officeA } = await seedOrgAndHierarchy();
    const emp = await prisma.employee.create({
      data: {
        officeId: officeA.id,
        employeeCode: "EMP-9001",
        name: "Mohammad Arif",
        joiningDate: new Date("2025-01-01"),
      },
    });
    const gl = await prisma.account.findUniqueOrThrow({ where: { code: "10101001" } });

    const perm = await prisma.coaPermission.create({
      data: {
        employeeUuid: emp.id,
        employeeId: emp.employeeCode,
        employeeName: emp.name,
        voucherType: "Payment",
        accountId: gl.id,
        accountHeadCode: gl.code,
        accountHeadName: gl.name,
        status: "ACTIVE",
      },
    });
    expect(perm.employeeId).toBe("EMP-9001");
    expect(perm.accountHeadCode).toBe("10101001");

    await expect(
      prisma.coaPermission.create({
        data: {
          employeeUuid: emp.id,
          employeeId: emp.employeeCode,
          employeeName: emp.name,
          voucherType: "Payment",
          accountId: gl.id,
          accountHeadCode: gl.code,
          accountHeadName: gl.name,
        },
      })
    ).rejects.toThrow();
  });

  it("persists BankFacility (Deposit/Loan), ExpenseRecord (Advance/Provision), and FundTransfer", async () => {
    await seedOrgAndHierarchy();
    const exp = await prisma.expenseRecord.create({
      data: {
        expenseNumber: "ADV-2026-0001",
        recordKind: "ADVANCE",
        expenseType: "Employee Advance",
        accountCode: "10501",
        accountName: "Employee & Supplier Advances",
        payeeName: "Tariqul Islam",
        amount: 15000,
        date: new Date("2026-11-10"),
        status: "PENDING",
      },
    });
    expect(exp.recordKind).toBe("ADVANCE");

    const facility = await prisma.bankFacility.create({
      data: {
        facilityKind: "DEPOSIT",
        facilityNumber: "FDR-001",
        partyName: "Pubali Bank Ltd",
        facilityType: "Security Deposit",
        principalAmount: 500000,
        interestRate: 7.5,
      },
    });
    expect(facility.facilityKind).toBe("DEPOSIT");

    const ft = await prisma.fundTransfer.create({
      data: {
        transferNumber: "FT-2026-0001",
        requestDate: new Date("2026-11-11"),
        fromOfficeName: "Dhaka Head Office",
        toOfficeName: "MG Sirajganj Factory",
        fromAccountName: "Cash At Bank",
        toAccountName: "Cash In Hand",
        requestedAmount: 75000,
        responsiblePerson: "Accounts Officer",
        purpose: "Factory petty cash replenishment",
      },
    });
    expect(Number(ft.requestedAmount)).toBe(75000);
  });
});
