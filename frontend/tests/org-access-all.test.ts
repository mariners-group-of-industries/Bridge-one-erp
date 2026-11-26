import { describe, expect, it, vi } from "vitest";
import { grantToAllAccessUsers } from "@/features/configuration/entity-master-data/employee/server/org-access-all";
import type { Prisma } from "@/lib/prisma/client";

function fakeTx(users: { id: string }[]) {
  const createMany = { bu: vi.fn(), office: vi.fn(), warehouse: vi.fn() };
  const findMany = vi.fn(async () => users);
  const tx = {
    user: { findMany },
    userBusinessUnitAccess: { createMany: createMany.bu },
    userOfficeAccess: { createMany: createMany.office },
    userWarehouseAccess: { createMany: createMany.warehouse },
  } as unknown as Prisma.TransactionClient;
  return { tx, findMany, createMany };
}

describe("User Permission 'All' covers ones created later", () => {
  it("gives a new business unit to users with All business units", async () => {
    const { tx, findMany, createMany } = fakeTx([{ id: "u1" }, { id: "u2" }]);
    await grantToAllAccessUsers(tx, { businessUnitId: "bu9" });
    expect(findMany).toHaveBeenCalledWith({ where: { allBusinessUnits: true }, select: { id: true } });
    expect(createMany.bu).toHaveBeenCalledWith({
      data: [{ userId: "u1", businessUnitId: "bu9" }, { userId: "u2", businessUnitId: "bu9" }],
      skipDuplicates: true,
    });
    expect(createMany.office).not.toHaveBeenCalled();
  });

  it("gives a new office and a new warehouse to the matching users", async () => {
    const office = fakeTx([{ id: "u1" }]);
    await grantToAllAccessUsers(office.tx, { officeId: "o1" });
    expect(office.findMany).toHaveBeenCalledWith({ where: { allOffices: true }, select: { id: true } });
    expect(office.createMany.office).toHaveBeenCalledWith({ data: [{ userId: "u1", officeId: "o1" }], skipDuplicates: true });

    const warehouse = fakeTx([{ id: "u3" }]);
    await grantToAllAccessUsers(warehouse.tx, { warehouseId: "w1" });
    expect(warehouse.findMany).toHaveBeenCalledWith({ where: { allWarehouses: true }, select: { id: true } });
    expect(warehouse.createMany.warehouse).toHaveBeenCalledWith({ data: [{ userId: "u3", warehouseId: "w1" }], skipDuplicates: true });
  });

  it("writes nothing when no user has All", async () => {
    const { tx, createMany } = fakeTx([]);
    await grantToAllAccessUsers(tx, { warehouseId: "w1" });
    expect(createMany.warehouse).not.toHaveBeenCalled();
  });
});
