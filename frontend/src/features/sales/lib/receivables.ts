import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/prisma/client";
import { ageBalance, money, type AgedBalance } from "../dashboard/lib/aggregate";

export interface CustomerBalance extends AgedBalance {
  /** Everything delivered and not yet collected or returned. */
  outstanding: number;
}

const num = (value: Prisma.Decimal | null | undefined) => (value ? value.toNumber() : 0);

/**
 * Receivable of each customer as of `asOf` (UTC midnight of a @db.Date), from
 * submitted deliveries, returns and collections, aged first-in-first-out.
 * Only customers with deliveries up to `asOf` appear in the result.
 */
export async function customerBalances(options: {
  businessUnitIds: string[];
  asOf: Date;
  customerIds?: string[];
}): Promise<Map<string, CustomerBalance>> {
  const scope = {
    businessUnitId: { in: options.businessUnitIds },
    status: "SUBMITTED" as const,
    ...(options.customerIds ? { customerId: { in: options.customerIds } } : {}),
  };
  const { asOf } = options;
  const receivable = (dueDate: Prisma.DateTimeFilter) =>
    db().salesDelivery.groupBy({
      by: ["customerId"],
      where: { ...scope, deliveryDate: { lte: asOf }, dueDate },
      _sum: { totalAmount: true },
    });

  const [pastDue, dueToday, notYetDue, collected, returned] = await Promise.all([
    receivable({ lt: asOf }),
    receivable({ equals: asOf }),
    receivable({ gt: asOf }),
    db().salesCollection.groupBy({
      by: ["customerId"],
      where: { ...scope, collectionDate: { lte: asOf } },
      _sum: { amount: true },
    }),
    db().salesReturn.groupBy({
      by: ["customerId"],
      where: { ...scope, returnDate: { lte: asOf } },
      _sum: { totalAmount: true },
    }),
  ]);

  const ledgers = new Map<string, { pastDue: number; dueToday: number; notYetDue: number; credits: number }>();
  const ledger = (customerId: string) => {
    let entry = ledgers.get(customerId);
    if (!entry) ledgers.set(customerId, (entry = { pastDue: 0, dueToday: 0, notYetDue: 0, credits: 0 }));
    return entry;
  };
  for (const row of pastDue) ledger(row.customerId).pastDue += num(row._sum.totalAmount);
  for (const row of dueToday) ledger(row.customerId).dueToday += num(row._sum.totalAmount);
  for (const row of notYetDue) ledger(row.customerId).notYetDue += num(row._sum.totalAmount);
  for (const row of collected) if (ledgers.has(row.customerId)) ledger(row.customerId).credits += num(row._sum.amount);
  for (const row of returned) if (ledgers.has(row.customerId)) ledger(row.customerId).credits += num(row._sum.totalAmount);

  return new Map(
    [...ledgers].map(([customerId, entry]) => {
      const aged = ageBalance(entry);
      return [customerId, { ...aged, outstanding: money(aged.overdue + aged.due) }];
    }),
  );
}
