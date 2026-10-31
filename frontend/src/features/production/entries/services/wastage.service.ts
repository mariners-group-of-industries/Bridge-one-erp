import { Prisma } from "@/generated/prisma/client";
import { badRequest, conflict, notFound } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { fromDbDate } from "@/features/sales/lib/dates";
import { scopedBusinessUnitIds } from "@/features/sales/lib/scope";
import { targetBusinessUnit } from "../../lib/business-unit";
import { entryWastageSchema, processInputSchema, type EntryWastageForm, type EntryWastageLine, type ProcessOption } from "../schemas/entry.schema";

const num = (value: Prisma.Decimal) => value.toNumber();

export const WASTAGE_INCLUDE = {
  process: { select: { name: true } },
  item: { select: { code: true, name: true } },
} satisfies Prisma.ProductionEntryWastageInclude;

export function toWastageLine(line: Prisma.ProductionEntryWastageGetPayload<{ include: typeof WASTAGE_INCLUDE }>): EntryWastageLine {
  return { processId: line.processId, processName: line.process.name, itemId: line.itemId, code: line.item.code, name: line.item.name, uom: line.uom, qty: num(line.qty) };
}

async function findEntry(actor: Actor, id: string) {
  const unitIds = await scopedBusinessUnitIds(actor);
  const entry = await db().productionEntry.findFirst({
    where: { id, businessUnitId: { in: unitIds } },
    select: {
      id: true,
      businessUnitId: true,
      number: true,
      productionDate: true,
      status: true,
      order: { select: { number: true } },
      item: { select: { code: true, name: true, uom: true } },
    },
  });
  if (!entry) throw notFound("Production entry");
  return entry;
}

/** "Process Wise Wastage Entry" of one production entry: header, saved lines, processes and items. */
export async function entryWastageForm(actor: Actor, id: string): Promise<EntryWastageForm> {
  const entry = await findEntry(actor, id);
  const inUnit = { businessUnitId: entry.businessUnitId };
  const [lines, processes, items] = await Promise.all([
    db().productionEntryWastage.findMany({ where: { entryId: id }, include: WASTAGE_INCLUDE, orderBy: { lineNo: "asc" } }),
    db().productionProcess.findMany({ where: inUnit, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db().item.findMany({ where: { ...inUnit, isActive: true }, select: { id: true, code: true, name: true, uom: true }, orderBy: { name: "asc" } }),
  ]);
  return {
    entry: {
      id: entry.id,
      businessUnitId: entry.businessUnitId,
      number: entry.number,
      entryDate: fromDbDate(entry.productionDate),
      orderNumber: entry.order.number,
      itemCode: entry.item.code,
      itemName: entry.item.name,
      uom: entry.item.uom,
      status: entry.status,
    },
    lines: lines.map(toWastageLine),
    processes,
    items,
    canEdit: entry.status === "POSTED" && actor.permissions.has("production:write"),
  };
}

/**
 * Replaces the wastage lines of a posted entry. Wastage is recorded for reporting only:
 * the materials are already consumed by the entry, so stock does not move again.
 */
export async function saveEntryWastage(actor: Actor, id: string, raw: unknown): Promise<EntryWastageForm> {
  const { lines } = entryWastageSchema.parse(raw);
  const entry = await findEntry(actor, id);
  if (entry.status !== "POSTED") throw badRequest("A cancelled production entry cannot take wastage.");
  const processIds = [...new Set(lines.map((line) => line.processId))];
  const itemIds = [...new Set(lines.map((line) => line.itemId))];
  await db().$transaction(async (tx) => {
    const [processes, items] = await Promise.all([
      tx.productionProcess.findMany({ where: { id: { in: processIds }, businessUnitId: entry.businessUnitId }, select: { id: true } }),
      tx.item.findMany({ where: { id: { in: itemIds }, businessUnitId: entry.businessUnitId }, select: { id: true, uom: true } }),
    ]);
    if (processes.length !== processIds.length) throw badRequest("Choose processes of this business unit.");
    if (items.length !== itemIds.length) throw badRequest("Choose items of this business unit.");
    const uomOf = new Map(items.map((item) => [item.id, item.uom]));
    await tx.productionEntryWastage.deleteMany({ where: { entryId: id } });
    await tx.productionEntryWastage.createMany({
      data: lines.map((line, index) => ({ entryId: id, lineNo: index + 1, processId: line.processId, itemId: line.itemId, uom: uomOf.get(line.itemId)!, qty: line.qty, createdBy: actor.id })),
    });
  });
  return entryWastageForm(actor, id);
}

/** "ADD NEW" process name. */
export async function createProcess(actor: Actor, raw: unknown): Promise<ProcessOption> {
  const input = processInputSchema.parse(raw);
  const businessUnitId = await targetBusinessUnit(actor, input.businessUnitId);
  try {
    return await db().productionProcess.create({ data: { businessUnitId, name: input.name }, select: { id: true, name: true } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw conflict(`Process ${input.name} already exists.`);
    throw error;
  }
}
