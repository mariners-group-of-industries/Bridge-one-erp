import "dotenv/config";
import { db } from "../src/lib/prisma/client";

async function inspect() {
  const cutoff = new Date("2026-11-16T00:00:00Z");

  const [
    quotations,
    orders,
    deliveries,
    returns,
    collections,
    bills,
    budgets,
    demoRecords
  ] = await Promise.all([
    db().salesQuotation.findMany({
      where: { createdAt: { gte: cutoff } },
      select: { id: true, number: true, createdAt: true, createdBy: true, status: true, grandTotal: true },
    }),
    db().salesOrder.findMany({
      where: { createdAt: { gte: cutoff } },
      select: { id: true, number: true, createdAt: true, createdBy: true, status: true, salesTotal: true },
    }),
    db().salesDelivery.findMany({
      where: { createdAt: { gte: cutoff } },
      select: { id: true, number: true, challanNo: true, createdAt: true, createdBy: true, status: true },
    }),
    db().salesReturn.findMany({
      where: { createdAt: { gte: cutoff } },
      select: { id: true, number: true, createdAt: true, createdBy: true, status: true },
    }),
    db().salesCollection.findMany({
      where: { createdAt: { gte: cutoff } },
      select: { id: true, number: true, amount: true, createdAt: true, createdBy: true, status: true },
    }),
    db().salesBill.findMany({
      where: { createdAt: { gte: cutoff } },
      select: { id: true, number: true, createdAt: true, createdBy: true },
    }),
    db().salesTargetBudget.findMany({
      where: { OR: [{ createdAt: { gte: cutoff } }, { year: { in: [2028, 2032] } }] },
      select: { id: true, year: true, targetType: true, createdAt: true },
    }),
    // Any demo-seed records in general
    db().salesQuotation.findMany({
      where: { createdBy: "demo-seed" },
      select: { id: true, number: true },
    }),
  ]);

  console.log("=== SALES RECORDS CREATED TODAY OR DEMO ===");
  console.log("Quotations:", quotations);
  console.log("Orders:", orders);
  console.log("Deliveries:", deliveries);
  console.log("Returns:", returns);
  console.log("Collections:", collections);
  console.log("Bills:", bills);
  console.log("Budgets:", budgets);
  console.log("Demo seed quotations:", demoRecords);
}

inspect()
  .catch(console.error)
  .finally(() => db().$disconnect());
