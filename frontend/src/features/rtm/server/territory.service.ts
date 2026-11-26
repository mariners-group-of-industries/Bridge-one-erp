import { z } from "zod";
import { badRequest } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { unitIds } from "./common";

/**
 * Base Point › Route › Market filters for the RTM sales lists. They come from
 * the Sales Territory tree (Configuration › Sales Setup). Documents are tied to
 * the tree through their sales force: an employee assigned to a node covers that
 * node and everything under it, so picking a node keeps the documents of the
 * sales force assigned there or below.
 */

const LAYERS = {
  basePoint: { code: "BP", name: "base point" },
  route: { code: "RTE", name: "route" },
  market: { code: "MKT", name: "market" },
} as const;
type LayerKey = keyof typeof LAYERS;

const layerKey = (layer: { code: string; name: string }): LayerKey | null => {
  for (const [key, l] of Object.entries(LAYERS) as [LayerKey, (typeof LAYERS)[LayerKey]][]) {
    if (layer.code.toUpperCase() === l.code || layer.name.trim().toLowerCase() === l.name) return key;
  }
  return null;
};

export interface TerritoryNodeOption {
  id: string;
  code: string;
  name: string;
  /** Base point of a route, route of a market. */
  parentId: string | null;
}

export interface SalesForceOption {
  id: string;
  code: string;
  name: string;
  designation: string | null;
  /** Nodes this person covers: where they are assigned, and every node above. */
  nodeIds: string[];
}

/** Every layer of the tree in level order (National › Region › … › Market), for dynamic filters. */
export interface TerritoryLayerOption {
  id: string;
  name: string;
  level: number;
  /** `path`: the node's ancestors and itself, top first. */
  nodes: { id: string; code: string; name: string; path: string[] }[];
}

export interface TerritoryFilters {
  layers: TerritoryLayerOption[];
  basePoints: TerritoryNodeOption[];
  routes: TerritoryNodeOption[];
  markets: TerritoryNodeOption[];
  salesForce: SalesForceOption[];
}

async function loadTree(actor: Actor) {
  const units = await unitIds(actor);
  const [layers, nodes, assignments] = await Promise.all([
    db().salesTerritoryLayer.findMany({ where: { businessUnitId: { in: units } }, select: { id: true, code: true, name: true, level: true }, orderBy: { level: "asc" } }),
    db().salesTerritoryNode.findMany({
      where: { businessUnitId: { in: units }, isActive: true },
      select: { id: true, parentId: true, layerId: true, code: true, name: true },
      orderBy: { name: "asc" },
    }),
    db().salesTerritoryEmployee.findMany({
      where: { node: { businessUnitId: { in: units } }, employee: { isActive: true } },
      select: { nodeId: true, employee: { select: { id: true, employeeCode: true, name: true, designation: true } } },
    }),
  ]);
  const kindOfLayer = new Map(layers.map((l) => [l.id, layerKey(l)]));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const ancestors = (id: string) => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (let n = byId.get(id); n && !seen.has(n.id); n = n.parentId ? byId.get(n.parentId) : undefined) {
      seen.add(n.id);
      out.push(n.id);
    }
    return out;
  };
  /** Covered nodes per employee (assigned nodes and their ancestors). */
  const scope = new Map<string, { employee: (typeof assignments)[number]["employee"]; nodes: Set<string> }>();
  for (const a of assignments) {
    const entry = scope.get(a.employee.id) ?? { employee: a.employee, nodes: new Set<string>() };
    for (const id of ancestors(a.nodeId)) entry.nodes.add(id);
    scope.set(a.employee.id, entry);
  }
  return { layers, nodes, byId, kindOfLayer, ancestors, scope };
}

export async function territoryFilters(actor: Actor): Promise<TerritoryFilters> {
  const units = await unitIds(actor);
  const { layers, nodes, byId, kindOfLayer, ancestors, scope } = await loadTree(actor);
  const kindOf = (id: string) => kindOfLayer.get(byId.get(id)?.layerId ?? "") ?? null;
  const nearest = (id: string, kind: LayerKey) => ancestors(id).slice(1).find((a) => kindOf(a) === kind) ?? null;
  const pick = (kind: LayerKey, parent?: LayerKey) =>
    nodes.filter((n) => kindOfLayer.get(n.layerId) === kind).map((n) => ({ id: n.id, code: n.code, name: n.name, parentId: parent ? nearest(n.id, parent) : null }));

  // Sales force: everyone assigned in the tree, plus SRs already on RTM documents.
  const where = { businessUnitId: { in: units }, srId: { not: null } };
  const [o, d, c] = await Promise.all([
    db().rtmOrder.findMany({ where, distinct: ["srId"], select: { srId: true } }),
    db().rtmDelivery.findMany({ where, distinct: ["srId"], select: { srId: true } }),
    db().rtmCollection.findMany({ where, distinct: ["srId"], select: { srId: true } }),
  ]);
  const docSrIds = [...new Set([...o, ...d, ...c].map((x) => x.srId!))].filter((id) => !scope.has(id));
  const docSrs = docSrIds.length
    ? await db().employee.findMany({ where: { id: { in: docSrIds } }, select: { id: true, employeeCode: true, name: true, designation: true } })
    : [];
  const salesForce: SalesForceOption[] = [
    ...[...scope.values()].map(({ employee: e, nodes: n }) => ({ id: e.id, code: e.employeeCode, name: e.name, designation: e.designation, nodeIds: [...n] })),
    ...docSrs.map((e) => ({ id: e.id, code: e.employeeCode, name: e.name, designation: e.designation, nodeIds: [] })),
  ].sort((a, b) => a.name.localeCompare(b.name));

  // Layers of several business units with the same name and level show as one.
  const merged = new Map<string, TerritoryLayerOption>();
  for (const l of layers) {
    const key = `${l.level}:${l.name.trim().toLowerCase()}`;
    const entry = merged.get(key) ?? { id: l.id, name: l.name, level: l.level, nodes: [] };
    for (const n of nodes) if (n.layerId === l.id) entry.nodes.push({ id: n.id, code: n.code, name: n.name, path: ancestors(n.id).reverse() });
    merged.set(key, entry);
  }
  const layerOptions = [...merged.values()].sort((a, b) => a.level - b.level);

  return { layers: layerOptions, basePoints: pick("basePoint"), routes: pick("route", "basePoint"), markets: pick("market", "route"), salesForce };
}

const scopeSchema = z.object({
  nodeId: z.preprocess((v) => (v === "" ? undefined : v), z.guid("Unknown base point, route or market.").optional()),
  srId: z.preprocess((v) => (v === "" ? undefined : v), z.guid("Unknown sales force.").optional()),
});

/**
 * The sales force a list is limited to: the employees covering `nodeId` (the
 * most specific of base point / route / market), narrowed to `srId`.
 * `undefined` means no limit; an empty list matches nothing.
 */
export async function salesForceScope(actor: Actor, raw: { nodeId?: string; srId?: string }): Promise<string[] | undefined> {
  const parsed = scopeSchema.safeParse(raw);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid filter.");
  const { nodeId, srId } = parsed.data;
  if (!nodeId) return srId ? [srId] : undefined;
  const { scope } = await loadTree(actor);
  const covering = [...scope.entries()].filter(([, s]) => s.nodes.has(nodeId)).map(([id]) => id);
  return srId ? covering.filter((id) => id === srId) : covering;
}
