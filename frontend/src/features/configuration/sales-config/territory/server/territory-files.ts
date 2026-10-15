import ExcelJS from "exceljs";
import { cellText, describe } from "@/features/configuration/entity-master-data/supplier/server/supplier-excel";
import { AppError, badRequest } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import type { TerritoryImportResult } from "../schemas/territory.schema";
import { createNode, ensureLayers, getTree, updateNode } from "./territory.service";

/** Sales Setup Excel download/upload: the territory tree and territory-wise customers. */

async function book(sheetName: string, headers: string[], rows: string[][]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = headers.map((header) => ({
    header,
    key: header,
    width: Math.max(14, header.length + 4),
  }));
  const head = sheet.getRow(1);
  head.font = { bold: true, color: { argb: "FF1E3A8A" } };
  head.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFDBEAFE" },
  };
  rows.forEach((row) => sheet.addRow(row));
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

async function readRows(bytes: Uint8Array) {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  } catch {
    throw new AppError(400, "VALIDATION_ERROR", "The file is not a valid Excel (.xlsx) workbook.");
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new AppError(400, "VALIDATION_ERROR", "The workbook has no sheets.");
  const headers = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, column) =>
    headers.set(
      cellText(cell.value)
        .trim()
        .toLowerCase()
        .replace(/\s*\*$/, ""),
      column,
    ),
  );
  const rows: { row: number; get: (header: string) => string }[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const get = (header: string) => {
      const column = headers.get(header.toLowerCase());
      return column ? cellText(row.getCell(column).value) : "";
    };
    if ([...headers.keys()].every((header) => get(header) === "")) return;
    rows.push({ row: rowNumber, get });
  });
  if (rows.length > 5000) throw new AppError(400, "VALIDATION_ERROR", "Upload at most 5000 rows per file.");
  return { headers, rows };
}

// ─── Territory tree ───────────────────────────────────────────────────────────

/** One row per path (top layer down to each leaf); a code and name column per layer. */
export async function exportTree(actor: Actor, businessUnitId: string): Promise<Uint8Array> {
  const tree = await getTree(actor, businessUnitId);
  const headers = tree.layers.flatMap((layer) => [`${layer.name} Code`, `${layer.name} Name`]);
  const byId = new Map(tree.nodes.map((node) => [node.id, node]));
  const hasChildren = new Set(tree.nodes.map((node) => node.parentId).filter(Boolean));
  const rows = tree.nodes
    .filter((node) => !hasChildren.has(node.id))
    .map((leaf) => {
      const path: typeof tree.nodes = [];
      for (let node: typeof leaf | undefined = leaf; node; node = node.parentId ? byId.get(node.parentId) : undefined) path.unshift(node);
      return tree.layers.flatMap((layer) => {
        const node = path.find((n) => n.level === layer.level);
        return [node?.code ?? "", node?.name ?? ""];
      });
    })
    .sort((a, b) => a.join("|").localeCompare(b.join("|")));
  return book("Territories", headers, rows);
}

export async function treeTemplate(actor: Actor, businessUnitId: string): Promise<Uint8Array> {
  const tree = await getTree(actor, businessUnitId);
  return book(
    "Territories",
    tree.layers.flatMap((layer) => [`${layer.name} Code`, `${layer.name} Name`]),
    [],
  );
}

/** Creates missing nodes along each row's path and renames existing ones (matched by code). */
export async function importTree(actor: Actor, businessUnitId: string, bytes: Uint8Array): Promise<TerritoryImportResult> {
  await ensureLayers(businessUnitId);
  const tree = await getTree(actor, businessUnitId);
  if (tree.businessUnitId !== businessUnitId) throw badRequest("Select a business unit you can access.");
  const { rows } = await readRows(bytes);
  const result: TerritoryImportResult = { created: 0, updated: 0, errors: [] };

  for (const { row, get } of rows) {
    try {
      let parentId = "";
      for (const layer of tree.layers) {
        const code = get(`${layer.name} Code`);
        const name = get(`${layer.name} Name`);
        if (!code) break;
        const existing = await db().salesTerritoryNode.findFirst({
          where: {
            businessUnitId,
            code: { equals: code, mode: "insensitive" },
          },
          include: { layer: { select: { level: true } } },
        });
        if (existing) {
          if (existing.layer.level !== layer.level) throw new Error(`Code "${code}" is a ${tree.layers.find((l) => l.level === existing.layer.level)?.name ?? "different"} entry, not ${layer.name}.`);
          if ((existing.parentId ?? "") !== parentId) throw new Error(`"${code}" sits under a different parent in the tree.`);
          if (name && name !== existing.name) {
            await updateNode(actor, existing.id, { code: existing.code, name });
            result.updated += 1;
          }
          parentId = existing.id;
        } else {
          if (!name) throw new Error(`${layer.name} Name is required for new code "${code}".`);
          parentId = (await createNode(actor, { businessUnitId, parentId, code, name })).id;
          result.created += 1;
        }
      }
    } catch (error) {
      result.errors.push({ row, message: describe(error) });
    }
  }
  return result;
}

// ─── Territory wise customers ─────────────────────────────────────────────────

const CUSTOMER_HEADERS = ["Customer Code", "Customer Name", "Territory Code", "Territory Name", "Customer Address", "Customer Group", "Credit Limit"];

/** Customers of the Territory-layer nodes in a business unit (optionally one node's subtree). */
export async function exportCustomers(actor: Actor, businessUnitId: string, nodeId?: string): Promise<Uint8Array> {
  const tree = await getTree(actor, businessUnitId);
  let nodes = tree.nodes;
  if (nodeId) {
    const ids = new Set([nodeId]);
    for (let grew = true; grew;) {
      grew = false;
      for (const node of nodes)
        if (node.parentId && ids.has(node.parentId) && !ids.has(node.id)) {
          ids.add(node.id);
          grew = true;
        }
    }
    nodes = nodes.filter((node) => ids.has(node.id));
  }
  const linked = await db().salesTerritoryNode.findMany({
    where: { id: { in: nodes.map((n) => n.id) }, salesAreaId: { not: null } },
    select: { code: true, name: true, salesAreaId: true },
  });
  const byArea = new Map(linked.map((node) => [node.salesAreaId!, node]));
  const customers = await db().customer.findMany({
    where: { territoryId: { in: [...byArea.keys()] } },
    orderBy: { name: "asc" },
    take: 20000,
    select: {
      code: true,
      name: true,
      address: true,
      territoryId: true,
      creditLimit: true,
      customerGroup: { select: { name: true } },
    },
  });
  return book(
    "Territory Customers",
    CUSTOMER_HEADERS,
    customers.map((c) => {
      const node = byArea.get(c.territoryId!)!;
      return [c.code, c.name, node.code, node.name, c.address ?? "", c.customerGroup?.name ?? "", c.creditLimit?.toString() ?? ""];
    }),
  );
}

/** Moves customers into territories: needs "Customer Code" and "Territory Code" columns. */
export async function importCustomers(actor: Actor, businessUnitId: string, bytes: Uint8Array): Promise<TerritoryImportResult> {
  const tree = await getTree(actor, businessUnitId);
  if (tree.businessUnitId !== businessUnitId) throw badRequest("Select a business unit you can access.");
  const { headers, rows } = await readRows(bytes);
  if (!headers.has("customer code") || !headers.has("territory code")) {
    throw new AppError(400, "VALIDATION_ERROR", 'Columns "Customer Code" and "Territory Code" are required.');
  }
  const result: TerritoryImportResult = { created: 0, updated: 0, errors: [] };
  for (const { row, get } of rows) {
    try {
      const node = await db().salesTerritoryNode.findFirst({
        where: {
          businessUnitId,
          code: { equals: get("Territory Code"), mode: "insensitive" },
        },
        select: { salesAreaId: true, name: true },
      });
      if (!node) throw new Error(`Territory code "${get("Territory Code")}" not found.`);
      if (!node.salesAreaId) throw new Error(`"${node.name}" is not on the Territory layer.`);
      const customer = await db().customer.findFirst({
        where: {
          businessUnitId,
          code: { equals: get("Customer Code"), mode: "insensitive" },
        },
        select: { id: true },
      });
      if (!customer) throw new Error(`Customer code "${get("Customer Code")}" not found.`);
      await db().customer.update({
        where: { id: customer.id },
        data: { territoryId: node.salesAreaId },
      });
      result.updated += 1;
    } catch (error) {
      result.errors.push({ row, message: describe(error) });
    }
  }
  return result;
}
