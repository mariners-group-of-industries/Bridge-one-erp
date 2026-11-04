import { scopedBusinessUnitIds } from "@/features/sales/lib/scope";
import { apiHandler, ok } from "@/lib/api/handler";
import { db } from "@/lib/prisma/client";

/** GET: warehouses and active items the user can see, for the inventory forms and filters. */
export const GET = apiHandler("purchase:read", async (_request, _context, actor) => {
  const unitIds = await scopedBusinessUnitIds(actor);
  const [warehouses, items] = await Promise.all([
    db().warehouse.findMany({
      where: { office: { businessUnitId: { in: unitIds } } },
      select: { id: true, name: true, office: { select: { name: true, businessUnitId: true } } },
      orderBy: [{ office: { name: "asc" } }, { name: "asc" }],
    }),
    db().item.findMany({
      where: { businessUnitId: { in: unitIds }, isActive: true },
      select: { id: true, code: true, name: true, uom: true, businessUnitId: true, category: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
  ]);
  return ok({
    warehouses: warehouses.map((w) => ({ id: w.id, name: w.name, officeName: w.office.name, businessUnitId: w.office.businessUnitId })),
    items: items.map((i) => ({ id: i.id, code: i.code, name: i.name, uom: i.uom, businessUnitId: i.businessUnitId, category: i.category?.name ?? "Uncategorised" })),
  });
});
