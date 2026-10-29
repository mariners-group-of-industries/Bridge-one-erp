import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/prisma/client";

/**
 * Customer filter for a "Territory" list / report filter. The id is a Sales territory
 * (SalesArea), or a node of the Sales Setup territory tree (Region, Area, …): a node
 * stands for every Sales territory linked below it.
 */
export async function territoryCustomerWhere(territoryId: string | null | undefined): Promise<Prisma.CustomerWhereInput> {
  if (!territoryId) return {};
  const node = await db().salesTerritoryNode.findUnique({ where: { id: territoryId }, select: { businessUnitId: true } });
  if (!node) return { territoryId };
  const nodes = await db().salesTerritoryNode.findMany({ where: { businessUnitId: node.businessUnitId }, select: { id: true, parentId: true, salesAreaId: true } });
  const ids = new Set([territoryId]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const candidate of nodes) {
      if (candidate.parentId && ids.has(candidate.parentId) && !ids.has(candidate.id)) {
        ids.add(candidate.id);
        grew = true;
      }
    }
  }
  const areaIds = nodes.filter((candidate) => ids.has(candidate.id) && candidate.salesAreaId).map((candidate) => candidate.salesAreaId!);
  return { territoryId: { in: areaIds } };
}
