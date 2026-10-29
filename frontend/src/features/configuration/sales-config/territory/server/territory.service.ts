import type { Prisma } from "@/generated/prisma/client";
import { badRequest, conflict, inUse, notFound } from "@/lib/api/errors";
import { assertCompanyAccess, type Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import {
  assignEmployeeSchema,
  assignmentUpdateSchema,
  customerGroupQuerySchema,
  DEFAULT_LAYERS,
  layerInputSchema,
  nodeInputSchema,
  nodeUpdateSchema,
  type AssignEmployeeInput,
  type AssignmentUpdateInput,
  type AssignmentDto,
  type EmployeeOption,
  type LayerInput,
  type NodeInput,
  type NodeUpdate,
  type TerritoryCustomerGroupQuery,
  type TerritoryCustomerGroups,
  type TerritoryCustomerList,
  type TerritoryCustomerQuery,
  type TerritoryTree,
} from "../schemas/territory.schema";

type Tx = Prisma.TransactionClient;
type Client = Tx | ReturnType<typeof db>;

// ─── Scoping ──────────────────────────────────────────────────────────────────

function unitScope(actor: Actor): Prisma.BusinessUnitWhereInput {
  return actor.companyScope === "ALL" ? {} : { companyId: { in: [...actor.companyScope] } };
}

async function loadUnit(actor: Actor, businessUnitId: string) {
  const unit = await db().businessUnit.findUnique({
    where: { id: businessUnitId },
    select: { id: true, companyId: true },
  });
  if (!unit) throw notFound("Business unit");
  assertCompanyAccess(actor, unit.companyId, "Business unit");
}

async function loadNode(actor: Actor, id: string, client: Client = db()) {
  const node = await client.salesTerritoryNode.findFirst({
    where: { id, businessUnit: unitScope(actor) },
    include: { layer: true },
  });
  if (!node) throw notFound("Territory");
  return node;
}

/** Creates the default layers the first time a business unit is used. */
export async function ensureLayers(businessUnitId: string) {
  const count = await db().salesTerritoryLayer.count({
    where: { businessUnitId },
  });
  if (count > 0) return;
  await db().salesTerritoryLayer.createMany({
    data: DEFAULT_LAYERS.map((layer, index) => ({
      businessUnitId,
      level: index + 1,
      code: layer.code,
      name: layer.name,
      isTerritory: "isTerritory" in layer && layer.isTerritory,
    })),
    skipDuplicates: true,
  });
}

// ─── Tree ─────────────────────────────────────────────────────────────────────

export async function getTree(actor: Actor, businessUnitId?: string): Promise<TerritoryTree> {
  const businessUnits = await db().businessUnit.findMany({
    where: unitScope(actor),
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const unitId = businessUnitId && businessUnits.some((u) => u.id === businessUnitId) ? businessUnitId : businessUnits[0]?.id;
  if (!unitId) return { businessUnits, businessUnitId: "", layers: [], nodes: [] };
  await ensureLayers(unitId);

  const [layers, nodes] = await Promise.all([
    db().salesTerritoryLayer.findMany({
      where: { businessUnitId: unitId },
      orderBy: { level: "asc" },
      include: { _count: { select: { nodes: true } } },
    }),
    db().salesTerritoryNode.findMany({
      where: { businessUnitId: unitId },
      orderBy: [{ code: "asc" }],
      include: {
        layer: { select: { level: true } },
        _count: { select: { employees: true } },
        salesArea: {
          select: { _count: { select: { territoryCustomers: true } } },
        },
      },
    }),
  ]);
  return {
    businessUnits,
    businessUnitId: unitId,
    layers: layers.map(({ _count, businessUnitId: _bu, createdAt: _c, ...layer }) => ({
      ...layer,
      nodeCount: _count.nodes,
    })),
    nodes: nodes.map((node) => ({
      id: node.id,
      layerId: node.layerId,
      level: node.layer.level,
      parentId: node.parentId,
      code: node.code,
      name: node.name,
      employeeCount: node._count.employees,
      customerCount: node.salesArea ? node.salesArea._count.territoryCustomers : null,
    })),
  };
}

// ─── Layers ───────────────────────────────────────────────────────────────────

export async function addLayer(actor: Actor, businessUnitId: string, input: LayerInput) {
  const data = layerInputSchema.parse(input);
  await loadUnit(actor, businessUnitId);
  await ensureLayers(businessUnitId);
  const last = await db().salesTerritoryLayer.findFirst({
    where: { businessUnitId },
    orderBy: { level: "desc" },
  });
  if (
    await db().salesTerritoryLayer.findFirst({
      where: {
        businessUnitId,
        code: { equals: data.code, mode: "insensitive" },
      },
    })
  ) {
    throw conflict(`Layer code "${data.code}" is already used.`);
  }
  return db().salesTerritoryLayer.create({
    data: { businessUnitId, level: (last?.level ?? 0) + 1, ...data },
  });
}

async function loadLayer(actor: Actor, id: string) {
  const layer = await db().salesTerritoryLayer.findFirst({
    where: { id, businessUnit: unitScope(actor) },
  });
  if (!layer) throw notFound("Layer");
  return layer;
}

export async function updateLayer(actor: Actor, id: string, input: LayerInput) {
  const data = layerInputSchema.parse(input);
  const layer = await loadLayer(actor, id);
  const clash = await db().salesTerritoryLayer.findFirst({
    where: {
      businessUnitId: layer.businessUnitId,
      code: { equals: data.code, mode: "insensitive" },
      id: { not: id },
    },
  });
  if (clash) throw conflict(`Layer code "${data.code}" is already used.`);
  return db().salesTerritoryLayer.update({ where: { id }, data });
}

/** Only the deepest layer can be removed, and only while it has no nodes. */
export async function deleteLayer(actor: Actor, id: string) {
  const layer = await loadLayer(actor, id);
  if (layer.isTerritory) throw badRequest("The Territory layer is linked to Sales and cannot be removed.");
  const deeper = await db().salesTerritoryLayer.count({
    where: { businessUnitId: layer.businessUnitId, level: { gt: layer.level } },
  });
  if (deeper > 0) throw badRequest("Remove the layers below it first.");
  if (await db().salesTerritoryNode.count({ where: { layerId: id } })) throw inUse(`"${layer.name}" has entries; delete them first.`);
  await db().salesTerritoryLayer.delete({ where: { id } });
}

// ─── Nodes ────────────────────────────────────────────────────────────────────

/** Links a Territory-layer node to the Sales territory of the same name (creating it when missing). */
async function linkSalesArea(tx: Tx, businessUnitId: string, name: string, exceptNodeId?: string) {
  const existing = await tx.salesArea.findFirst({
    where: {
      businessUnitId,
      kind: "TERRITORY",
      name: { equals: name, mode: "insensitive" },
    },
    include: { territoryNode: { select: { id: true } } },
  });
  if (existing) {
    if (existing.territoryNode && existing.territoryNode.id !== exceptNodeId) {
      throw conflict(`The Sales territory "${existing.name}" is already in the tree.`);
    }
    return existing.id;
  }
  return (
    await tx.salesArea.create({
      data: { businessUnitId, kind: "TERRITORY", name },
    })
  ).id;
}

export async function createNode(actor: Actor, input: NodeInput) {
  const data = nodeInputSchema.parse(input);
  await loadUnit(actor, data.businessUnitId);
  await ensureLayers(data.businessUnitId);
  return db().$transaction(async (tx) => {
    let level = 1;
    if (data.parentId) {
      const parent = await loadNode(actor, data.parentId, tx);
      if (parent.businessUnitId !== data.businessUnitId) throw badRequest("Select a parent of this business unit.");
      level = parent.layer.level + 1;
    }
    const layer = await tx.salesTerritoryLayer.findFirst({
      where: { businessUnitId: data.businessUnitId, level },
    });
    if (!layer) throw badRequest("There is no layer below this one. Add a layer in Layer Setup first.");
    const codeTaken = (value: string) =>
      tx.salesTerritoryNode.findFirst({ where: { businessUnitId: data.businessUnitId, code: { equals: value, mode: "insensitive" } }, select: { id: true } });
    if (!data.code) {
      // No code given: the layer's code and the next free number, e.g. "REG-003".
      let next = (await tx.salesTerritoryNode.count({ where: { layerId: layer.id } })) + 1;
      do data.code = `${layer.code}-${String(next++).padStart(3, "0")}`;
      while (await codeTaken(data.code));
    } else if (await codeTaken(data.code)) {
      throw conflict(`Code "${data.code}" is already used.`);
    }
    const salesAreaId = layer.isTerritory ? await linkSalesArea(tx, data.businessUnitId, data.name) : null;
    return tx.salesTerritoryNode.create({
      data: {
        businessUnitId: data.businessUnitId,
        layerId: layer.id,
        parentId: data.parentId || null,
        code: data.code,
        name: data.name,
        salesAreaId,
      },
      select: { id: true, code: true, name: true },
    });
  });
}

export async function updateNode(actor: Actor, id: string, input: NodeUpdate) {
  const data = nodeUpdateSchema.parse(input);
  return db().$transaction(async (tx) => {
    const node = await loadNode(actor, id, tx);
    data.code ||= node.code;
    const clash = await tx.salesTerritoryNode.findFirst({
      where: {
        businessUnitId: node.businessUnitId,
        code: { equals: data.code, mode: "insensitive" },
        id: { not: id },
      },
    });
    if (clash) throw conflict(`Code "${data.code}" is already used.`);
    if (node.salesAreaId && data.name !== node.name) {
      // Keep the linked Sales territory's name in step.
      const taken = await tx.salesArea.findFirst({
        where: {
          businessUnitId: node.businessUnitId,
          kind: "TERRITORY",
          name: { equals: data.name, mode: "insensitive" },
          id: { not: node.salesAreaId },
        },
      });
      if (taken) throw conflict(`Another Sales territory is already called "${data.name}".`);
      await tx.salesArea.update({
        where: { id: node.salesAreaId },
        data: { name: data.name },
      });
    }
    return tx.salesTerritoryNode.update({
      where: { id },
      data,
      select: { id: true, code: true, name: true },
    });
  });
}

export async function deleteNode(actor: Actor, id: string) {
  const node = await loadNode(actor, id);
  if (await db().salesTerritoryNode.count({ where: { parentId: id } })) throw inUse("Delete the entries under it first.");
  if (node.salesAreaId) {
    const customers = await db().customer.count({
      where: { territoryId: node.salesAreaId },
    });
    if (customers) throw inUse(`${customers} customer${customers === 1 ? " is" : "s are"} in this territory.`);
  }
  // The Sales territory itself is kept (other records may still use it).
  await db().salesTerritoryNode.delete({ where: { id } });
}

// ─── Employees ────────────────────────────────────────────────────────────────

export async function listAssignments(actor: Actor, nodeId: string): Promise<AssignmentDto[]> {
  await loadNode(actor, nodeId);
  const rows = await db().salesTerritoryEmployee.findMany({
    where: { nodeId },
    orderBy: { createdAt: "asc" },
    include: {
      employee: {
        select: { name: true, designation: true, mobile: true, email: true },
      },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    employeeId: row.employeeId,
    name: row.employee.name,
    designation: row.employee.designation,
    phone: row.employee.mobile,
    email: row.employee.email,
    distributionChannel: row.distributionChannel,
  }));
}

export async function employeeOptions(actor: Actor, nodeId: string): Promise<EmployeeOption[]> {
  const node = await loadNode(actor, nodeId);
  return db()
    .employee.findMany({
      where: {
        isActive: true,
        office: { businessUnitId: node.businessUnitId },
      },
      orderBy: { name: "asc" },
      select: { id: true, employeeCode: true, name: true, designation: true },
    })
    .then((rows) => rows.map(({ employeeCode, ...row }) => ({ ...row, code: employeeCode })));
}

export async function assignEmployee(actor: Actor, nodeId: string, input: AssignEmployeeInput) {
  const data = assignEmployeeSchema.parse(input);
  const node = await loadNode(actor, nodeId);
  const employee = await db().employee.findFirst({
    where: {
      id: data.employeeId,
      office: { businessUnitId: node.businessUnitId },
    },
  });
  if (!employee) throw badRequest("Select an employee of this business unit.");
  if (
    await db().salesTerritoryEmployee.findUnique({
      where: { nodeId_employeeId: { nodeId, employeeId: data.employeeId } },
    })
  ) {
    throw conflict(`${employee.name} is already assigned here.`);
  }
  await db().salesTerritoryEmployee.create({
    data: {
      nodeId,
      employeeId: data.employeeId,
      distributionChannel: data.distributionChannel || null,
    },
  });
  return listAssignments(actor, nodeId);
}

export async function removeAssignment(actor: Actor, nodeId: string, assignmentId: string) {
  await loadNode(actor, nodeId);
  const { count } = await db().salesTerritoryEmployee.deleteMany({
    where: { id: assignmentId, nodeId },
  });
  if (count === 0) throw notFound("Assignment");
  return listAssignments(actor, nodeId);
}

// ─── Territory wise customers ─────────────────────────────────────────────────

/** Linked Sales territories of a node and every node below it. */
async function territoryAreaIds(businessUnitId: string, nodeId: string) {
  const nodes = await db().salesTerritoryNode.findMany({
    where: { businessUnitId },
    select: { id: true, parentId: true, salesAreaId: true },
  });
  const ids = new Set([nodeId]);
  for (let grew = true; grew;) {
    grew = false;
    for (const node of nodes)
      if (node.parentId && ids.has(node.parentId) && !ids.has(node.id)) {
        ids.add(node.id);
        grew = true;
      }
  }
  return nodes.filter((node) => ids.has(node.id) && node.salesAreaId).map((node) => node.salesAreaId!);
}

export async function territoryCustomers(actor: Actor, query: TerritoryCustomerQuery): Promise<TerritoryCustomerList> {
  const node = await loadNode(actor, query.nodeId);
  if (node.businessUnitId !== query.businessUnitId) throw badRequest("Select a territory of this business unit.");
  const areaIds = await territoryAreaIds(node.businessUnitId, node.id);

  // Path from the top layer down to this node.
  const path: string[] = [];
  for (let current: { parentId: string | null; name: string } | null = node; current;) {
    path.unshift(current.name);
    current = current.parentId
      ? await db().salesTerritoryNode.findUnique({
          where: { id: current.parentId },
          select: { parentId: true, name: true },
        })
      : null;
  }
  const employees = await db().salesTerritoryEmployee.findMany({
    where: { nodeId: node.id },
    include: { employee: { select: { name: true, designation: true } } },
  });

  const inTerritory: Prisma.CustomerWhereInput = {
    territoryId: { in: areaIds },
  };
  const search = query.search
    ? {
        contains: query.search.replace(/[\\%_]/g, (c) => `\\${c}`),
        mode: "insensitive" as const,
      }
    : undefined;
  const where: Prisma.CustomerWhereInput = {
    AND: [inTerritory, query.customerId ? { id: query.customerId } : {}, search ? { OR: [{ code: search }, { name: search }] } : {}],
  };
  const [customers, total, rows] = await Promise.all([
    db().customer.findMany({
      where: inTerritory,
      orderBy: { name: "asc" },
      take: 1000,
      select: { id: true, code: true, name: true },
    }),
    db().customer.count({ where }),
    db().customer.findMany({
      where,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        code: true,
        name: true,
        address: true,
        creditLimit: true,
        customerGroup: { select: { name: true } },
      },
    }),
  ]);
  return {
    territory: {
      id: node.id,
      code: node.code,
      name: node.name,
      path,
      employees: employees.map((e) => ({
        name: e.employee.name,
        designation: e.employee.designation,
      })),
    },
    customers,
    rows: rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      address: row.address,
      groupName: row.customerGroup?.name ?? null,
      creditLimit: row.creditLimit?.toString() ?? null,
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

/** Changes the distribution channel of an assigned employee. */
export async function updateAssignment(actor: Actor, nodeId: string, assignmentId: string, input: AssignmentUpdateInput) {
  const data = assignmentUpdateSchema.parse(input);
  await loadNode(actor, nodeId);
  const { count } = await db().salesTerritoryEmployee.updateMany({
    where: { id: assignmentId, nodeId },
    data: { distributionChannel: data.distributionChannel || null },
  });
  if (count === 0) throw notFound("Assignment");
  return listAssignments(actor, nodeId);
}

/** Most customers one Territory Wise Customer List shows (narrow with the filters beyond that). */
export const CUSTOMER_GROUPS_LIMIT = 5000;

/**
 * Territory Wise Customer List: each Sales territory customers are linked to (all of them,
 * one, or those below a tree entry), whether or not it is in the Sales Setup tree yet, with
 * its customers and their credit limit total; territories without customers are left out.
 */
export async function territoryCustomerGroups(actor: Actor, raw: TerritoryCustomerGroupQuery | unknown): Promise<TerritoryCustomerGroups> {
  const query = customerGroupQuerySchema.parse(raw);
  await loadUnit(actor, query.businessUnitId);
  const areas = await db().salesArea.findMany({
    where: { businessUnitId: query.businessUnitId, kind: "TERRITORY" },
    select: { id: true, name: true, territoryNode: { select: { code: true } } },
    orderBy: { name: "asc" },
  });
  let territories = query.territoryId ? areas.filter((area) => area.id === query.territoryId) : areas;
  if (query.nodeId) {
    const node = await loadNode(actor, query.nodeId);
    if (node.businessUnitId !== query.businessUnitId) throw badRequest("Select a territory of this business unit.");
    const below = new Set(await territoryAreaIds(query.businessUnitId, node.id));
    territories = territories.filter((territory) => below.has(territory.id));
  }
  const inTerritories: Prisma.CustomerWhereInput = { territoryId: { in: territories.map((territory) => territory.id) } };
  const search = query.search ? { contains: query.search.replace(/[\\%_]/g, (c) => `\\${c}`), mode: "insensitive" as const } : undefined;
  const where: Prisma.CustomerWhereInput = {
    AND: [inTerritories, query.customerId ? { id: query.customerId } : {}, search ? { OR: [{ code: search }, { name: search }] } : {}],
  };
  const [customers, total, rows] = await Promise.all([
    db().customer.findMany({ where: inTerritories, orderBy: { name: "asc" }, take: 2000, select: { id: true, code: true, name: true } }),
    db().customer.count({ where }),
    db().customer.findMany({
      where,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: CUSTOMER_GROUPS_LIMIT,
      select: { id: true, code: true, name: true, address: true, creditLimit: true, territoryId: true, customerGroup: { select: { name: true } } },
    }),
  ]);
  const byArea = new Map<string, typeof rows>();
  for (const row of rows) byArea.set(row.territoryId!, [...(byArea.get(row.territoryId!) ?? []), row]);
  const groups = territories.flatMap((territory) => {
    const members = byArea.get(territory.id) ?? [];
    if (members.length === 0) return [];
    return [
      {
        id: territory.id,
        code: territory.territoryNode?.code ?? "",
        name: territory.name,
        rows: members.map((row) => ({
          id: row.id,
          code: row.code,
          name: row.name,
          address: row.address,
          groupName: row.customerGroup?.name ?? null,
          creditLimit: row.creditLimit?.toString() ?? null,
        })),
        creditTotal: Math.round(members.reduce((sum, row) => sum + (row.creditLimit?.toNumber() ?? 0), 0) * 100) / 100,
      },
    ];
  });
  return { territories: areas.map(({ id, name }) => ({ id, name })), groups, customers, total, truncated: total > rows.length };
}
