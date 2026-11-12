import type { Prisma } from "@/lib/prisma/client";

type Tx = Prisma.TransactionClient;

/**
 * User Permission "All": users given every business unit, office or warehouse
 * also get the ones created later. Call inside the transaction that creates it.
 */
export async function grantToAllAccessUsers(
  tx: Tx,
  created: { businessUnitId: string } | { officeId: string } | { warehouseId: string },
): Promise<void> {
  if ("businessUnitId" in created) {
    const users = await tx.user.findMany({ where: { allBusinessUnits: true }, select: { id: true } });
    if (users.length) {
      await tx.userBusinessUnitAccess.createMany({ data: users.map((u) => ({ userId: u.id, businessUnitId: created.businessUnitId })), skipDuplicates: true });
    }
  } else if ("officeId" in created) {
    const users = await tx.user.findMany({ where: { allOffices: true }, select: { id: true } });
    if (users.length) {
      await tx.userOfficeAccess.createMany({ data: users.map((u) => ({ userId: u.id, officeId: created.officeId })), skipDuplicates: true });
    }
  } else {
    const users = await tx.user.findMany({ where: { allWarehouses: true }, select: { id: true } });
    if (users.length) {
      await tx.userWarehouseAccess.createMany({ data: users.map((u) => ({ userId: u.id, warehouseId: created.warehouseId })), skipDuplicates: true });
    }
  }
}
