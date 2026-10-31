import { NextResponse } from "next/server";
import { db } from "@/lib/prisma/client";
import { apiHandler } from "@/lib/api/handler";

async function handlePOST() {
  try {
    const prisma = db();

    // Check if accounts already exist
    const count = await prisma.account.count();
    if (count > 0) {
      return NextResponse.json({
        success: true,
        message: "Database already seeded.",
        accountCount: count,
      });
    }

    // 1. Seed Cost Centers
    await prisma.costCenter.createMany({
      data: [
        {
          code: "CC-100",
          name: "Corporate Head Office (Dhaka)",
          type: "DEPARTMENT",
          officeName: "MBBL-HO",
          description: "Administrative HQ and executive management",
          status: "ACTIVE",
        },
        {
          code: "CC-200",
          name: "Sirajganj Manufacturing Unit 1",
          type: "BRANCH",
          officeName: "MG Sirajganj Factory",
          description: "Primary woven and spinning plant",
          status: "ACTIVE",
        },
        {
          code: "CC-300",
          name: "Chattogram Export Depot",
          type: "BRANCH",
          officeName: "Chattogram Port Depot",
          description: "Port clearing, forwarding and bonded store",
          status: "ACTIVE",
        },
      ],
      skipDuplicates: true,
    });

    // 2. Seed Chart of Accounts
    await prisma.account.createMany({
      data: [
        // Assets
        {
          code: "1110",
          name: "Cash in Hand",
          accountType: "ASSET",
          accountSubtype: "CURRENT_ASSET",
          tierLevel: "GL",
          normalBalance: "DEBIT",
          openingBalance: 150000,
          currentBalance: 245000,
          currency: "BDT",
          isGroup: false,
          status: "ACTIVE",
        },
        {
          code: "1120",
          name: "Cash at Bank - Pubali Bank Ltd",
          accountType: "ASSET",
          accountSubtype: "CURRENT_ASSET",
          tierLevel: "GL",
          normalBalance: "DEBIT",
          openingBalance: 4500000,
          currentBalance: 7850000,
          currency: "BDT",
          isGroup: false,
          status: "ACTIVE",
        },
        {
          code: "1150",
          name: "Fund in Transit",
          accountType: "ASSET",
          accountSubtype: "CURRENT_ASSET",
          tierLevel: "GL",
          normalBalance: "DEBIT",
          openingBalance: 0,
          currentBalance: 35000,
          currency: "BDT",
          isGroup: false,
          status: "ACTIVE",
        },
        {
          code: "1210",
          name: "Trade Accounts Receivable",
          accountType: "ASSET",
          accountSubtype: "CURRENT_ASSET",
          tierLevel: "GL",
          normalBalance: "DEBIT",
          openingBalance: 2800000,
          currentBalance: 3200000,
          currency: "BDT",
          isGroup: false,
          status: "ACTIVE",
        },
        // Liabilities
        {
          code: "2110",
          name: "Trade Accounts Payable",
          accountType: "LIABILITY",
          accountSubtype: "CURRENT_LIABILITY",
          tierLevel: "GL",
          normalBalance: "CREDIT",
          openingBalance: 1850000,
          currentBalance: 2150000,
          currency: "BDT",
          isGroup: false,
          status: "ACTIVE",
        },
        // Equity
        {
          code: "3100",
          name: "Paid-up Share Capital",
          accountType: "EQUITY",
          accountSubtype: "CAPITAL",
          tierLevel: "GL",
          normalBalance: "CREDIT",
          openingBalance: 10000000,
          currentBalance: 10000000,
          currency: "BDT",
          isGroup: false,
          status: "ACTIVE",
        },
        // Revenues
        {
          code: "4100",
          name: "Domestic Goods Sales",
          accountType: "REVENUE",
          accountSubtype: "OPERATING_REVENUE",
          tierLevel: "GL",
          normalBalance: "CREDIT",
          openingBalance: 0,
          currentBalance: 15400000,
          currency: "BDT",
          isGroup: false,
          status: "ACTIVE",
        },
        // Expenses
        {
          code: "5100",
          name: "Rent, Rates & Taxes",
          accountType: "EXPENSE",
          accountSubtype: "OPERATING_EXPENSE",
          tierLevel: "GL",
          normalBalance: "DEBIT",
          openingBalance: 0,
          currentBalance: 650000,
          currency: "BDT",
          isGroup: false,
          status: "ACTIVE",
        },
        {
          code: "5200",
          name: "Electricity, Fuel & Utilities",
          accountType: "EXPENSE",
          accountSubtype: "OPERATING_EXPENSE",
          tierLevel: "GL",
          normalBalance: "DEBIT",
          openingBalance: 0,
          currentBalance: 780000,
          currency: "BDT",
          isGroup: false,
          status: "ACTIVE",
        },
        {
          code: "5300",
          name: "Salaries, Overtime & Allowances",
          accountType: "EXPENSE",
          accountSubtype: "OPERATING_EXPENSE",
          tierLevel: "GL",
          normalBalance: "DEBIT",
          openingBalance: 0,
          currentBalance: 1200000,
          currency: "BDT",
          isGroup: false,
          status: "ACTIVE",
        },
      ],
      skipDuplicates: true,
    });

    // 3. Seed Budgets
    const b1 = await prisma.budget.create({
      data: {
        budgetCode: "BGT-MG260900001 v4",
        budgetName: "October-2026",
        budgetYear: "Sep 21, 2026 - Oct 20, 2026",
        createDate: "19-09-2026",
        financialPeriod: "Sep 21, 2026 - Oct 20, 2026",
        officeName: "MBBL-HO",
        costCenterName: "Dhaka Head Office",
        budgetType: "OverHeads/Expense Budget",
        accountName: "Overheads & Operational Expenses",
        allocatedAmount: 6126907.0,
        totalBudgetAmount: 6126907.0,
        revisedAmount: 6126907.0,
        utilizedAmount: 1845200.0,
        committedAmount: 920000.0,
        remainingAmount: 3361707.0,
        status: "Approved",
        approvalStatus: "Approved",
        version: 4,
        createdBy: "Md. Tanvir Hossain",
        items: {
          create: [
            {
              accountCode: "5100",
              accountName: "Rent, Rates & Taxes (Corporate HQ)",
              costCenterName: "Dhaka Head Office",
              allocatedAmount: 1850000.0,
              utilizedAmount: 650000.0,
              remainingAmount: 1200000.0,
              remarks: "HQ lease & local municipality rates",
            },
            {
              accountCode: "5200",
              accountName: "Electricity, Fuel & Plant Utilities",
              costCenterName: "MG Factory Floor",
              allocatedAmount: 2400000.0,
              utilizedAmount: 780000.0,
              remainingAmount: 1620000.0,
              remarks: "Generator diesel and DESCO substation",
            },
            {
              accountCode: "5300",
              accountName: "Salaries, Overtime & Allowances",
              costCenterName: "Administration",
              allocatedAmount: 1200000.0,
              utilizedAmount: 320000.0,
              remainingAmount: 880000.0,
              remarks: "Support staff & security allowances",
            },
            {
              accountCode: "5400",
              accountName: "Office Supplies, IT & Maintenance",
              costCenterName: "Corporate HQ",
              allocatedAmount: 676907.0,
              utilizedAmount: 95200.0,
              remainingAmount: 581707.0,
              remarks: "IT software licenses, stationery & supplies",
            },
          ],
        },
      },
    });

    const b2 = await prisma.budget.create({
      data: {
        budgetCode: "BGT-MG260900000 v3",
        budgetName: "October-2026",
        budgetYear: "Sep 21, 2026 - Oct 20, 2026",
        createDate: "19-09-2026",
        financialPeriod: "Sep 21, 2026 - Oct 20, 2026",
        officeName: "MBBL-HO",
        costCenterName: "Sirajganj Unit 1",
        budgetType: "OverHeads/Expense Budget",
        accountName: "Factory Contingency Overhead",
        allocatedAmount: 2.0,
        totalBudgetAmount: 2.0,
        revisedAmount: 2.0,
        utilizedAmount: 0.0,
        committedAmount: 0.0,
        remainingAmount: 2.0,
        status: "Approved",
        approvalStatus: "Approved",
        version: 3,
        createdBy: "Md. Tanvir Hossain",
        items: {
          create: [
            {
              accountCode: "5210",
              accountName: "Emergency Plant Contingency Reserve",
              costCenterName: "Sirajganj Unit 1",
              allocatedAmount: 2.0,
              utilizedAmount: 0.0,
              remainingAmount: 2.0,
              remarks: "Nominal threshold ceiling",
            },
          ],
        },
      },
    });

    // 4. Seed Bank Accounts & Cheque Books
    await prisma.bankAccount.create({
      data: {
        accountNumber: "1482-1010-09881",
        bankName: "Pubali Bank Ltd",
        branchName: "Principal Branch, Motijheel",
        accountHolder: "BridgeOne Technologies Ltd",
        accountType: "CURRENT",
        currency: "BDT",
        glAccountName: "Cash At Bank - Pubali Bank Ltd",
        openingBalance: 4500000,
        currentBalance: 7850000,
        reconciliationStatus: "RECONCILED",
        isActive: true,
      },
    });

    await prisma.chequeBook.create({
      data: {
        bookName: "Pubali Principal CD-01",
        bankName: "Pubali Bank Ltd",
        branchName: "Principal Branch, Motijheel",
        accountNumber: "1482-1010-09881",
        startChequeNumber: "PBL-98101",
        endChequeNumber: "PBL-98125",
        totalLeaves: 25,
        usedLeaves: 5,
        remainingLeaves: 20,
        status: "Running",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Successfully seeded initial accounting data into Neon PostgreSQL database.",
      seeded: {
        budgets: [b1.budgetCode, b2.budgetCode],
      },
    });
  } catch (error: any) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to seed database" },
      { status: 500 },
    );
  }
}

// Signed-in users with the accounts permission only.
export const POST = apiHandler("accounts:write", handlePOST);
