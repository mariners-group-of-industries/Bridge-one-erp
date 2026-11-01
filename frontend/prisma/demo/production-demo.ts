/**
 * Demo data for trying the Production pages by hand: work centers, bills of material,
 * production orders in every status and production entries over the current month,
 * made through the same services the screens use (so stock, order progress,
 * dashboard and reports agree).
 *
 * Everything it writes has createdBy = DEMO_ACTOR_ID, so clearProductionDemo()
 * removes exactly that and nothing else. Master data (offices, warehouses, items,
 * departments, work center types, employees, GL accounts) is read, never changed.
 * The actor differs from the Sales demo's, so the two can be cleared independently.
 */
import { createBom, setBomActive, setBomChildren } from "@/features/production/bom/services/bom.service";
import { cancelEntry, createEntry, entryForm } from "@/features/production/entries/services/entry.service";
import { actOnOrder, createOrder } from "@/features/production/orders/services/order.service";
import { createWorkCenter, setWorkCenterActive } from "@/features/production/work-centers/services/work-center.service";
import { adjustStock } from "@/features/sales/deliveries/services/stock.service";
import type { Actor, Permission } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";

export const DEMO_ACTOR_ID = "demo-production";

const actor: Actor = {
  id: DEMO_ACTOR_ID,
  name: "Production Demo",
  role: "ADMINISTRATOR",
  isMaster: true,
  permissions: new Set<Permission>(["production:read", "production:write", "production:approve", "sales:read", "sales:write"]),
  companyScope: "ALL",
};

/** "YYYY-MM-DD" of `today` shifted by `days`, but never before the 1st of its month. */
function shift(today: string, days: number): string {
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  const value = date.toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;
  return value < monthStart ? monthStart : value;
}

export interface ProductionDemoSummary {
  office: string;
  materialWarehouse: string;
  outputWarehouse: string;
  workCenters: string[];
  boms: string[];
  orders: string[];
  entries: string[];
}

/** Material rates (Tk per unit) for the demo BOMs; the item master has no purchase price. */
const RATES = [185, 62, 48, 95, 38, 140, 220, 75];

/** Writes the demo month ending `today` (local date "YYYY-MM-DD"). Refuses if demo data already exists. */
export async function seedProductionDemo(today: string, log: (line: string) => void = () => undefined): Promise<ProductionDemoSummary> {
  const existing = await db().productionBom.count({ where: { createdBy: DEMO_ACTOR_ID } });
  if (existing > 0) throw new Error("Production demo data already exists. Run the clear command first.");

  // ── Pick master data ──
  const offices = await db().office.findMany({
    where: { warehouses: { some: {} } },
    select: { id: true, name: true, businessUnitId: true, warehouses: { select: { id: true, name: true }, orderBy: { name: "asc" } } },
  });
  const office = offices.sort((a, b) => b.warehouses.length - a.warehouses.length)[0];
  if (!office || office.warehouses.length < 2) throw new Error("Need an office with at least two warehouses (materials and finished goods).");
  const businessUnitId = office.businessUnitId;
  const byName = (pattern: RegExp) => office.warehouses.find((warehouse) => pattern.test(warehouse.name));
  const materialWh = byName(/material/i) ?? office.warehouses[0];
  const outputWh = byName(/finished|fg/i) ?? office.warehouses.find((warehouse) => warehouse.id !== materialWh.id)!;

  const types = await db().productionWorkCenterType.findMany({ where: { businessUnitId }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const departments = await db().productionDepartment.findMany({
    where: { businessUnitId, sections: { some: {} } },
    select: { id: true, name: true, sections: { select: { id: true, name: true }, orderBy: { name: "asc" } } },
    orderBy: { name: "asc" },
  });
  const finished = await db().item.findMany({
    where: { businessUnitId, isActive: true, itemType: "Finished Goods" },
    select: { id: true, code: true, name: true },
    orderBy: { code: "asc" },
    take: 5,
  });
  const raw = await db().item.findMany({ where: { businessUnitId, isActive: true, itemType: "Raw Material" }, select: { id: true, name: true }, orderBy: { code: "asc" }, take: 6 });
  const packing = await db().item.findMany({ where: { businessUnitId, isActive: true, itemType: "Packaging Material" }, select: { id: true, name: true }, orderBy: { code: "asc" }, take: 2 });
  const accounts = await db().account.findMany({ where: { accountType: "EXPENSE", isGroup: false, status: "ACTIVE" }, select: { id: true }, orderBy: { code: "asc" }, take: 2 });
  const operators = await db().employee.findMany({ where: { isActive: true, officeId: office.id }, select: { id: true }, orderBy: { employeeCode: "asc" }, take: 6 });
  const salesOrder = await db().salesOrder.findFirst({
    where: { businessUnitId, status: { in: ["APPROVED", "COMPLETED"] } },
    select: { id: true, customerId: true },
    orderBy: { createdAt: "desc" },
  });
  if (types.length === 0) throw new Error("Need at least one work center type (Production › Work Center › ADD NEW).");
  if (departments.length === 0) throw new Error("Need a production department with a section.");
  if (finished.length < 4) throw new Error("Need at least 4 active Finished Goods items.");
  if (raw.length < 5 || packing.length < 1) throw new Error("Need at least 5 Raw Material and 1 Packaging Material items.");
  log(`Office ${office.name}: materials from ${materialWh.name}, output to ${outputWh.name}.`);

  const department = departments[0];
  const section = (index: number) => department.sections[index % department.sections.length];
  const type = (index: number) => types[index % types.length];
  const day = (offset: number) => shift(today, offset);
  const monthStart = `${today.slice(0, 7)}-01`;
  const summary: ProductionDemoSummary = {
    office: office.name,
    materialWarehouse: materialWh.name,
    outputWarehouse: outputWh.name,
    workCenters: [],
    boms: [],
    orders: [],
    entries: [],
  };

  // ── Work centers (one inactive) ──
  const workCenter = async (index: number, code: string, name: string, capacity: number) => {
    const created = await createWorkCenter(actor, {
      businessUnitId,
      name,
      code,
      typeId: type(index).id,
      standardRunHour: 16,
      capacityPerHour: capacity,
      ratedCapacityPerHour: Math.round(capacity * 1.2),
      costPerHour: 850 + index * 150,
      remarks: "Demo work center",
      departmentId: department.id,
      departmentSectionId: section(index).id,
      warehouseIds: index === 0 ? [materialWh.id, outputWh.id] : [],
      operatorIds: operators.slice(index * 2, index * 2 + 2).map((employee) => employee.id),
    });
    summary.workCenters.push(`${created.code} ${created.name}`);
    return created;
  };
  const lineA = await workCenter(0, "DEMO-WC-01", "Demo Biscuit Line A", 1200);
  const lineB = await workCenter(1, "DEMO-WC-02", "Demo Mixing Line B", 800);
  const packLine = await workCenter(2, "DEMO-WC-03", "Demo Packing Line", 2000);
  const oldLine = await workCenter(3, "DEMO-WC-04", "Demo Old Oven (retired)", 400);
  await setWorkCenterActive(actor, oldLine.id, { version: oldLine.updatedAt, isActive: false });
  log(`Work centers: ${summary.workCenters.join(", ")} (last one inactive).`);

  // ── Bills of material ──
  const material = (index: number, qty: number, wastagePercent = 2) => ({ itemId: raw[index].id, qty, wastagePercent, rate: RATES[index % RATES.length] });
  const packMaterial = (qty: number) => ({ itemId: packing[0].id, qty, wastagePercent: 1, rate: 12 });
  const overheads = accounts.length
    ? [
        { accountId: accounts[0].id, percentage: 5, amount: 0 },
        ...(accounts[1] ? [{ accountId: accounts[1].id, percentage: null, amount: 1500 }] : []),
      ]
    : [];
  const bomA = await createBom(actor, {
    businessUnitId,
    name: `DEMO - ${finished[0].name}`,
    bomType: "SINGLE_OUTPUT",
    departmentId: department.id,
    departmentSectionId: section(0).id,
    remarks: "Demo BOM: single output with wastage and overheads",
    outputs: [{ itemId: finished[0].id, outputType: "FINISHED_GOODS", netWeight: 0.72, lotSizeQty: 1000, costPercent: 100, tolerancePercent: 2, isPrimary: true }],
    materials: [material(0, 120), material(1, 450), material(2, 90), packMaterial(25)],
    wastages: [{ itemId: raw[4].id, outputType: "SCRAP", ratioPercent: 1.5, isMandatory: false, calcWithNetWeight: true, calcWithProcessRunner: false }],
    overheads,
  });
  const bomB = await createBom(actor, {
    businessUnitId,
    name: `DEMO - ${finished[1].name}`,
    bomType: "SINGLE_OUTPUT",
    departmentId: department.id,
    departmentSectionId: section(1).id,
    remarks: "Demo BOM: single output",
    outputs: [{ itemId: finished[1].id, outputType: "FINISHED_GOODS", netWeight: 4, lotSizeQty: 500, costPercent: 100, tolerancePercent: 1, isPrimary: true }],
    materials: [material(1, 900), material(3, 400), material(0, 250, 1)],
    overheads: overheads.slice(0, 1),
  });
  const bomC = await createBom(actor, {
    businessUnitId,
    name: `DEMO - ${finished[2].name} + ${finished[3].name}`,
    bomType: "MULTIPLE_OUTPUT",
    departmentId: department.id,
    departmentSectionId: section(2).id,
    remarks: "Demo BOM: two outputs sharing the cost 60/40",
    outputs: [
      { itemId: finished[2].id, outputType: "FINISHED_GOODS", netWeight: 4, lotSizeQty: 300, costPercent: 60, tolerancePercent: 2, isPrimary: true },
      { itemId: finished[3].id, outputType: "FINISHED_GOODS", netWeight: 4, lotSizeQty: 200, costPercent: 40, tolerancePercent: 2, isPrimary: false },
    ],
    materials: [material(2, 600), material(3, 300), packMaterial(40)],
    wastages: [{ itemId: raw[4].id, outputType: "BY_PRODUCT", ratioPercent: 3, isMandatory: true, calcWithNetWeight: false, calcWithProcessRunner: false }],
  });
  const bomOld = await createBom(actor, {
    businessUnitId,
    name: `DEMO - ${finished[0].name} (old recipe)`,
    bomType: "SINGLE_OUTPUT",
    departmentId: department.id,
    departmentSectionId: section(0).id,
    remarks: "Demo BOM: replaced, kept inactive",
    outputs: [{ itemId: finished[0].id, outputType: "FINISHED_GOODS", netWeight: 0.7, lotSizeQty: 1000, costPercent: 100 }],
    materials: [material(0, 130), material(1, 470)],
  });
  await setBomActive(actor, bomOld.id, { version: bomOld.updatedAt, isActive: false });
  await setBomChildren(actor, bomC.id, { links: [{ childBomId: bomB.id, stage: "Stage 1 - Dough" }] });
  summary.boms.push(bomA.name, bomB.name, bomC.name, `${bomOld.name} (inactive)`);
  log(`BOMs: ${summary.boms.join("; ")}.`);

  // ── Opening stock of every material in the materials warehouse ──
  for (const item of [...raw.slice(0, 5), packing[0]]) {
    await adjustStock(actor, { warehouseId: materialWh.id, itemId: item.id, qty: 200_000, source: "OPENING", postingDate: monthStart, remarks: "Production demo opening stock" });
  }
  log(`Opening stock: 200,000 of each material in ${materialWh.name}.`);

  // ── Production orders ──
  const order = async (bom: { id: string }, itemIndex: number, quantity: number, offset: number, extra: Record<string, unknown> = {}) => {
    const created = await createOrder(actor, {
      orderDate: day(offset),
      productionDate: day(offset + 1),
      itemId: finished[itemIndex].id,
      bomId: bom.id,
      quantity,
      officeId: office.id,
      warehouseId: materialWh.id,
      workCenterId: null,
      machineName: null,
      narration: "Demo production order",
      ...extra,
    });
    summary.orders.push(created.number);
    return created;
  };
  const act = async (record: { id: string }, action: "approve" | "reject" | "start" | "close" | "cancel", comment?: string) => {
    const current = await db().productionOrder.findUniqueOrThrow({ where: { id: record.id }, select: { updatedAt: true } });
    return actOnOrder(actor, record.id, { version: current.updatedAt.toISOString(), action, comment });
  };

  const closed = await order(bomA, 0, 3000, -26, { workCenterId: lineA.id, machineName: "Oven 1" });
  await act(closed, "approve");
  const running = await order(bomB, 1, 2000, -18, { workCenterId: lineB.id, machineName: "Mixer 2" });
  await act(running, "approve");
  await act(running, "start");
  const multi = await order(bomC, 2, 1200, -12, { workCenterId: packLine.id });
  await act(multi, "approve");
  const forCustomer = salesOrder
    ? await order(bomA, 0, 1500, -6, { customerId: salesOrder.customerId, salesOrderId: salesOrder.id, customerPoNo: "DEMO-PO-7781", workCenterId: lineA.id })
    : await order(bomA, 0, 1500, -6, { workCenterId: lineA.id });
  await act(forCustomer, "approve");
  const pending = await order(bomB, 1, 800, -2, { workCenterId: lineB.id });
  const rejected = await order(bomC, 3, 600, -15);
  await act(rejected, "reject", "Demo: material plan not confirmed");
  const cancelled = await order(bomA, 0, 500, -9);
  await act(cancelled, "approve");
  await act(cancelled, "cancel", "Demo: customer moved the delivery to next month");
  log(`Orders: ${summary.orders.join(", ")} (closed, in progress, approved ×2, pending ${pending.number}, rejected, cancelled).`);

  // ── Production entries: consumption close to standard, a little wastage and reject ──
  const entry = async (orderId: string, offset: number, totalQty: number, rejectQty: number, shiftName: "Morning" | "Day" | "Evening" | "Night", drift: number, workCenterId: string | null) => {
    const form = await entryForm(actor, orderId);
    const created = await createEntry(actor, {
      orderId,
      entryDate: day(offset),
      shift: shiftName,
      workCenterId,
      departmentId: department.id,
      departmentSectionId: null,
      outputWarehouseId: outputWh.id,
      totalQty,
      rejectQty,
      hours: Math.min(Math.round((totalQty / 250) * 10) / 10, 24),
      remarks: "Demo production entry",
      materials: form.materials.map((line) => {
        const actualQty = Math.round(line.perUnit * totalQty * drift * 10_000) / 10_000;
        const wastageQty = Math.round(actualQty * 0.01 * 10_000) / 10_000;
        return { itemId: line.itemId, actualQty, wastageQty, scrapQty: Math.round(actualQty * 0.005 * 10_000) / 10_000 };
      }),
    });
    summary.entries.push(created.number);
    return created;
  };
  // Closed order: three shifts finish it.
  await entry(closed.id, -25, 1200, 15, "Morning", 1.01, lineA.id);
  await entry(closed.id, -24, 1100, 10, "Evening", 0.99, lineA.id);
  await entry(closed.id, -22, 725, 0, "Day", 1.02, lineA.id);
  // In progress: two entries, one later cancelled.
  await entry(running.id, -17, 600, 8, "Morning", 1.03, lineB.id);
  const wrong = await entry(running.id, -16, 450, 0, "Night", 1, lineB.id);
  await cancelEntry(actor, wrong.id, { version: wrong.updatedAt, reason: "Demo: entered against the wrong shift" });
  await entry(running.id, -10, 500, 5, "Day", 0.98, lineB.id);
  // Multiple-output order: one part done.
  await entry(multi.id, -8, 400, 4, "Morning", 1, packLine.id);
  // Customer order: recent entries so the dashboard's last days are filled.
  await entry(forCustomer.id, -4, 500, 6, "Morning", 1.01, lineA.id);
  await entry(forCustomer.id, -1, 450, 3, "Evening", 1, lineA.id);
  log(`Entries: ${summary.entries.join(", ")} (one cancelled).`);
  return summary;
}

/** Removes everything the demo wrote (createdBy = DEMO_ACTOR_ID) and nothing else. */
export async function clearProductionDemo(): Promise<Record<string, number>> {
  const who = DEMO_ACTOR_ID;
  return db().$transaction(async (tx) => {
    const counts: Record<string, number> = {};
    const run = async (label: string, sql: string) => {
      counts[label] = await tx.$executeRawUnsafe(sql, who);
    };
    // Entries and their stock moves first, then orders, BOMs and work centers (lines cascade).
    await run("stock entries", `DELETE FROM stock_entries WHERE "createdBy" = $1`);
    await run("entries", `DELETE FROM production_entries WHERE "createdBy" = $1`);
    await run("orders", `DELETE FROM production_orders WHERE "createdBy" = $1`);
    await run("bom links", `DELETE FROM production_bom_links WHERE "childBomId" IN (SELECT id FROM production_boms WHERE "createdBy" = $1)`);
    await run("boms", `DELETE FROM production_boms WHERE "createdBy" = $1`);
    await run("work centers", `DELETE FROM production_work_centers WHERE "createdBy" = $1`);
    return counts;
  }, { timeout: 60_000 });
}
