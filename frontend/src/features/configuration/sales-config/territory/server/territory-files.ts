import ExcelJS from "exceljs";
import { cellText, describe } from "@/features/configuration/entity-master-data/supplier/server/supplier-excel";
import { AppError, badRequest } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import type { LayerDto, TerritoryImportResult } from "../schemas/territory.schema";
import { createNode, ensureLayers, getTree, updateNode } from "./territory.service";
import { loadWorkbook } from "@/lib/excel/load-workbook";

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
  const workbook = await loadWorkbook(bytes);
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
  if (rows.length > 10000) throw new AppError(400, "VALIDATION_ERROR", "Upload at most 10000 rows per file.");
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
  const { headers, rows } = await readRows(bytes);
  // Without any "<Layer> Code" column the sheet is a names-only outline (see importOutline).
  if (![...headers.keys()].some((header) => header.endsWith(" code"))) return importOutline(businessUnitId, tree.layers, headers, rows);
  const result: TerritoryImportResult = { created: 0, updated: 0, errors: [] };

  for (const { row, get } of rows) {
    try {
      let parentId = "";
      for (const layer of tree.layers) {
        const code = get(`${layer.name} Code`);
        const name = get(`${layer.name} Name`);
        if (!code) {
          if (!parentId) throw new Error(`${layer.name} Code is empty.`);
          break;
        }
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

type SheetRow = Awaited<ReturnType<typeof readRows>>["rows"][number];

/**
 * Names-only outline: one column per layer (headers named after the layers, or else taken in layer
 * order), and a blank cell means "same as the row above" — the way a tree is usually typed in Excel.
 * Entries are matched by name under their parent; new ones get an automatic code ("MKT-0042").
 * Everything is written in one transaction with bulk inserts, so 10 000 rows take seconds.
 */
async function importOutline(businessUnitId: string, layers: LayerDto[], headers: Map<string, number>, rows: SheetRow[]): Promise<TerritoryImportResult> {
  const names = [...headers.keys()];
  if (names.length === 0) throw new AppError(400, "VALIDATION_ERROR", "The first row must hold the column headers.");
  if (names.length > layers.length) {
    throw new AppError(400, "VALIDATION_ERROR", `The sheet has ${names.length} columns but there are only ${layers.length} layers. Add the missing layers in Layer Setup first.`);
  }
  // Headers named after the layers are matched by name; otherwise columns go in layer order.
  const byName = names.map((header) => layers.find((layer) => layer.name.toLowerCase() === header));
  const named = byName.every((layer): layer is LayerDto => layer !== undefined);
  const columnLayers = named ? [...byName].sort((a, b) => a.level - b.level) : layers.slice(0, names.length);
  const columns = named ? columnLayers.map((layer) => layer.name) : names;
  if (columnLayers.some((layer, index) => layer.level !== index + 1)) {
    throw new AppError(400, "VALIDATION_ERROR", `Columns must start at ${layers[0]?.name} and follow the layer order without gaps.`);
  }

  const result: TerritoryImportResult = { created: 0, updated: 0, errors: [] };
  const key = (path: string[]) => path.map((name) => name.toLowerCase()).join("\u0000");

  // 1. Turn the rows into full paths, filling blanks from the row above.
  const paths: { row: number; path: string[] }[] = [];
  let carry: string[] = [];
  for (const { row, get } of rows) {
    const cells = columns.map((column) => get(column).replace(/\s+/g, " ").trim());
    const filled = cells.flatMap((cell, index) => (cell ? [index] : []));
    const first = filled[0];
    const last = filled[filled.length - 1];
    if (first === undefined || last === undefined) continue;
    if (filled.length !== last - first + 1) {
      result.errors.push({ row, message: "Leave no blank cells between names in a row." });
      continue;
    }
    if (carry.length < first) {
      result.errors.push({ row, message: `${columnLayers[carry.length]?.name} is empty and there is no row above to take it from.` });
      continue;
    }
    const tooLong = cells.find((cell) => cell.length > 100);
    if (tooLong) {
      result.errors.push({ row, message: `"${tooLong.slice(0, 40)}…" is longer than 100 characters.` });
      continue;
    }
    carry = [...carry.slice(0, first), ...cells.slice(first, last + 1)];
    paths.push({ row, path: carry });
  }

  // 2. Every distinct entry (path prefix), in tree order.
  const wanted = new Map<string, { path: string[]; row: number }>();
  for (const { row, path } of paths)
    for (let depth = 1; depth <= path.length; depth++) {
      const prefix = path.slice(0, depth);
      if (!wanted.has(key(prefix))) wanted.set(key(prefix), { path: prefix, row });
    }

  const failed = new Map<string, string>();
  await db().$transaction(
    async (tx) => {
      const existing = await tx.salesTerritoryNode.findMany({
        where: { businessUnitId },
        select: { id: true, parentId: true, name: true, code: true, layerId: true },
      });
      const childKey = (parentId: string | null, name: string) => `${parentId ?? ""}\u0000${name.toLowerCase()}`;
      const children = new Map(existing.map((node) => [childKey(node.parentId, node.name), node]));
      const codes = new Set(existing.map((node) => node.code.toLowerCase()));
      const resolved = new Map<string, string>(); // path key → node id

      for (const [depth, layer] of columnLayers.entries()) {
        const create: { pathKey: string; parentId: string | null; name: string }[] = [];
        for (const [pathKey, { path }] of wanted) {
          if (path.length !== depth + 1) continue;
          const parentKey = key(path.slice(0, -1));
          if (depth > 0 && !resolved.has(parentKey)) continue; // its parent failed
          const parentId = depth > 0 ? resolved.get(parentKey)! : null;
          const name = path[depth];
          const found = children.get(childKey(parentId, name));
          if (found) {
            if (found.layerId !== layer.id) failed.set(pathKey, `"${name}" already exists on a different layer.`);
            else resolved.set(pathKey, found.id);
          } else create.push({ pathKey, parentId, name });
        }
        if (create.length === 0) continue;

        // Territory-layer entries link to the Sales territory of the same name (created when missing).
        const salesAreaIds = new Map<string, string>();
        if (layer.isTerritory) {
          const areas = await tx.salesArea.findMany({
            where: { businessUnitId, kind: "TERRITORY" },
            select: { id: true, name: true, territoryNode: { select: { id: true } } },
          });
          const areaByName = new Map(areas.map((area) => [area.name.toLowerCase(), area]));
          const missing: string[] = [];
          const claimed = new Set<string>();
          for (const item of create) {
            const lower = item.name.toLowerCase();
            const area = areaByName.get(lower);
            if (claimed.has(lower) || area?.territoryNode) {
              failed.set(item.pathKey, `The Sales territory "${item.name}" is already in the tree under another parent.`);
              continue;
            }
            claimed.add(lower);
            if (area) salesAreaIds.set(lower, area.id);
            else missing.push(item.name);
          }
          if (missing.length) {
            const made = await tx.salesArea.createManyAndReturn({
              data: missing.map((name) => ({ businessUnitId, kind: "TERRITORY" as const, name })),
              select: { id: true, name: true },
            });
            for (const area of made) salesAreaIds.set(area.name.toLowerCase(), area.id);
          }
        }

        let next = existing.filter((node) => node.layerId === layer.id).length + 1;
        const nextCode = () => {
          let code: string;
          do code = `${layer.code}-${String(next++).padStart(4, "0")}`;
          while (codes.has(code.toLowerCase()));
          codes.add(code.toLowerCase());
          return code;
        };
        const toCreate = create.filter((item) => !failed.has(item.pathKey));
        const made = await tx.salesTerritoryNode.createManyAndReturn({
          data: toCreate.map((item) => ({
            businessUnitId,
            layerId: layer.id,
            parentId: item.parentId,
            code: nextCode(),
            name: item.name,
            salesAreaId: layer.isTerritory ? (salesAreaIds.get(item.name.toLowerCase()) ?? null) : null,
          })),
          select: { id: true, parentId: true, name: true },
        });
        const pathKeys = new Map(toCreate.map((item) => [childKey(item.parentId, item.name), item.pathKey]));
        for (const node of made) {
          const pathKey = pathKeys.get(childKey(node.parentId, node.name));
          if (pathKey) resolved.set(pathKey, node.id);
        }
        result.created += made.length;
      }
    },
    { timeout: 120_000, maxWait: 15_000 },
  );

  // 3. Report each row whose path hit a failed entry (once, at the first failure).
  for (const { row, path } of paths)
    for (let depth = 1; depth <= path.length; depth++) {
      const message = failed.get(key(path.slice(0, depth)));
      if (message) {
        result.errors.push({ row, message });
        break;
      }
    }
  result.errors.sort((a, b) => a.row - b.row);
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
