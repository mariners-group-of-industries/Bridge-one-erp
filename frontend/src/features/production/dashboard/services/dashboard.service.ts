import type { Prisma } from "@/generated/prisma/client";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { scopedBusinessUnitIds } from "@/features/sales/lib/scope";
import { DASHBOARD_ORDER_STATUSES, productionDashboardQuerySchema, type DashboardOrderStatus, type ProductionDashboard } from "../schemas/dashboard.schema";

const TOP = 5;
const num = (value: Prisma.Decimal | null | undefined) => (value ? value.toNumber() : 0);
const round3 = (value: number) => Math.round(value * 1000) / 1000;
const round2 = (value: number) => Math.round(value * 100) / 100;
const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

export async function getProductionDashboard(actor: Actor, raw: unknown): Promise<ProductionDashboard> {
  const query = productionDashboardQuerySchema.parse(raw);
  const unitIds = await scopedBusinessUnitIds(actor);
  const where: Prisma.ProductionEntryWhereInput = {
    businessUnitId: { in: unitIds },
    status: "POSTED",
    productionDate: { gte: day(query.from), lte: day(query.to) },
    ...(query.officeId ? { officeId: query.officeId } : {}),
  };

  const orderWhere: Prisma.ProductionOrderWhereInput = { businessUnitId: { in: unitIds }, ...(query.officeId ? { officeId: query.officeId } : {}) };
  const masterWhere = { businessUnitId: { in: unitIds }, isActive: true };

  const [totals, byItem, byWorkCenter, byDay, ordersByStatus, openOrders, pendingApproval, workCenterCount, bomCount] = await Promise.all([
    db().productionEntry.aggregate({ where, _sum: { qty: true, rejectQty: true, hours: true, standardCost: true, actualCost: true }, _count: true }),
    db().productionEntry.groupBy({ by: ["itemId"], where, _sum: { qty: true }, orderBy: { _sum: { qty: "desc" } }, take: TOP }),
    db().productionEntry.groupBy({
      by: ["workCenterId"],
      where: { ...where, workCenterId: { not: null } },
      _sum: { qty: true, hours: true },
      orderBy: { _sum: { qty: "desc" } },
      take: TOP,
    }),
    db().productionEntry.groupBy({ by: ["productionDate"], where, _sum: { qty: true, rejectQty: true }, orderBy: { productionDate: "asc" } }),
    db().productionOrder.groupBy({ by: ["status"], where: { ...orderWhere, orderDate: { gte: day(query.from), lte: day(query.to) } }, _count: true }),
    db().productionOrder.aggregate({ where: { ...orderWhere, status: { in: ["APPROVED", "IN_PROGRESS"] } }, _sum: { orderQty: true, producedQty: true }, _count: true }),
    db().productionOrder.count({ where: { ...orderWhere, status: "PENDING_APPROVAL" } }),
    db().productionWorkCenter.count({ where: masterWhere }),
    db().productionBom.count({ where: masterWhere }),
  ]);
  const [items, workCenters] = await Promise.all([
    db().item.findMany({ where: { id: { in: byItem.map((row) => row.itemId) } }, select: { id: true, code: true, name: true, uom: true } }),
    db().productionWorkCenter.findMany({ where: { id: { in: byWorkCenter.map((row) => row.workCenterId!) } }, select: { id: true, code: true, name: true } }),
  ]);
  const itemById = new Map(items.map((item) => [item.id, item]));
  const centerById = new Map(workCenters.map((center) => [center.id, center]));

  const volume = round3(num(totals._sum.qty));
  const hours = round3(num(totals._sum.hours));
  const rejectQty = round3(num(totals._sum.rejectQty));
  const standardCost = round2(num(totals._sum.standardCost));
  const actualCost = round2(num(totals._sum.actualCost));
  const byStatus = Object.fromEntries(DASHBOARD_ORDER_STATUSES.map((status) => [status, 0])) as Record<DashboardOrderStatus, number>;
  for (const row of ordersByStatus) byStatus[row.status] = row._count;
  return {
    from: query.from,
    to: query.to,
    volume,
    goodQty: round3(volume - rejectQty),
    rejectQty,
    rejectRate: volume > 0 ? round2((rejectQty / volume) * 100) : null,
    hours,
    productivity: hours > 0 ? round2(volume / hours) : 0,
    entries: totals._count,
    standardCost,
    actualCost,
    variance: round2(actualCost - standardCost),
    daily: byDay.map((row) => ({ date: row.productionDate.toISOString().slice(0, 10), qty: round3(num(row._sum.qty)), rejectQty: round3(num(row._sum.rejectQty)) })),
    orders: {
      byStatus,
      open: { count: openOrders._count, orderQty: round3(num(openOrders._sum.orderQty)), producedQty: round3(num(openOrders._sum.producedQty)) },
      pendingApproval,
    },
    masters: { workCenters: workCenterCount, boms: bomCount },
    topItems: byItem.map((row) => {
      const item = itemById.get(row.itemId);
      return { itemId: row.itemId, code: item?.code ?? "", name: item?.name ?? "Unknown item", uom: item?.uom ?? "", qty: round3(num(row._sum.qty)) };
    }),
    topWorkCenters: byWorkCenter.map((row) => {
      const center = centerById.get(row.workCenterId!);
      const qty = round3(num(row._sum.qty));
      const machineHours = round3(num(row._sum.hours));
      return {
        workCenterId: row.workCenterId!,
        code: center?.code ?? "",
        name: center?.name ?? "Unknown work center",
        qty,
        hours: machineHours,
        productivity: machineHours > 0 ? Math.round((qty / machineHours) * 100) / 100 : null,
      };
    }),
  };
}
