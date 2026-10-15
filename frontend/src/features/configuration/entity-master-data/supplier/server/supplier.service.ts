import { randomUUID } from "node:crypto";
import { formatNumber, nextNumber } from "@/features/sales/lib/sequence";
import type { Prisma } from "@/generated/prisma/client";
import { AppError, badRequest, conflict, notFound } from "@/lib/api/errors";
import { assertCompanyAccess, type Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { getStorage } from "@/lib/storage";
import {
  ALLOWED_SUPPLIER_ATTACHMENT_TYPES,
  MAX_SUPPLIER_ATTACHMENT_BYTES,
  supplierInputSchema,
  type CreateSupplierGroupInput,
  type CreateTaxBracketInput,
  type CreateThanaInput,
  type SupplierAttachmentDto,
  type SupplierData,
  type SupplierDto,
  type SupplierFilters,
  type SupplierFormOptions,
  type SupplierGroupOption,
  type SupplierInput,
  type SupplierList,
  type SupplierListQuery,
  type SupplierListRow,
  type TaxBracketOption,
} from "../schemas/supplier.schema";

type Tx = Prisma.TransactionClient;

const CODE_PREFIX = "SUP";
const CODE_SEQUENCE = "SUPPLIER";

// ─── Scoping ──────────────────────────────────────────────────────────────────

/** Suppliers of the companies the actor may access. Only profiles with an office are listed here. */
function scopeWhere(actor: Actor): Prisma.SupplierWhereInput {
  return actor.companyScope === "ALL"
    ? { officeId: { not: null } }
    : { officeId: { not: null }, businessUnit: { companyId: { in: [...actor.companyScope] } } };
}

function businessUnitScope(actor: Actor): Prisma.BusinessUnitWhereInput {
  return actor.companyScope === "ALL" ? {} : { companyId: { in: [...actor.companyScope] } };
}

async function loadOffice(actor: Actor, officeId: string, client: Tx | ReturnType<typeof db> = db()) {
  const office = await client.office.findUnique({
    where: { id: officeId },
    select: { id: true, businessUnitId: true, businessUnit: { select: { companyId: true } } },
  });
  if (!office) throw notFound("Office");
  assertCompanyAccess(actor, office.businessUnit.companyId, "Office");
  return office;
}

async function loadSupplier(actor: Actor, id: string, client: Tx | ReturnType<typeof db> = db()) {
  const supplier = await client.supplier.findFirst({ where: { id, ...scopeWhere(actor) } });
  if (!supplier) throw notFound("Supplier");
  return supplier;
}

// ─── Mapping ──────────────────────────────────────────────────────────────────

const orNull = (value: string) => (value === "" ? null : value);
const decimalOrNull = (value: string) => (value === "" ? null : value);
const str = (value: unknown) => (value === null || value === undefined ? "" : String(value));

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

const detailSelect = {
  code: true,
  vendorName: true,
  address: true,
  gps: true,
  contactPerson: true,
  contactNumber: true,
  vatRegNo: true,
} satisfies Prisma.SupplierDetailSelect;

const attachmentSelect = {
  id: true,
  originalName: true,
  mimeType: true,
  size: true,
  createdAt: true,
} satisfies Prisma.SupplierAttachmentSelect;

function toAttachmentDto(record: Prisma.SupplierAttachmentGetPayload<{ select: typeof attachmentSelect }>): SupplierAttachmentDto {
  return { ...record, createdAt: record.createdAt.toISOString() };
}

type SupplierRecord = Prisma.SupplierGetPayload<{
  include: { details: { select: typeof detailSelect }; attachments: { select: typeof attachmentSelect } };
}>;

function toDto(record: SupplierRecord): SupplierDto {
  return {
    id: record.id,
    officeId: record.officeId ?? "",
    name: record.name,
    code: record.code,
    mobile: str(record.phone),
    email: str(record.email),
    groupId: str(record.groupId),
    subGroupId: str(record.subGroupId),
    creditDays: str(record.creditDays),
    tolerancePercent: str(record.tolerancePercent),
    binNumber: str(record.binNumber),
    tcsPercent: str(record.tcsPercent),
    vatRegistrationNo: str(record.vatRegistrationNo),
    tinNumber: str(record.tinNumber),
    tradeLicenseNo: str(record.tradeLicenseNo),
    isMonthly: record.isMonthly,
    isForeign: record.isForeign,
    vdsApplicable: record.vdsApplicable,
    vatAccountingNotApplicable: record.vatAccountingNotApplicable,
    isUser: record.isUser,
    billingAddress: str(record.address),
    districtId: record.districtId ?? "",
    thanaId: str(record.thanaId),
    contactPerson: str(record.contactPerson),
    contactNo: str(record.billingContactNo),
    taxBracketId: str(record.taxBracketId),
    remarks: str(record.remarks),
    details: record.details.map((detail) => ({
      code: str(detail.code),
      vendorName: str(detail.vendorName),
      address: detail.address,
      gps: str(detail.gps),
      contactPerson: str(detail.contactPerson),
      contactNumber: str(detail.contactNumber),
      vatRegNo: str(detail.vatRegNo),
    })),
    attachments: record.attachments.map(toAttachmentDto),
  };
}

/** Column values shared by create and update (everything except business unit and code). */
function columns(data: SupplierData) {
  return {
    officeId: data.officeId,
    name: data.name,
    phone: orNull(data.mobile),
    email: orNull(data.email),
    groupId: orNull(data.groupId),
    subGroupId: orNull(data.subGroupId),
    creditDays: data.creditDays === "" ? null : Number(data.creditDays),
    tolerancePercent: decimalOrNull(data.tolerancePercent),
    binNumber: orNull(data.binNumber),
    tcsPercent: decimalOrNull(data.tcsPercent),
    vatRegistrationNo: orNull(data.vatRegistrationNo),
    tinNumber: orNull(data.tinNumber),
    tradeLicenseNo: orNull(data.tradeLicenseNo),
    isMonthly: data.isMonthly,
    isForeign: data.isForeign,
    // Keep the purchase module's LOCAL/FOREIGN type in step with the flag.
    type: data.isForeign ? "FOREIGN" : "LOCAL",
    vdsApplicable: data.vdsApplicable,
    vatAccountingNotApplicable: data.vatAccountingNotApplicable,
    isUser: data.isUser,
    address: orNull(data.billingAddress),
    districtId: data.districtId === "" ? null : data.districtId,
    thanaId: orNull(data.thanaId),
    contactPerson: orNull(data.contactPerson),
    billingContactNo: orNull(data.contactNo),
    taxBracketId: orNull(data.taxBracketId),
    remarks: orNull(data.remarks),
  };
}

function detailRows(data: SupplierData) {
  return data.details.map((detail, index) => ({
    sortOrder: index,
    code: orNull(detail.code),
    vendorName: orNull(detail.vendorName),
    address: detail.address,
    gps: orNull(detail.gps),
    contactPerson: orNull(detail.contactPerson),
    contactNumber: orNull(detail.contactNumber),
    vatRegNo: orNull(detail.vatRegNo),
  }));
}

/**
 * Checks that the selected group, sub group, thana and tax bracket exist and
 * belong to the office's business unit / district.
 */
async function validateReferences(tx: Tx, businessUnitId: string, data: SupplierData) {
  const fail = (message: string): never => {
    throw badRequest(message);
  };

  if (data.groupId) {
    const group = await tx.supplierGroup.findUnique({ where: { id: data.groupId } });
    if (!group || group.businessUnitId !== businessUnitId || group.parentId) {
      fail("Select a partner group of this office's business unit.");
    }
  }
  if (data.subGroupId) {
    const sub = await tx.supplierGroup.findUnique({ where: { id: data.subGroupId } });
    if (!sub || !data.groupId || sub.parentId !== data.groupId) {
      fail("Select a sub group of the selected partner group.");
    }
  }
  if (data.districtId !== "") {
    const district = await tx.district.findUnique({ where: { id: data.districtId } });
    if (!district) fail("Select a valid district.");
  }
  if (data.thanaId) {
    const thana = await tx.thana.findUnique({ where: { id: data.thanaId } });
    if (!thana || data.districtId === "" || thana.districtId !== data.districtId) {
      fail("Select a thana of the selected district.");
    }
  }
  if (data.taxBracketId) {
    const bracket = await tx.taxBracket.findUnique({ where: { id: data.taxBracketId } });
    if (!bracket || bracket.businessUnitId !== businessUnitId) {
      fail("Select a tax bracket of this office's business unit.");
    }
  }
}

/** Issues the next free SUP-xxxxx code (skips codes someone typed in by hand). */
async function generateCode(tx: Tx, businessUnitId: string): Promise<string> {
  for (;;) {
    const code = formatNumber(CODE_PREFIX, 0, await nextNumber(tx, businessUnitId, CODE_SEQUENCE, 0));
    const taken = await tx.supplier.findUnique({ where: { businessUnitId_code: { businessUnitId, code } } });
    if (!taken) return code;
  }
}

async function assertCodeFree(tx: Tx, businessUnitId: string, code: string, exceptId?: string) {
  const existing = await tx.supplier.findUnique({ where: { businessUnitId_code: { businessUnitId, code } } });
  if (existing && existing.id !== exceptId) {
    throw conflict(`Partner code "${code}" is already used in this business unit.`);
  }
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/** Search + filters of the supplier list, within the actor's companies. Also used by the Excel download. */
export function supplierWhere(actor: Actor, filters: SupplierFilters): Prisma.SupplierWhereInput {
  const search = filters.search
    ? { contains: escapeLike(filters.search), mode: "insensitive" as const }
    : undefined;
  return {
    AND: [
      scopeWhere(actor),
      search
        ? {
            OR: [
              { code: search },
              { name: search },
              { phone: search },
              { billingContactNo: search },
              { email: search },
              { binNumber: search },
              { tinNumber: search },
            ],
          }
        : {},
      filters.officeId ? { officeId: filters.officeId } : {},
      filters.groupId ? { groupId: filters.groupId } : {},
      filters.status ? { isActive: filters.status === "active" } : {},
      filters.type ? { isForeign: filters.type === "foreign" } : {},
    ],
  };
}

export async function listSuppliers(actor: Actor, query: SupplierListQuery): Promise<SupplierList> {
  const where = supplierWhere(actor, query);

  const [total, records] = await Promise.all([
    db().supplier.count({ where }),
    db().supplier.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        code: true,
        name: true,
        phone: true,
        email: true,
        address: true,
        billingContactNo: true,
        creditDays: true,
        isForeign: true,
        isActive: true,
        updatedAt: true,
        office: { select: { name: true } },
        group: { select: { name: true } },
        subGroup: { select: { name: true } },
        district: { select: { name: true } },
        _count: { select: { details: true } },
      },
    }),
  ]);

  const rows: SupplierListRow[] = records.map((record) => ({
    id: record.id,
    code: record.code,
    name: record.name,
    officeName: record.office?.name ?? null,
    groupName: record.group?.name ?? null,
    subGroupName: record.subGroup?.name ?? null,
    mobile: record.phone,
    email: record.email,
    billingContactNo: record.billingContactNo,
    billingAddress: record.address,
    creditDays: record.creditDays,
    districtName: record.district?.name ?? null,
    isForeign: record.isForeign,
    detailCount: record._count.details,
    isActive: record.isActive,
    updatedAt: record.updatedAt.toISOString(),
  }));

  return { rows, total, page: query.page, pageSize: query.pageSize };
}

const fullInclude = {
  details: { select: detailSelect, orderBy: { sortOrder: "asc" } },
  attachments: { select: attachmentSelect, orderBy: { createdAt: "asc" } },
} satisfies Prisma.SupplierInclude;

export async function getSupplier(actor: Actor, id: string): Promise<SupplierDto> {
  const supplier = await db().supplier.findFirst({ where: { id, ...scopeWhere(actor) }, include: fullInclude });
  if (!supplier) throw notFound("Supplier");
  return toDto(supplier);
}

export async function getFormOptions(actor: Actor): Promise<SupplierFormOptions> {
  const units = businessUnitScope(actor);
  const [offices, groups, districts, thanas, taxBrackets] = await Promise.all([
    db().office.findMany({
      where: { businessUnit: units },
      orderBy: { name: "asc" },
      select: { id: true, name: true, businessUnitId: true },
    }),
    db().supplierGroup.findMany({
      where: { businessUnit: units },
      orderBy: { name: "asc" },
      select: { id: true, name: true, parentId: true, businessUnitId: true },
    }),
    db().district.findMany({ orderBy: { name: "asc" } }),
    db().thana.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, districtId: true } }),
    db().taxBracket.findMany({
      where: { businessUnit: units },
      orderBy: { name: "asc" },
      select: { id: true, name: true, ratePercent: true, businessUnitId: true },
    }),
  ]);
  return {
    offices,
    groups,
    districts,
    thanas,
    taxBrackets: taxBrackets.map((bracket) => ({ ...bracket, ratePercent: bracket.ratePercent?.toString() ?? null })),
  };
}

// ─── Commands ─────────────────────────────────────────────────────────────────

export async function createSupplier(actor: Actor, input: SupplierInput): Promise<SupplierDto> {
  const data = supplierInputSchema.parse(input);
  const office = await loadOffice(actor, data.officeId);

  const record = await db().$transaction(async (tx) => {
    await validateReferences(tx, office.businessUnitId, data);
    const code = data.code || (await generateCode(tx, office.businessUnitId));
    if (data.code) await assertCodeFree(tx, office.businessUnitId, code);

    return tx.supplier.create({
      data: {
        ...columns(data),
        businessUnitId: office.businessUnitId,
        code,
        details: { create: detailRows(data) },
      },
      include: fullInclude,
    });
  });
  return toDto(record);
}

export async function updateSupplier(actor: Actor, id: string, input: SupplierInput): Promise<SupplierDto> {
  const data = supplierInputSchema.parse(input);
  const existing = await loadSupplier(actor, id);
  const office = await loadOffice(actor, data.officeId);
  if (office.businessUnitId !== existing.businessUnitId) {
    throw badRequest("The office must belong to the supplier's business unit.");
  }

  const record = await db().$transaction(async (tx) => {
    await validateReferences(tx, office.businessUnitId, data);
    const code = data.code || existing.code;
    if (code !== existing.code) await assertCodeFree(tx, office.businessUnitId, code, id);

    await tx.supplierDetail.deleteMany({ where: { supplierId: id } });
    return tx.supplier.update({
      where: { id },
      data: { ...columns(data), code, details: { create: detailRows(data) } },
      include: fullInclude,
    });
  });
  return toDto(record);
}

// ─── "+ Add new" options ──────────────────────────────────────────────────────

export async function createSupplierGroup(actor: Actor, input: CreateSupplierGroupInput): Promise<SupplierGroupOption> {
  const name = input.name.trim();
  const office = await loadOffice(actor, input.officeId);
  const parentId = input.parentId || null;
  if (parentId) {
    const parent = await db().supplierGroup.findUnique({ where: { id: parentId } });
    if (!parent || parent.businessUnitId !== office.businessUnitId || parent.parentId) {
      throw new AppError(400, "VALIDATION_ERROR", "Select a partner group first.");
    }
  }
  // NULL parentId is not covered by the unique index, so check top-level names here.
  const duplicate = await db().supplierGroup.findFirst({
    where: { businessUnitId: office.businessUnitId, parentId, name: { equals: name, mode: "insensitive" } },
  });
  if (duplicate) throw conflict(`"${name}" already exists.`);

  return db().supplierGroup.create({
    data: { businessUnitId: office.businessUnitId, parentId, name },
    select: { id: true, name: true, parentId: true, businessUnitId: true },
  });
}

export async function createThana(_actor: Actor, input: CreateThanaInput) {
  const name = input.name.trim();
  const district = await db().district.findUnique({ where: { id: input.districtId } });
  if (!district) throw new AppError(400, "VALIDATION_ERROR", "Select a valid district.");
  const duplicate = await db().thana.findFirst({
    where: { districtId: district.id, name: { equals: name, mode: "insensitive" } },
  });
  if (duplicate) throw conflict(`"${name}" already exists in ${district.name}.`);
  return db().thana.create({ data: { districtId: district.id, name }, select: { id: true, name: true, districtId: true } });
}

export async function createTaxBracket(actor: Actor, input: CreateTaxBracketInput): Promise<TaxBracketOption> {
  const name = input.name.trim();
  const office = await loadOffice(actor, input.officeId);
  const duplicate = await db().taxBracket.findFirst({
    where: { businessUnitId: office.businessUnitId, name: { equals: name, mode: "insensitive" } },
  });
  if (duplicate) throw conflict(`"${name}" already exists.`);
  const bracket = await db().taxBracket.create({
    data: { businessUnitId: office.businessUnitId, name, ratePercent: input.ratePercent || null },
    select: { id: true, name: true, ratePercent: true, businessUnitId: true },
  });
  return { ...bracket, ratePercent: bracket.ratePercent?.toString() ?? null };
}

// ─── Attachments ──────────────────────────────────────────────────────────────

export interface UploadedFile {
  name: string;
  type: string;
  size: number;
  bytes?: Uint8Array;
}

/** Detects PDF / PNG / JPEG / WebP from magic bytes; never trust the client's MIME type. */
function sniffType(bytes: Uint8Array): string | null {
  const at = (signature: number[], offset = 0) => signature.every((byte, index) => bytes[offset + index] === byte);
  if (at([0x25, 0x50, 0x44, 0x46])) return "application/pdf";
  if (at([0x89, 0x50, 0x4e, 0x47])) return "image/png";
  if (at([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (at([0x52, 0x49, 0x46, 0x46]) && at([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}

export function validateAttachment(file: UploadedFile): string {
  if (file.size === 0) throw new AppError(400, "VALIDATION_ERROR", "The selected file is empty.");
  if (file.size > MAX_SUPPLIER_ATTACHMENT_BYTES) {
    throw new AppError(413, "PAYLOAD_TOO_LARGE", "Attachments must be 5 MB or smaller.");
  }
  if (!(ALLOWED_SUPPLIER_ATTACHMENT_TYPES as readonly string[]).includes(file.type)) {
    throw new AppError(415, "UNSUPPORTED_MEDIA_TYPE", "Only PDF, PNG, JPEG or WebP files are allowed.");
  }
  if (file.bytes) {
    const detected = sniffType(file.bytes);
    if (detected !== file.type) {
      throw new AppError(415, "UNSUPPORTED_MEDIA_TYPE", "The file content does not match its type.");
    }
  }
  return file.type;
}

const sanitizeFileName = (name: string) =>
  (name.replace(/[\u0000-\u001f\u007f"\\/]/g, "_").trim() || "attachment").slice(0, 255);

export async function addAttachment(
  actor: Actor,
  supplierId: string,
  file: Required<UploadedFile>,
): Promise<SupplierAttachmentDto> {
  await loadSupplier(actor, supplierId);
  const mimeType = validateAttachment(file);
  const storageKey = `suppliers/${supplierId}/${randomUUID()}`;
  await getStorage().put(storageKey, file.bytes);
  try {
    const record = await db().supplierAttachment.create({
      data: { supplierId, storageKey, originalName: sanitizeFileName(file.name), mimeType, size: file.size },
      select: attachmentSelect,
    });
    return toAttachmentDto(record);
  } catch (error) {
    await getStorage().delete(storageKey).catch(() => undefined);
    throw error;
  }
}

async function loadAttachment(actor: Actor, supplierId: string, attachmentId: string) {
  await loadSupplier(actor, supplierId);
  const attachment = await db().supplierAttachment.findFirst({ where: { id: attachmentId, supplierId } });
  if (!attachment) throw notFound("Attachment");
  return attachment;
}

export async function readAttachment(actor: Actor, supplierId: string, attachmentId: string) {
  const attachment = await loadAttachment(actor, supplierId, attachmentId);
  const bytes = await getStorage().get(attachment.storageKey);
  if (!bytes) throw notFound("Attachment file");
  return { bytes, mimeType: attachment.mimeType, originalName: attachment.originalName };
}

export async function deleteAttachment(actor: Actor, supplierId: string, attachmentId: string): Promise<void> {
  const attachment = await loadAttachment(actor, supplierId, attachmentId);
  await db().supplierAttachment.delete({ where: { id: attachment.id } });
  await getStorage().delete(attachment.storageKey).catch(() => undefined);
}
