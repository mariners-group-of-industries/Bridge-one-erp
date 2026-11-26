import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

export interface CostedInflow {
  itemId: string | null;
  qty: number;
  /** Cost of one unit of this inflow. */
  unitCost: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Keeps an item's cost (`Item.purchasePrice`) as a moving weighted average of
 * what is in stock. Goods receipts bring stock in at the purchase rate and
 * production entries at the cost of the materials used; the GL posts production
 * and cost of goods sold at this cost, so stock value and the Inventory account
 * stay in step.
 *
 * Call it inside the document's transaction, before the inflow's stock entries
 * are written, so the current stock is what was there before.
 */
export async function absorbInflowCost(tx: Tx, businessUnitId: string, inflows: CostedInflow[]): Promise<void> {
  const byItem = totalsByItem(inflows);
  if (!byItem.size) return;
  const { items, onHand } = await costAndStock(tx, businessUnitId, [...byItem.keys()]);

  for (const item of items) {
    const inflow = byItem.get(item.id)!;
    const previousQty = Math.max(0, onHand.get(item.id) ?? 0);
    const previousCost = item.purchasePrice === null ? null : Number(item.purchasePrice);
    // Stock with no known cost takes the incoming cost; an empty stock restarts at it.
    const cost =
      previousQty > 0 && previousCost !== null
        ? (previousQty * previousCost + inflow.value) / (previousQty + inflow.qty)
        : inflow.value / inflow.qty;
    await tx.item.update({ where: { id: item.id }, data: { purchasePrice: round2(cost) } });
  }
}

/**
 * Undoes `absorbInflowCost` for a cancelled inflow (a goods receipt): takes its
 * quantity and value back out of the average. Call it before the inflow's stock
 * entries are removed. With nothing else left in stock the cost stays as it is.
 */
export async function releaseInflowCost(tx: Tx, businessUnitId: string, inflows: CostedInflow[]): Promise<void> {
  const byItem = totalsByItem(inflows);
  if (!byItem.size) return;
  const { items, onHand } = await costAndStock(tx, businessUnitId, [...byItem.keys()]);

  for (const item of items) {
    if (item.purchasePrice === null) continue;
    const inflow = byItem.get(item.id)!;
    const qty = onHand.get(item.id) ?? 0;
    const restQty = qty - inflow.qty;
    if (!(restQty > 1e-9)) continue;
    const cost = (qty * Number(item.purchasePrice) - inflow.value) / restQty;
    if (!(cost >= 0)) continue;
    await tx.item.update({ where: { id: item.id }, data: { purchasePrice: round2(cost) } });
  }
}

function totalsByItem(lines: CostedInflow[]) {
  const byItem = new Map<string, { qty: number; value: number }>();
  for (const line of lines) {
    if (!line.itemId || !(line.qty > 0) || !(line.unitCost >= 0)) continue;
    const current = byItem.get(line.itemId) ?? { qty: 0, value: 0 };
    byItem.set(line.itemId, { qty: current.qty + line.qty, value: current.value + line.qty * line.unitCost });
  }
  return byItem;
}

async function costAndStock(tx: Tx, businessUnitId: string, itemIds: string[]) {
  const [items, stock] = await Promise.all([
    tx.item.findMany({ where: { id: { in: itemIds } }, select: { id: true, purchasePrice: true } }),
    tx.stockEntry.groupBy({ by: ["itemId"], where: { businessUnitId, itemId: { in: itemIds } }, _sum: { qty: true } }),
  ]);
  return { items, onHand: new Map(stock.map((row) => [row.itemId, Number(row._sum.qty ?? 0)])) };
}
