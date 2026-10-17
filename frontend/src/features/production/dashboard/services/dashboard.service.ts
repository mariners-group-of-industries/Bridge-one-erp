import type { Prisma } from "@/generated/prisma/client";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { scopedBusinessUnitIds } from "@/features/sales/lib/scope";
import { productionDashboardQuerySchema, type ProductionDashboard } from "../schemas/dashboard.schema";

const TOP = 5;
const num = (value: Prisma.Decimal | null | undefined) => (value ? value.toNumber() : 0);
const round3 = (value: number) => Math.round(value * 1000) / 1000;
const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

export async function getProductionDashboard(actor: Actor, raw: unknown): Promise<ProductionDashboard> {
  const query = productionDashboardQuerySchema.parse(raw);
  const unitIds = await scopedBusinessUnitIds(actor);
  const where: Prisma.ProductionEntryWhereInput = {
    businessUnitId: { in: unitIds },
    productionDate: { gte: day(query.from), lte: day(query.to) },
    ...(query.officeId ? { officeId: query.officeId } : {}),
  };

  const [totals, byItem, byWorkCenter] = await Promise.all([
    db().productionEntry.aggregate({ where, _sum: { qty: true, hours: true }, _count: true }),
    db().productionEntry.groupBy({ by: ["itemId"], where, _sum: { qty: true }, orderBy: { _sum: { qty: "desc" } }, take: TOP }),
    db().productionEntry.groupBy({
      by: ["workCenterId"],
      where: { ...where, workCenterId: { not: null } },
      _sum: { qty: true, hours: true },
      orderBy: { _sum: { qty: "desc" } },
      take: TOP,
    }),
  ]);
  const [items, workCenters] = await Promise.all([
    db().item.findMany({ where: { id: { in: byItem.map((row) => row.itemId) } }, select: { id: true, code: true, name: true, uom: true } }),
    db().productionWorkCenter.findMany({ where: { id: { in: byWorkCenter.map((row) => row.workCenterId!) } }, select: { id: true, code: true, name: true } }),
  ]);
  const itemById = new Map(items.map((item) => [item.id, item]));
  const centerById = new Map(workCenters.map((center) => [center.id, center]));

  const volume = round3(num(totals._sum.qty));
  const hours = round3(num(totals._sum.hours));
  return {
    from: query.from,
    to: query.to,
    volume,
    hours,
    productivity: hours > 0 ? Math.round((volume / hours) * 100) / 100 : 0,
    entries: totals._count,
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
