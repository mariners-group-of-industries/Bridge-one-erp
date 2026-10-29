import { randomUUID } from "node:crypto";
import { validateAttachment, type UploadedFile } from "@/features/configuration/entity-master-data/supplier/server/supplier.service";
import { formatNumber, nextNumber } from "@/features/sales/lib/sequence";
import type { Prisma } from "@/generated/prisma/client";
import { badRequest, conflict, notFound } from "@/lib/api/errors";
import { assertCompanyAccess, type Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { getStorage } from "@/lib/storage";
import {
  CUSTOMER_FLAGS,
  customerInputSchema,
  SALES_FORCE_LIMIT,
  type CreateCustomerGroupInput,
  type CreateSectionInput,
  type CustomerAttachmentDto,
  type CustomerData,
  type CustomerDto,
  type CustomerFilters,
  type CustomerFormOptions,
  type CustomerInput,
  type CustomerList,
  type CustomerListQuery,
  type CustomerListRow,
  type SalesForceList,
} from "../schemas/customer.schema";

type Tx = Prisma.TransactionClient;
type Client = Tx | ReturnType<typeof db>;

// Same numbering as Sales › Setup, so both screens issue CUST-00001, CUST-00002 …
const CODE_PREFIX = "CUST";
const CODE_SEQUENCE = "CUSTOMER";

// ─── Scoping ──────────────────────────────────────────────────────────────────

function companyScope(actor: Actor): Prisma.CustomerWhereInput {
  return actor.companyScope === "ALL" ? {} : { businessUnit: { companyId: { in: [...actor.companyScope] } } };
}

function businessUnitScope(actor: Actor): Prisma.BusinessUnitWhereInput {
  return actor.companyScope === "ALL" ? {} : { companyId: { in: [...actor.companyScope] } };
}

async function loadOffice(actor: Actor, officeId: string, client: Client = db()) {
  const office = await client.office.findUnique({
    where: { id: officeId },
    select: { id: true, businessUnitId: true, businessUnit: { select: { companyId: true } } },
  });
  if (!office) throw notFound("Office");
  assertCompanyAccess(actor, office.businessUnit.companyId, "Office");
  return office;
}

async function loadCustomer(actor: Actor, id: string, client: Client = db()) {
  const customer = await client.customer.findFirst({ where: { id, ...companyScope(actor) } });
  if (!customer) throw notFound("Customer");
  return customer;
}

// ─── Mapping ──────────────────────────────────────────────────────────────────

const orNull = (value: string) => (value === "" ? null : value);
const str = (value: unknown) => (value === null || value === undefined ? "" : String(value));
const dateOnly = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : "");
const toDate = (value: string) => (value ? new Date(`${value}T00:00:00.000Z`) : null);
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

const attachmentSelect = { id: true, originalName: true, mimeType: true, size: true, createdAt: true } satisfies Prisma.CustomerAttachmentSelect;

const fullInclude = {
  addresses: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
  attachments: { select: attachmentSelect, orderBy: { createdAt: "asc" } },
} satisfies Prisma.CustomerInclude;

type CustomerRecord = Prisma.CustomerGetPayload<{ include: typeof fullInclude }>;

function toAttachmentDto(record: Prisma.CustomerAttachmentGetPayload<{ select: typeof attachmentSelect }>): CustomerAttachmentDto {
  return { ...record, createdAt: record.createdAt.toISOString() };
}

function toDto(record: CustomerRecord): CustomerDto {
  const flags = Object.fromEntries(CUSTOMER_FLAGS.map((flag) => [flag.key, record[flag.key]])) as Pick<
    CustomerDto,
    (typeof CUSTOMER_FLAGS)[number]["key"]
  >;
  return {
    id: record.id,
    officeId: record.officeId ?? "",
    name: record.name,
    code: record.code,
    mobile: str(record.phone),
    email: str(record.email),
    groupId: str(record.customerGroupId),
    subGroupId: str(record.subGroupId),
    creditDays: String(record.creditDays),
    creditLimit: str(record.creditLimit),
    territoryId: str(record.territoryId),
    salesPersonId: str(record.salesPersonId),
    tolerancePercent: str(record.tolerancePercent),
    binNumber: str(record.binNumber),
    priceListId: str(record.priceListId),
    tcsPercent: str(record.tcsPercent),
    vatRegistrationNo: str(record.vatRegistrationNo),
    tinNumber: str(record.tinNumber),
    tradeLicenseNo: str(record.tradeLicenseNo),
    maritalStatus: (record.maritalStatus ?? "") as CustomerDto["maritalStatus"],
    marriageDate: dateOnly(record.marriageDate),
    birthDate: dateOnly(record.birthDate),
    gender: (record.gender ?? "") as CustomerDto["gender"],
    nidNumber: str(record.nidNumber),
    ...flags,
    billingName: str(record.billingName),
    billingAddress: str(record.address),
    districtId: record.districtId ?? "",
    thanaId: str(record.thanaId),
    contactPerson: str(record.contactPerson),
    contactNo: str(record.billingContactNo),
    taxBracketId: str(record.taxBracketId),
    remarks: str(record.remarks),
    bankType: str(record.bankAccountType),
    bankAccountNo: str(record.bankAccountNo),
    bankBranch: str(record.bankBranch),
    bankName: str(record.bankName),
    bankRoutingNo: str(record.bankRoutingNo),
    shipping: record.addresses.map((address) => ({
      id: address.id,
      code: str(address.code),
      outlet: address.label,
      address: address.address,
      gps: str(address.gps),
      contactPerson: str(address.contactPerson),
      contactNo: str(address.contactNo),
      vatRegNo: str(address.vatRegNo),
      districtId: address.districtId ?? "",
      thanaId: str(address.thanaId),
      sectionId: str(address.sectionId),
    })),
    attachments: record.attachments.map(toAttachmentDto),
  };
}

/** Column values shared by create and update (everything except business unit, code and addresses). */
function columns(data: CustomerData) {
  return {
    officeId: data.officeId,
    name: data.name,
    phone: data.mobile,
    email: orNull(data.email),
    customerGroupId: orNull(data.groupId),
    subGroupId: orNull(data.subGroupId),
    creditDays: data.creditDays === "" ? 0 : Number(data.creditDays),
    creditLimit: orNull(data.creditLimit),
    territoryId: orNull(data.territoryId),
    salesPersonId: orNull(data.salesPersonId),
    tolerancePercent: orNull(data.tolerancePercent),
    binNumber: orNull(data.binNumber),
    priceListId: orNull(data.priceListId),
    tcsPercent: orNull(data.tcsPercent),
    vatRegistrationNo: orNull(data.vatRegistrationNo),
    tinNumber: orNull(data.tinNumber),
    tradeLicenseNo: orNull(data.tradeLicenseNo),
    maritalStatus: orNull(data.maritalStatus),
    marriageDate: toDate(data.marriageDate),
    birthDate: toDate(data.birthDate),
    gender: orNull(data.gender),
    nidNumber: orNull(data.nidNumber),
    ...Object.fromEntries(CUSTOMER_FLAGS.map((flag) => [flag.key, data[flag.key]])),
    billingName: orNull(data.billingName),
    address: orNull(data.billingAddress),
    districtId: data.districtId === "" ? null : data.districtId,
    thanaId: orNull(data.thanaId),
    contactPerson: orNull(data.contactPerson),
    billingContactNo: orNull(data.contactNo),
    taxBracketId: orNull(data.taxBracketId),
    remarks: orNull(data.remarks),
    bankAccountType: orNull(data.bankType),
    bankAccountNo: orNull(data.bankAccountNo),
    bankBranch: orNull(data.bankBranch),
    bankName: orNull(data.bankName),
    bankRoutingNo: orNull(data.bankRoutingNo),
  };
}

function addressColumns(row: CustomerData["shipping"][number], index: number) {
  return {
    // Sales shows the label in customer address pickers; fall back to a numbered outlet.
    label: row.outlet || row.code || `Outlet ${index + 1}`,
    address: row.address,
    isDefault: index === 0,
    sortOrder: index,
    code: orNull(row.code),
    gps: orNull(row.gps),
    contactPerson: orNull(row.contactPerson),
    contactNo: orNull(row.contactNo),
    vatRegNo: orNull(row.vatRegNo),
    districtId: row.districtId === "" ? null : row.districtId,
    thanaId: orNull(row.thanaId),
    sectionId: orNull(row.sectionId),
  };
}

/** Checks every selected option exists and belongs to the office's business unit / district. */
async function validateReferences(tx: Tx, businessUnitId: string, data: CustomerData) {
  const inUnit = async (
    id: string,
    find: (id: string) => Promise<{ businessUnitId: string } | null>,
    message: string,
  ) => {
    if (!id) return;
    const record = await find(id);
    if (!record || record.businessUnitId !== businessUnitId) throw badRequest(message);
  };

  if (data.groupId) {
    const group = await tx.customerGroup.findUnique({ where: { id: data.groupId } });
    if (!group || group.businessUnitId !== businessUnitId || group.parentId) {
      throw badRequest("Select a partner group of this office's business unit.");
    }
  }
  if (data.subGroupId) {
    const sub = await tx.customerGroup.findUnique({ where: { id: data.subGroupId } });
    if (!sub || !data.groupId || sub.parentId !== data.groupId) throw badRequest("Select a sub group of the selected partner group.");
  }
  const area = (kind: "TERRITORY" | "SECTION") => (id: string) =>
    tx.salesArea.findFirst({ where: { id, kind }, select: { businessUnitId: true } });
  await inUnit(data.territoryId, area("TERRITORY"), "Select a territory of this office's business unit.");
  await inUnit(
    data.salesPersonId,
    (id) => tx.salesPerson.findUnique({ where: { id }, select: { businessUnitId: true } }),
    "Select a sales representative of this office's business unit.",
  );
  await inUnit(
    data.priceListId,
    (id) => tx.priceList.findUnique({ where: { id }, select: { businessUnitId: true } }),
    "Select a price type of this office's business unit.",
  );
  await inUnit(
    data.taxBracketId,
    (id) => tx.taxBracket.findUnique({ where: { id }, select: { businessUnitId: true } }),
    "Select a tax bracket of this office's business unit.",
  );

  const checkPlace = async (districtId: number | "", thanaId: string, where: string) => {
    if (districtId !== "" && !(await tx.district.findUnique({ where: { id: districtId } }))) {
      throw badRequest(`${where}: select a valid district.`);
    }
    if (thanaId) {
      const thana = await tx.thana.findUnique({ where: { id: thanaId } });
      if (!thana || districtId === "" || thana.districtId !== districtId) throw badRequest(`${where}: select a thana of the selected district.`);
    }
  };
  await checkPlace(data.districtId, data.thanaId, "Billing");
  for (const [index, row] of data.shipping.entries()) {
    await checkPlace(row.districtId, row.thanaId, `Shipping row ${index + 1}`);
    await inUnit(row.sectionId, area("SECTION"), `Shipping row ${index + 1}: select a section of this business unit.`);
  }
}

async function generateCode(tx: Tx, businessUnitId: string): Promise<string> {
  for (;;) {
    const code = formatNumber(CODE_PREFIX, 0, await nextNumber(tx, businessUnitId, CODE_SEQUENCE, 0));
    if (!(await tx.customer.findUnique({ where: { businessUnitId_code: { businessUnitId, code } } }))) return code;
  }
}

async function assertCodeFree(tx: Tx, businessUnitId: string, code: string, exceptId?: string) {
  const existing = await tx.customer.findUnique({ where: { businessUnitId_code: { businessUnitId, code } } });
  if (existing && existing.id !== exceptId) throw conflict(`Partner code "${code}" is already used in this business unit.`);
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/** Search + filters within the actor's companies; shared by both tabs. */
export function customerWhere(actor: Actor, filters: CustomerFilters): Prisma.CustomerWhereInput {
  const search = filters.search ? { contains: escapeLike(filters.search), mode: "insensitive" as const } : undefined;
  const created: Prisma.DateTimeFilter = {};
  if (filters.fromDate) created.gte = new Date(`${filters.fromDate}T00:00:00.000Z`);
  if (filters.toDate) created.lt = new Date(new Date(`${filters.toDate}T00:00:00.000Z`).getTime() + 86_400_000);
  return {
    AND: [
      companyScope(actor),
      search
        ? {
            OR: [
              { code: search },
              { name: search },
              { phone: search },
              { email: search },
              { billingContactNo: search },
              { billingName: search },
              { nidNumber: search },
              { binNumber: search },
            ],
          }
        : {},
      filters.officeId ? { officeId: filters.officeId } : {},
      filters.groupId ? { customerGroupId: filters.groupId } : {},
      filters.subGroupId ? { subGroupId: filters.subGroupId } : {},
      filters.status ? { isActive: filters.status === "active" } : {},
      filters.territoryId ? { territoryId: filters.territoryId } : {},
      created.gte || created.lt ? { createdAt: created } : {},
    ],
  };
}

const rowSelect = {
  id: true,
  code: true,
  name: true,
  phone: true,
  billingName: true,
  billingContactNo: true,
  address: true,
  creditLimit: true,
  isForeign: true,
  isActive: true,
  createdAt: true,
  office: { select: { name: true } },
  customerGroup: { select: { name: true } },
  subGroup: { select: { name: true } },
  territory: { select: { name: true } },
  salesPerson: { select: { id: true, code: true, name: true, phone: true } },
} satisfies Prisma.CustomerSelect;

function toRow(record: Prisma.CustomerGetPayload<{ select: typeof rowSelect }>): CustomerListRow {
  return {
    id: record.id,
    code: record.code,
    name: record.name,
    officeName: record.office?.name ?? null,
    groupName: record.customerGroup?.name ?? null,
    subGroupName: record.subGroup?.name ?? null,
    mobile: record.phone,
    billingName: record.billingName,
    billingContactNo: record.billingContactNo,
    billingAddress: record.address,
    territoryName: record.territory?.name ?? null,
    salesPersonName: record.salesPerson?.name ?? null,
    creditLimit: record.creditLimit?.toString() ?? null,
    isForeign: record.isForeign,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
  };
}

export async function listCustomers(actor: Actor, query: CustomerListQuery): Promise<CustomerList> {
  const where = customerWhere(actor, query);
  const [total, records] = await Promise.all([
    db().customer.count({ where }),
    db().customer.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: rowSelect,
    }),
  ]);
  return { rows: records.map(toRow), total, page: query.page, pageSize: query.pageSize };
}

/** "Sales force wise customer details": matching customers grouped by default sales representative. */
export async function listCustomersBySalesForce(actor: Actor, filters: CustomerFilters): Promise<SalesForceList> {
  const where = customerWhere(actor, filters);
  const [total, records] = await Promise.all([
    db().customer.count({ where }),
    db().customer.findMany({
      where,
      orderBy: [{ salesPerson: { name: "asc" } }, { name: "asc" }],
      take: SALES_FORCE_LIMIT,
      select: rowSelect,
    }),
  ]);
  const groups = new Map<string, SalesForceList["groups"][number]>();
  for (const record of records) {
    const key = record.salesPerson?.id ?? "";
    if (!groups.has(key)) groups.set(key, { salesPerson: record.salesPerson ?? null, customers: [] });
    groups.get(key)!.customers.push(toRow(record));
  }
  // Customers without a representative go last.
  const sorted = [...groups.values()].sort((a, b) =>
    !a.salesPerson ? 1 : !b.salesPerson ? -1 : a.salesPerson.name.localeCompare(b.salesPerson.name),
  );
  return { groups: sorted, total, truncated: total > records.length };
}

export async function getCustomer(actor: Actor, id: string): Promise<CustomerDto> {
  const customer = await db().customer.findFirst({ where: { id, ...companyScope(actor) }, include: fullInclude });
  if (!customer) throw notFound("Customer");
  return toDto(customer);
}

export async function getFormOptions(actor: Actor): Promise<CustomerFormOptions> {
  const unit = { businessUnit: businessUnitScope(actor) };
  const bu = { id: true, name: true, businessUnitId: true } as const;
  // Plain parallel reads: a transaction here hit Prisma's 20 s limit on the slow remote database.
  const [offices, groups, areas, salesPersons, priceLists, taxBrackets, districts, thanas] = await Promise.all([
    db().office.findMany({ where: unit, orderBy: { name: "asc" }, select: bu }),
    db().customerGroup.findMany({ where: { ...unit, isActive: true }, orderBy: { name: "asc" }, select: { ...bu, parentId: true } }),
    db().salesArea.findMany({
      where: { ...unit, isActive: true, kind: { in: ["TERRITORY", "SECTION"] } },
      orderBy: { name: "asc" },
      select: { ...bu, kind: true },
    }),
    db().salesPerson.findMany({ where: { ...unit, isActive: true }, orderBy: { name: "asc" }, select: { ...bu, code: true } }),
    db().priceList.findMany({ where: unit, orderBy: { name: "asc" }, select: bu }),
    db().taxBracket.findMany({ where: unit, orderBy: { name: "asc" }, select: { ...bu, ratePercent: true } }),
    db().district.findMany({ orderBy: { name: "asc" } }),
    db().thana.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, districtId: true } }),
  ]);
  const pick = (kind: string) => areas.filter((area) => area.kind === kind).map(({ kind: _kind, ...area }) => area);
  return {
    offices,
    groups,
    territories: pick("TERRITORY"),
    sections: pick("SECTION"),
    salesPersons,
    priceLists,
    taxBrackets: taxBrackets.map((bracket) => ({ ...bracket, ratePercent: bracket.ratePercent?.toString() ?? null })),
    districts,
    thanas,
  };
}

// ─── Commands ─────────────────────────────────────────────────────────────────

export async function createCustomer(actor: Actor, input: CustomerInput): Promise<CustomerDto> {
  const data = customerInputSchema.parse(input);
  const office = await loadOffice(actor, data.officeId);

  const record = await db().$transaction(async (tx) => {
    await validateReferences(tx, office.businessUnitId, data);
    const code = data.code || (await generateCode(tx, office.businessUnitId));
    if (data.code) await assertCodeFree(tx, office.businessUnitId, code);
    return tx.customer.create({
      data: {
        ...columns(data),
        businessUnitId: office.businessUnitId,
        code,
        addresses: { create: data.shipping.map(addressColumns) },
      },
      include: fullInclude,
    });
  });
  return toDto(record);
}

export async function updateCustomer(actor: Actor, id: string, input: CustomerInput): Promise<CustomerDto> {
  const data = customerInputSchema.parse(input);
  const existing = await loadCustomer(actor, id);
  const office = await loadOffice(actor, data.officeId);
  if (office.businessUnitId !== existing.businessUnitId) throw badRequest("The office must belong to the customer's business unit.");

  const record = await db().$transaction(async (tx) => {
    await validateReferences(tx, office.businessUnitId, data);
    const code = data.code || existing.code;
    if (code !== existing.code) await assertCodeFree(tx, office.businessUnitId, code, id);

    // Update shipping rows in place (sales orders may point at them), add new ones, drop removed ones.
    const keepIds = data.shipping.flatMap((row) => (row.id ? [row.id] : []));
    await tx.customerAddress.deleteMany({ where: { customerId: id, id: { notIn: keepIds } } });
    // Clear defaults first so the one-default index never sees two at once.
    await tx.customerAddress.updateMany({ where: { customerId: id }, data: { isDefault: false } });
    for (const [index, row] of data.shipping.entries()) {
      const values = addressColumns(row, index);
      if (row.id) {
        const { count } = await tx.customerAddress.updateMany({ where: { id: row.id, customerId: id }, data: values });
        if (count === 0) throw badRequest("A shipping address does not belong to this customer.");
      } else {
        await tx.customerAddress.create({ data: { ...values, customerId: id } });
      }
    }

    return tx.customer.update({ where: { id }, data: { ...columns(data), code }, include: fullInclude });
  });
  return toDto(record);
}

// ─── "+ Add new" options ──────────────────────────────────────────────────────

export async function createCustomerGroup(actor: Actor, input: CreateCustomerGroupInput) {
  const name = input.name.trim();
  const office = await loadOffice(actor, input.officeId);
  const parentId = input.parentId || null;
  if (parentId) {
    const parent = await db().customerGroup.findUnique({ where: { id: parentId } });
    if (!parent || parent.businessUnitId !== office.businessUnitId || parent.parentId) throw badRequest("Select a partner group first.");
  }
  // Group names are unique per business unit (Sales' rule), including sub groups.
  const duplicate = await db().customerGroup.findFirst({
    where: { businessUnitId: office.businessUnitId, name: { equals: name, mode: "insensitive" } },
  });
  if (duplicate) throw conflict(`A group named "${name}" already exists.`);
  return db().customerGroup.create({
    data: { businessUnitId: office.businessUnitId, parentId, name },
    select: { id: true, name: true, businessUnitId: true, parentId: true },
  });
}

export async function createSection(actor: Actor, input: CreateSectionInput) {
  const name = input.name.trim();
  const office = await loadOffice(actor, input.officeId);
  const duplicate = await db().salesArea.findFirst({
    where: { businessUnitId: office.businessUnitId, kind: "SECTION", name: { equals: name, mode: "insensitive" } },
  });
  if (duplicate) throw conflict(`"${name}" already exists.`);
  return db().salesArea.create({
    data: { businessUnitId: office.businessUnitId, kind: "SECTION", name },
    select: { id: true, name: true, businessUnitId: true },
  });
}

// ─── Attachments ──────────────────────────────────────────────────────────────

const sanitizeFileName = (name: string) =>
  (name.replace(/[\u0000-\u001f\u007f"\\/]/g, "_").trim() || "attachment").slice(0, 255);

export async function addAttachment(actor: Actor, customerId: string, file: Required<UploadedFile>): Promise<CustomerAttachmentDto> {
  await loadCustomer(actor, customerId);
  const mimeType = validateAttachment(file);
  const storageKey = `customers/${customerId}/${randomUUID()}`;
  await getStorage().put(storageKey, file.bytes);
  try {
    const record = await db().customerAttachment.create({
      data: { customerId, storageKey, originalName: sanitizeFileName(file.name), mimeType, size: file.size },
      select: attachmentSelect,
    });
    return toAttachmentDto(record);
  } catch (error) {
    await getStorage().delete(storageKey).catch(() => undefined);
    throw error;
  }
}

async function loadAttachment(actor: Actor, customerId: string, attachmentId: string) {
  await loadCustomer(actor, customerId);
  const attachment = await db().customerAttachment.findFirst({ where: { id: attachmentId, customerId } });
  if (!attachment) throw notFound("Attachment");
  return attachment;
}

export async function readAttachment(actor: Actor, customerId: string, attachmentId: string) {
  const attachment = await loadAttachment(actor, customerId, attachmentId);
  const bytes = await getStorage().get(attachment.storageKey);
  if (!bytes) throw notFound("Attachment file");
  return { bytes, mimeType: attachment.mimeType, originalName: attachment.originalName };
}

export async function deleteAttachment(actor: Actor, customerId: string, attachmentId: string): Promise<void> {
  const attachment = await loadAttachment(actor, customerId, attachmentId);
  await db().customerAttachment.delete({ where: { id: attachment.id } });
  await getStorage().delete(attachment.storageKey).catch(() => undefined);
}

// ─── Status ───────────────────────────────────────────────────────────────────

/** Activates or deactivates a customer (the list's Active/Inactive button). */
export async function setCustomerActive(actor: Actor, id: string, isActive: boolean) {
  await loadCustomer(actor, id);
  return db().customer.update({ where: { id }, data: { isActive }, select: { id: true, isActive: true } });
}
