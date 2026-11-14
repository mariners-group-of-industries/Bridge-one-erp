import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});
// Requests authenticate with an API token only (no session cookie).
vi.mock("@/lib/auth/cookies", () => ({ getAuthCookie: async () => undefined, setAuthCookie: async () => undefined, clearAuthCookie: async () => undefined }));

import { createApiToken } from "@/features/configuration/gateways/server/api-token.service";
import { POST as createJournalRoute } from "@/app/api/accounts/journal/route";
import { POST as createCostCenterRoute } from "@/app/api/accounts/cost-centers/route";
import { PATCH as updateCostCenterRoute } from "@/app/api/accounts/cost-centers/[id]/route";
import { POST as createFundTransferRoute } from "@/app/api/accounts/fund-transfers/route";
import { POST as createBankingRoute } from "@/app/api/accounts/banking/route";
import { POST as createExpenseRoute } from "@/app/api/accounts/expenses/route";
import { POST as createBudgetRoute } from "@/app/api/accounts/budget/route";
import { GET as partyLedgerRoute } from "@/app/api/accounts/party-ledger/route";
import { GET as otherReportsRoute } from "@/app/api/accounts/other-reports/route";
import { createItem } from "@/features/sales/masters/services/masters.service";
import { purchaseStore } from "@/lib/purchase-store/store";
import { isoDateOrNull, uuidOrNull } from "@/lib/accounting/ids";
import { transTypeBase, transTypeLabel, transTypeFilterOptions } from "@/features/accounts/transaction-types";
import { adminActor, businessUnitInput, companyInput, officeInput } from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb, testPrisma } from "./helpers/test-db";

type Handler = (r: Request, c: unknown) => Promise<Response>;
let token = "";
const post = async (handler: Handler, path: string, body: unknown) => {
  const res = await handler(
    new Request(`http://localhost/api/accounts/${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "user-agent": "vitest" },
      body: JSON.stringify(body),
    }),
    {},
  );
  return { status: res.status, json: (await res.json()) as { success?: boolean; data?: any; error?: any } };
};

let officeId = "";
let cashId = "";
let expenseId = "";

beforeAll(async () => {
  await startTestDb();
});
afterAll(async () => {
  await stopTestDb();
});
beforeEach(async () => {
  await resetTestDb();
  const prisma = testPrisma();
  const company = await prisma.company.create({ data: companyInput });
  const bu = await prisma.businessUnit.create({ data: { ...businessUnitInput, companyId: company.id } });
  officeId = (await prisma.office.create({ data: { ...officeInput, businessUnitId: bu.id, name: "Dhaka Head Office" } })).id;
  cashId = (
    await prisma.account.create({
      data: { code: "10101001", name: "Cash In Hand", accountType: "ASSET", accountSubtype: "Cash", normalBalance: "DEBIT", isGroup: false },
    })
  ).id;
  expenseId = (
    await prisma.account.create({
      data: { code: "80201001", name: "Business Promotion Expenses", accountType: "EXPENSE", accountSubtype: "Expense", normalBalance: "DEBIT", isGroup: false },
    })
  ).id;
  token = (await createApiToken(adminActor, { name: "Accounts tests", access: "READ_WRITE", expiry: "30" })).token;
});

describe("form value helpers", () => {
  it("accepts only real ids and yyyy-mm-dd dates", () => {
    expect(uuidOrNull("office-sirajganj")).toBeNull();
    expect(uuidOrNull("acc-10102")).toBeNull();
    expect(uuidOrNull("3fe794bd-5cd9-4452-9832-9a7bdef68034")).toBe("3fe794bd-5cd9-4452-9832-9a7bdef68034");
    expect(isoDateOrNull("2026-11-01")?.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    // dd/mm/yyyy would be read as mm/dd by Date: refused instead.
    expect(isoDateOrNull("01/11/2026")).toBeNull();
  });

  it("names automatic vouchers and their reversals, and filters them under the iBOS type", () => {
    expect(transTypeLabel("PURCHASE_RECEIPT")).toBe("Purchase (Auto)");
    expect(transTypeLabel("SUPPLIER_PAYMENT_CANCEL")).toBe("Due Payment Reversal (Auto)");
    expect(transTypeLabel("Cash Payment")).toBe("Cash Payment");
    expect(transTypeLabel(null, "GENERAL")).toBe("GENERAL");
    expect(transTypeBase("SALES_COLLECTION")).toBe("Due Receive");
    expect(transTypeBase("PURCHASE_RETURN_CANCEL")).toBe("Purchase Return");
    const options = transTypeFilterOptions([{ transType: "LEGACY_TYPE" }, { transType: "SALES_DELIVERY" }]);
    // The iBOS list first, in its order, then manual voucher types and anything else found.
    expect(options.slice(0, 3)).toEqual(["Purchase", "Sales", "Due Payment"]);
    expect(options).toContain("Contra Voucher");
    expect(options).toContain("LEGACY_TYPE");
    expect(options.filter((o) => o === "Sales")).toHaveLength(1);
  });
});

describe("supplier ledger and supplier payment report", () => {
  it("lists a supplier's receipt and payment with a running balance, and the payment in the report", async () => {
    const prisma = testPrisma();
    const businessUnitId = (await prisma.office.findUniqueOrThrow({ where: { id: officeId } })).businessUnitId;
    const warehouseId = (await prisma.warehouse.create({ data: { officeId, name: "Main WH" } })).id;
    const itemId = (await createItem(adminActor, { businessUnitId, name: "Wheat Flour", uom: "KG", salesRate: 60 })).id;
    const supplierId = (await prisma.supplier.create({ data: { businessUnitId, code: "SUP-L1", name: "Ledger Traders" } })).id;
    await purchaseStore.createGoodsReceipt(
      {
        purchaseOrderId: "DIRECT",
        receiptDate: "2026-11-03",
        supplierId,
        warehouseId,
        items: [{ itemId, itemCode: "", itemName: "Wheat Flour", uom: "KG", currentReceivedQuantity: 2, rejectedDamagedQuantity: 0, unitPrice: 50 }],
      },
      "Store",
    );
    await purchaseStore.createSupplierPayment({ supplierId, amount: 40, method: "CASH", paymentDate: "2026-11-05" }, "Accounts");

    const get = async (handler: Handler, path: string) => {
      const res = await handler(new Request(`http://localhost/api/accounts/${path}`, { headers: { authorization: `Bearer ${token}`, "user-agent": "vitest" } }), {});
      return { status: res.status, json: (await res.json()) as { success?: boolean; data?: any; error?: any } };
    };

    const list = await get(partyLedgerRoute, "party-ledger?list=SUPPLIER");
    expect(list.json.data.map((p: { name: string }) => p.name)).toContain("Ledger Traders");

    const ledger = await get(partyLedgerRoute, `party-ledger?type=SUPPLIER&partyId=${supplierId}&fromDate=2026-11-04&toDate=2026-11-30`);
    // The receipt is before the period: it is the opening balance (we owe 100, so -100).
    expect(ledger.json.data.opening).toBe(-100);
    expect(ledger.json.data.entries).toEqual([expect.objectContaining({ date: "2026-11-05", debit: 40, credit: 0, balance: -60 })]);
    expect(ledger.json.data.closing).toBe(-60);

    expect((await get(partyLedgerRoute, "party-ledger?type=SUPPLIER&partyId=not-an-id")).status).toBe(400);

    const report = await get(otherReportsRoute, "other-reports?type=SUPPLIER_PAYMENT&fromDate=2026-11-01&toDate=2026-11-30");
    expect(report.json.data).toEqual([expect.objectContaining({ party: "SUP-L1 - Ledger Traders", amount: 40, settles: "On account" })]);
    expect((await get(otherReportsRoute, "other-reports?type=COLLECTION&fromDate=2026-11-01&toDate=2026-11-30")).json.data).toEqual([]);
  });
});

describe("accounts API saves", () => {
  it("journal: refuses a made-up office or account, records the signed-in user and the transaction type", async () => {
    const lines = [
      { accountId: cashId, accountCode: "10101001", accountName: "Cash In Hand", debit: 0, credit: 500 },
      { accountId: expenseId, accountCode: "80201001", accountName: "Business Promotion Expenses", debit: 500, credit: 0 },
    ];
    const base = { transactionDate: "2026-11-14", officeName: "Dhaka Head Office", narration: "Promotion", transType: "Cash Payment", status: "POSTED", lines };

    const fakeOffice = await post(createJournalRoute, "journal", { ...base, officeId: "office-sirajganj" });
    expect(fakeOffice.status).toBe(400);
    expect(fakeOffice.json.error).toBe("Select the office.");

    const fakeAccount = await post(createJournalRoute, "journal", { ...base, officeId, lines: [{ ...lines[0], accountId: "acc-1461" }, lines[1]] });
    expect(fakeAccount.status).toBe(400);
    expect(fakeAccount.json.error).toBe("Line 1: select the GL account.");

    const ok = await post(createJournalRoute, "journal", { ...base, officeId, createdBy: "Md. Roni Mridha" });
    expect(ok.status).toBe(201);
    expect(ok.json.data.transType).toBe("Cash Payment");
    // Never the name the browser sent.
    expect(ok.json.data.preparedBy).not.toBe("Md. Roni Mridha");
    expect(ok.json.data.preparedBy).toMatch(/^API token/);
    expect(Number((await testPrisma().account.findUniqueOrThrow({ where: { id: expenseId } })).currentBalance)).toBe(500);
  });

  it("center setup: needs a real office, saves the effective date and refuses a duplicate code", async () => {
    const fake = await post(createCostCenterRoute, "cost-centers", { code: "CC-1", name: "HQ", officeId: "office-mbbl" });
    expect(fake.status).toBe(400);

    const ok = await post(createCostCenterRoute, "cost-centers", { code: "CC-1", name: "HQ", officeId, officeName: "Dhaka Head Office", effectiveDate: "2026-11-01" });
    expect(ok.status).toBe(201);
    expect(new Date(ok.json.data.effectiveDate).toISOString().slice(0, 10)).toBe("2026-11-01");

    const dup = await post(createCostCenterRoute, "cost-centers", { code: "CC-1", name: "Other", officeId });
    expect(dup.status).toBe(409);
    expect(dup.json.error).toBe("Center code CC-1 is already used.");
  });

  it("center setup edit: updates the center, refuses a code another center uses", async () => {
    const a = await post(createCostCenterRoute, "cost-centers", { code: "CC-A", name: "A", officeId });
    await post(createCostCenterRoute, "cost-centers", { code: "CC-B", name: "B", officeId });
    const patch = async (id: string, body: unknown) => {
      const res = await updateCostCenterRoute(
        new Request(`http://localhost/api/accounts/cost-centers/${id}`, {
          method: "PATCH",
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "user-agent": "vitest" },
          body: JSON.stringify(body),
        }),
        { params: Promise.resolve({ id }) },
      );
      return { status: res.status, json: (await res.json()) as { data?: any; error?: string } };
    };
    const ok = await patch(a.json.data.id, { name: "Head Office", status: "INACTIVE", effectiveDate: "2026-12-01" });
    expect(ok.status).toBe(200);
    expect(ok.json.data.name).toBe("Head Office");
    expect(ok.json.data.status).toBe("INACTIVE");
    expect((await patch(a.json.data.id, { code: "CC-B" })).status).toBe(409);
    expect((await patch(a.json.data.id, { officeId: "office-mbbl" })).status).toBe(400);
  });

  it("fund transfer request: names the receiving office and cash head only; no made-up sending office", async () => {
    const res = await post(createFundTransferRoute, "fund-transfers", {
      requestDate: "2026-11-14",
      expectedDate: "2026-11-15",
      toOfficeId: officeId,
      toOfficeName: "Dhaka Head Office",
      toAccountId: cashId,
      toAccountName: "Cash In Hand",
      requestedAmount: 5000,
      status: "SUBMITTED",
    });
    expect(res.status).toBe(201);
    expect(res.json.data.toOfficeId).toBe(officeId);
    expect(res.json.data.fromOfficeName).toBe("");
    expect(res.json.data.responsiblePerson).toBe("");
  });

  it("banking: a made-up GL or office id is dropped instead of failing the save", async () => {
    const bank = await post(createBankingRoute, "banking", {
      bankName: "Pubali Bank",
      branchName: "Motijheel",
      accountHolder: "Mariners",
      accountNumber: "111",
      glAccountId: "acc-10102",
    });
    expect(bank.status).toBe(201);
    expect(bank.json.data.glAccountId).toBeNull();

    const linked = await post(createBankingRoute, "banking", { bankName: "DBBL", branchName: "Mohakhali", accountHolder: "Mariners", accountNumber: "222", glAccountId: cashId });
    expect(linked.json.data.glAccountId).toBe(cashId);

    const deposit = await post(createBankingRoute, "banking", { entityType: "deposit", bankName: "Sonali", officeId: "office-dhaka", principalAmount: 1000 });
    expect(deposit.status).toBe(201);
    expect(deposit.json.data.officeId).toBeNull();
  });

  it("expense: a made-up account id does not fail the save and the date is read as yyyy-mm-dd", async () => {
    const fake = await post(createExpenseRoute, "expenses", { recordKind: "EXPENSE", officeId: "office-sirajganj", accountId: "acc-702", amount: 100, date: "2026-11-01", payeeName: "Shop" });
    expect(fake.status).toBe(201);
    expect(fake.json.data.officeId).toBeNull();
    expect(new Date(fake.json.data.date).toISOString().slice(0, 10)).toBe("2026-11-01");

    const real = await post(createExpenseRoute, "expenses", { recordKind: "EXPENSE", officeId, accountId: expenseId, amount: 100, date: "2026-11-02", payeeName: "Shop" });
    expect(real.json.data.officeId).toBe(officeId);
    expect(real.json.data.accountId).toBe(expenseId);
  });

  it("budget: records the signed-in user as creator", async () => {
    const res = await post(createBudgetRoute, "budget", {
      budgetCode: "BGT-1",
      budgetName: "November",
      budgetYear: "2026",
      budgetType: "OverHeads/Expense Budget",
      allocatedAmount: 1000,
      officeId: "office-mbbl",
      createdBy: "Admin User",
      items: [],
    });
    expect(res.status).toBe(201);
    expect(res.json.data.createdBy).toMatch(/^API token/);
    expect(res.json.data.officeId).toBeNull();
  });
});
