import { scopedBusinessUnitIds } from "@/features/sales/lib/scope";
import { apiHandler, ok } from "@/lib/api/handler";
import { db } from "@/lib/prisma/client";
import { isPlaceInOrgScope, resolvePurchaseOrgScope } from "@/lib/purchase-store/governance";

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/**
 * GET: what the inventory forms and filters choose from (iBOS layouts): offices and
 * warehouses, active items with their type, category path, prices and alternate unit,
 * employees, the latest sales orders, suppliers, projects (cost centers) and expense
 * heads ("Issue For") and the company for report headers, all limited to the user's business units.
 */
export const GET = apiHandler("purchase:read", async (_request, _context, actor) => {
  // Configuration › Employee › Org Access: only the business units, offices and warehouses the user may use.
  const [unitIds, orgScope] = await Promise.all([scopedBusinessUnitIds(actor), resolvePurchaseOrgScope(actor)]);
  const prisma = db();
  const [warehouses, items, categories, employees, salesOrders, suppliers, projects, expenseHeads, unit, received, gatePasses] = await Promise.all([
    prisma.warehouse.findMany({
      where: { office: { businessUnitId: { in: unitIds } } },
      select: { id: true, name: true, officeId: true, office: { select: { name: true, businessUnitId: true } } },
      orderBy: [{ office: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.item.findMany({
      where: { businessUnitId: { in: unitIds }, isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        uom: true,
        businessUnitId: true,
        itemType: true,
        categoryId: true,
        purchasePrice: true,
        tradingPrice: true,
        mrp: true,
        altUom: true,
        altUomFactor: true,
        barcode: true,
        category: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.itemCategory.findMany({ where: { businessUnitId: { in: unitIds } }, select: { id: true, parentId: true, level: true, name: true } }),
    prisma.employee.findMany({
      where: { isActive: true, office: { businessUnitId: { in: unitIds } } },
      select: { id: true, employeeCode: true, name: true, department: true, mobile: true },
      orderBy: { name: "asc" },
    }),
    prisma.salesOrder.findMany({ where: { businessUnitId: { in: unitIds } }, select: { id: true, number: true }, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.supplier.findMany({ where: { businessUnitId: { in: unitIds }, isActive: true }, select: { id: true, code: true, name: true }, orderBy: { name: "asc" } }),
    prisma.costCenter.findMany({ where: { status: "ACTIVE" }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
    prisma.account.findMany({ where: { accountType: "EXPENSE", isGroup: false, status: "ACTIVE" }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
    // Report headers: the user's company name and address.
    prisma.businessUnit.findFirst({ where: { id: { in: unitIds } }, select: { company: { select: { name: true, address: true } } }, orderBy: { name: "asc" } }),
    // "Supplier Wise": which suppliers delivered each item (goods receipts).
    prisma.goodsReceiptLine.findMany({
      where: { itemId: { not: null }, receipt: { businessUnitId: { in: unitIds } } },
      select: { itemId: true, receipt: { select: { supplierId: true } } },
      distinct: ["itemId", "receiptId"],
    }),
    // Gate In Out "Vehicle No": vehicles entered on earlier gate passes.
    prisma.inventoryDocument.findMany({
      where: { businessUnitId: { in: unitIds }, type: "GATE_PASS" },
      select: { meta: true },
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
  ]);
  const suppliersOf = new Map<string, Set<string>>();
  for (const r of received) {
    if (!r.itemId) continue;
    const set = suppliersOf.get(r.itemId) ?? new Set<string>();
    set.add(r.receipt.supplierId);
    suppliersOf.set(r.itemId, set);
  }
  const vehicles = new Map<string, string>();
  for (const g of gatePasses) {
    const m = (g.meta ?? {}) as Record<string, string>;
    const no = m.vehicleNo?.trim();
    if (no && !vehicles.has(no)) vehicles.set(no, m.vehicleName?.trim() ?? "");
  }

  // Category → Sub Category → Minor Category names for each item's category.
  const byId = new Map(categories.map((c) => [c.id, c]));
  const pathOf = (id: string | null) => {
    const chain: string[] = [];
    let current = id ? byId.get(id) : undefined;
    for (let guard = 0; current && guard < 6; guard++) {
      chain.unshift(current.name);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return { category: chain[0] ?? "Uncategorised", subCategory: chain[1] ?? null, minorCategory: chain[2] ?? null };
  };

  return ok({
    warehouses: warehouses
      .filter((w) => isPlaceInOrgScope(orgScope, { warehouseId: w.id, officeId: w.officeId, businessUnitId: w.office.businessUnitId }))
      .map((w) => ({ id: w.id, name: w.name, officeId: w.officeId, officeName: w.office.name, businessUnitId: w.office.businessUnitId })),
    items: items.map((i) => ({
      id: i.id,
      code: i.code,
      name: i.name,
      uom: i.uom,
      businessUnitId: i.businessUnitId,
      itemType: i.itemType ?? null,
      ...pathOf(i.categoryId),
      costPrice: num(i.purchasePrice),
      tradePrice: num(i.tradingPrice),
      mrp: num(i.mrp),
      altUom: i.altUom ?? null,
      altUomFactor: num(i.altUomFactor),
      supplierIds: [...(suppliersOf.get(i.id) ?? [])],
      barcode: i.barcode ?? null,
    })),
    employees: employees.map((e) => ({ id: e.id, code: e.employeeCode, name: e.name, department: e.department ?? null, phone: e.mobile ?? null })),
    salesOrders: salesOrders.map((s) => ({ id: s.id, number: s.number })),
    suppliers,
    projects,
    expenseHeads,
    company: unit?.company ?? null,
    vehicles: [...vehicles].map(([number, name]) => ({ number, name })).sort((a, b) => a.number.localeCompare(b.number)),
  });
});
