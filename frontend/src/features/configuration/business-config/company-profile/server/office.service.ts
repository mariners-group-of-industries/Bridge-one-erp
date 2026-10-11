import { conflict, inUse } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { db, type Prisma } from "@/lib/prisma/client";
import { getStorage } from "@/lib/storage";
import { ASSET_KIND_SLUGS, OFFICE_ASSET_KINDS, type OfficeData } from "../schemas/office.schema";
import type { OfficeAssetDto, OfficeDto } from "../types";
import { loadBusinessUnit, loadOffice, sameName } from "./access";

const officeInclude = {
  assets: true,
  _count: { select: { warehouses: true } },
} as const;

type OfficeRow = Prisma.OfficeGetPayload<{ include: typeof officeInclude }>;
type AssetRow = OfficeRow["assets"][number];

export function toAssetDto(asset: AssetRow): OfficeAssetDto {
  return {
    kind: asset.kind,
    originalName: asset.originalName,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    // Version query string busts browser caches when an asset is replaced.
    url: `/api/configuration/offices/${asset.officeId}/assets/${ASSET_KIND_SLUGS[asset.kind]}?v=${asset.updatedAt.getTime()}`,
    updatedAt: asset.updatedAt.toISOString(),
  };
}

function toDto(office: OfficeRow): OfficeDto {
  return {
    id: office.id,
    businessUnitId: office.businessUnitId,
    name: office.name,
    address: office.address,
    email: office.email,
    phone: office.phone,
    binNumber: office.binNumber,
    warehouseCount: office._count.warehouses,
    assets: office.assets
      .toSorted((a, b) => OFFICE_ASSET_KINDS.indexOf(a.kind) - OFFICE_ASSET_KINDS.indexOf(b.kind))
      .map(toAssetDto),
    updatedAt: office.updatedAt.toISOString(),
  };
}

async function assertUniqueName(
  tx: Prisma.TransactionClient,
  businessUnitId: string,
  name: string,
  excludeId?: string,
) {
  const duplicate = await tx.office.findFirst({
    where: { businessUnitId, name: sameName(name), NOT: excludeId ? { id: excludeId } : undefined },
    select: { id: true },
  });
  if (duplicate) throw conflict(`An office named "${name}" already exists in this business unit.`);
}

export async function listOffices(actor: Actor, businessUnitId: string): Promise<OfficeDto[]> {
  await loadBusinessUnit(actor, businessUnitId);
  const offices = await db().office.findMany({
    where: { businessUnitId },
    include: officeInclude,
    orderBy: { createdAt: "asc" },
  });
  return offices.map(toDto);
}

export async function getOffice(actor: Actor, id: string): Promise<OfficeDto> {
  await loadOffice(actor, id);
  const office = await db().office.findUniqueOrThrow({ where: { id }, include: officeInclude });
  return toDto(office);
}

export async function createOffice(
  actor: Actor,
  businessUnitId: string,
  input: OfficeData,
): Promise<OfficeDto> {
  const office = await db().$transaction(async (tx) => {
    await loadBusinessUnit(actor, businessUnitId, tx);
    await assertUniqueName(tx, businessUnitId, input.name);
    return tx.office.create({ data: { ...input, businessUnitId }, include: officeInclude });
  });
  return toDto(office);
}

export async function updateOffice(actor: Actor, id: string, input: OfficeData): Promise<OfficeDto> {
  const office = await db().$transaction(async (tx) => {
    const existing = await loadOffice(actor, id, tx);
    await assertUniqueName(tx, existing.businessUnitId, input.name, id);
    return tx.office.update({ where: { id }, data: input, include: officeInclude });
  });
  return toDto(office);
}

/** Deletes an office and its branding assets. Blocked while it has warehouses. */
export async function deleteOffice(actor: Actor, id: string): Promise<void> {
  const storageKeys = await db().$transaction(async (tx) => {
    await loadOffice(actor, id, tx);
    const warehouses = await tx.warehouse.count({ where: { officeId: id } });
    if (warehouses > 0) {
      throw inUse(
        `This office still has ${warehouses} warehouse(s). Remove them before deleting the office.`,
        { warehouses },
      );
    }
    const assets = await tx.officeAsset.findMany({
      where: { officeId: id },
      select: { storageKey: true },
    });
    await tx.office.delete({ where: { id } }); // asset rows cascade
    return assets.map((asset) => asset.storageKey);
  });

  await removeStoredObjects(storageKeys);
}

/** Best-effort cleanup after the database change has committed. */
export async function removeStoredObjects(keys: string[]): Promise<void> {
  const storage = getStorage();
  const results = await Promise.allSettled(keys.map((key) => storage.delete(key)));
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(`[storage] failed to delete orphaned object ${keys[index]}`, result.reason);
    }
  });
}
