import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { z } from "zod";
import { validateAttachment, type UploadedFile } from "@/features/configuration/entity-master-data/supplier/server/supplier.service";
import { badRequest, notFound } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { decideWithPipeline } from "@/lib/approval/engine";
import { loadWorkbook } from "@/lib/excel/load-workbook";
import { db } from "@/lib/prisma/client";
import { getStorage } from "@/lib/storage";
import { DATE, actorName, fromDbDate, num, requireDistributor, toDbDate, unitIds, type Tx } from "./common";
import { getSettings } from "./masters.service";
import { territoryFilters } from "./territory.service";

/**
 * Outlet Setup: the outlet profile, where it is served (Sales Territory nodes,
 * Base Point › Route › Market), its image and documents, and Outlet Setup
 * Approval: a new outlet can take orders once approved.
 */

const text = (max: number) => z.string().trim().max(max).optional().transform((v) => v || undefined);
const optUuid = z.preprocess((v) => (v === "" ? undefined : v), z.guid().optional());
const optNum = z.preprocess((v) => (v === "" || v === null ? undefined : v), z.coerce.number().finite().min(0).optional());
const optInt = z.preprocess((v) => (v === "" || v === null ? undefined : v), z.coerce.number().int().min(0).max(1_000_000).optional());
const PHONE = /^[0-9+\-\s()]{6,30}$/;
const phone = z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().regex(PHONE, "Enter a valid phone number.").optional());

export const SALES_PERIODS = ["DAILY", "MONTHLY"] as const;

const outletSchema = z.object({
  name: z.string().trim().min(1, "Enter the outlet name.").max(150),
  nameBn: text(150),
  partnerCode: text(30),
  creditLimit: optNum,
  category: text(60),
  businessType: text(60),
  outletGroup: text(60),
  districtId: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.coerce.number().int().positive().optional()),
  thanaId: optUuid,
  phone,
  ownerPhone: phone,
  contactPerson: text(150),
  ownerName: text(150),
  address: text(300),
  tradeLicense: text(60),
  nid: z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().regex(/^\d{10,17}$/, "An NID has 10, 13 or 17 digits.").optional()),
  email: z.preprocess((v) => (v === "" ? undefined : v), z.email("Enter a valid email address.").max(150).optional()),
  dateOfBirth: z.preprocess((v) => (v === "" ? undefined : v), z.string().regex(DATE).optional()),
  serial: optInt,
  maritalStatus: z.preprocess((v) => (v === "" ? undefined : v), z.enum(["Single", "Married", "Divorced", "Widowed"]).optional()),
  competitors: text(300),
  competitorItems: text(300),
  regularSales: optNum,
  salesPeriod: z.preprocess((v) => (v === "" ? undefined : v), z.enum(SALES_PERIODS).optional()),
  distributorId: z.guid("Select the distributor."),
  channelId: optUuid,
  latitude: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.coerce.number().min(-90).max(90).optional()),
  longitude: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.coerce.number().min(-180).max(180).optional()),
  isActive: z.boolean().default(true),
  /** Sales Territory nodes (deepest picked per row); the first is the main one. */
  areaNodeIds: z.array(z.guid()).max(20).default([]),
});

// ── List ─────────────────────────────────────────────────────────────────────

const LAYER_COLUMNS = { territory: "territory", section: "section", basePoint: "base point", route: "route", market: "market" } as const;

export async function listOutlets(actor: Actor) {
  const units = await unitIds(actor);
  const [rows, territory] = await Promise.all([
    db().rtmOutlet.findMany({
      where: { businessUnitId: { in: units } },
      include: {
        channel: { select: { name: true } },
        distributor: { select: { code: true, name: true } },
        district: { select: { name: true, division: true } },
        thana: { select: { name: true } },
        areas: { orderBy: { lineNo: "asc" }, select: { nodeId: true } },
        _count: { select: { attachments: true } },
      },
      orderBy: { code: "asc" },
      take: 5000,
    }),
    territoryFilters(actor),
  ]);
  // Node → its layer name and path, to fill Territory / Section / Route / Market from the main area.
  const layerOf = new Map<string, string>();
  const nodeById = new Map<string, { name: string; path: string[] }>();
  for (const l of territory.layers)
    for (const n of l.nodes) {
      layerOf.set(n.id, l.name.trim().toLowerCase());
      nodeById.set(n.id, { name: n.name, path: n.path });
    }
  const along = (nodeId: string | undefined) => {
    const out: Partial<Record<keyof typeof LAYER_COLUMNS, string>> = {};
    for (const id of nodeId ? (nodeById.get(nodeId)?.path ?? []) : []) {
      const layer = layerOf.get(id);
      for (const [key, name] of Object.entries(LAYER_COLUMNS) as [keyof typeof LAYER_COLUMNS, string][]) if (layer === name) out[key] = nodeById.get(id)?.name;
    }
    return out;
  };
  return rows.map((o) => {
    const main = o.areas[0]?.nodeId;
    const srs = main ? territory.salesForce.filter((s) => s.nodeIds.includes(main)) : [];
    return {
      id: o.id,
      code: o.code,
      name: o.name,
      nameBn: o.nameBn,
      partnerCode: o.partnerCode,
      category: o.category,
      businessType: o.businessType,
      outletGroup: o.outletGroup,
      division: o.district?.division ?? null,
      districtId: o.districtId,
      district: o.district?.name ?? null,
      thanaId: o.thanaId,
      thana: o.thana?.name ?? null,
      phone: o.phone,
      ownerPhone: o.ownerPhone,
      contactPerson: o.contactPerson,
      ownerName: o.ownerName,
      address: o.address,
      tradeLicense: o.tradeLicense,
      nid: o.nid,
      email: o.email,
      dateOfBirth: o.dateOfBirth ? fromDbDate(o.dateOfBirth) : null,
      serial: o.serial,
      maritalStatus: o.maritalStatus,
      competitors: o.competitors,
      competitorItems: o.competitorItems,
      regularSales: o.regularSales === null ? null : num(o.regularSales),
      salesPeriod: o.salesPeriod,
      channelId: o.channelId,
      channel: o.channel?.name ?? null,
      distributorId: o.distributorId,
      distributor: `${o.distributor.code} · ${o.distributor.name}`,
      latitude: o.latitude === null ? null : num(o.latitude),
      longitude: o.longitude === null ? null : num(o.longitude),
      creditLimit: o.creditLimit === null ? null : num(o.creditLimit),
      isActive: o.isActive,
      approvalStatus: o.approvalStatus,
      approvedBy: o.approvedBy,
      areaNodeIds: o.areas.map((a) => a.nodeId),
      ...along(main),
      moreAreas: Math.max(0, o.areas.length - 1),
      assignedSrs: srs.map((s) => `${s.code} · ${s.name}`),
      attachments: o._count.attachments,
      updatedAt: o.updatedAt.toISOString(),
    };
  });
}

// ── Save ─────────────────────────────────────────────────────────────────────

async function checkRefs(tx: Tx, businessUnitId: string, input: z.infer<typeof outletSchema>) {
  if (input.channelId && !(await tx.rtmChannel.findFirst({ where: { id: input.channelId, businessUnitId } }))) throw badRequest("The channel belongs to another business unit.");
  if (input.thanaId) {
    const thana = await tx.thana.findUnique({ where: { id: input.thanaId }, select: { districtId: true } });
    if (!thana) throw badRequest("Unknown thana / upazila.");
    if (input.districtId && thana.districtId !== input.districtId) throw badRequest("The thana / upazila is in another district.");
  }
  if (input.districtId && !(await tx.district.findUnique({ where: { id: input.districtId }, select: { id: true } }))) throw badRequest("Unknown district.");
  const nodeIds = [...new Set(input.areaNodeIds)];
  if (nodeIds.length !== input.areaNodeIds.length) throw badRequest("The same area is added twice.");
  if (nodeIds.length && (await tx.salesTerritoryNode.count({ where: { id: { in: nodeIds }, businessUnitId } })) !== nodeIds.length) throw badRequest("Some areas are not in this business unit's sales territory.");
  return nodeIds;
}

const profile = (input: z.infer<typeof outletSchema>) => {
  const { areaNodeIds: _areas, dateOfBirth, thanaId, districtId, channelId, ...rest } = input;
  return {
    ...rest,
    nameBn: rest.nameBn ?? null,
    partnerCode: rest.partnerCode ?? null,
    category: rest.category ?? null,
    businessType: rest.businessType ?? null,
    outletGroup: rest.outletGroup ?? null,
    phone: rest.phone ?? null,
    ownerPhone: rest.ownerPhone ?? null,
    contactPerson: rest.contactPerson ?? null,
    ownerName: rest.ownerName ?? null,
    address: rest.address ?? null,
    tradeLicense: rest.tradeLicense ?? null,
    nid: rest.nid ?? null,
    email: rest.email ?? null,
    serial: rest.serial ?? null,
    maritalStatus: rest.maritalStatus ?? null,
    competitors: rest.competitors ?? null,
    competitorItems: rest.competitorItems ?? null,
    regularSales: rest.regularSales ?? null,
    salesPeriod: rest.salesPeriod ?? null,
    creditLimit: rest.creditLimit ?? null,
    latitude: rest.latitude ?? null,
    longitude: rest.longitude ?? null,
    dateOfBirth: dateOfBirth ? toDbDate(dateOfBirth) : null,
    thanaId: thanaId ?? null,
    districtId: districtId ?? null,
    channelId: channelId ?? null,
  };
};

/** The next free outlet code. `prefix` (RTM Configuration) is read before the transaction. */
async function nextOutletCode(tx: Tx, businessUnitId: string, prefix: string) {
  const count = await tx.rtmOutlet.count({ where: { businessUnitId } });
  for (let n = count + 1; ; n++) {
    const code = `${prefix}${String(n).padStart(5, "0")}`;
    if (!(await tx.rtmOutlet.findFirst({ where: { businessUnitId, code }, select: { id: true } }))) return code;
  }
}

/** Creates (PENDING approval) or edits an outlet. Returns its id. */
export async function saveOutlet(actor: Actor, raw: unknown, id?: string): Promise<{ id: string; code: string }> {
  const input = outletSchema.parse(raw);
  const distributor = await requireDistributor(actor, input.distributorId);
  const units = await unitIds(actor);
  const prefix = (await getSettings(distributor.businessUnitId)).outletCodePrefix;
  return db().$transaction(async (tx) => {
    const nodeIds = await checkRefs(tx, distributor.businessUnitId, input);
    if (input.partnerCode) {
      const clash = await tx.rtmOutlet.findFirst({ where: { businessUnitId: distributor.businessUnitId, partnerCode: input.partnerCode, ...(id ? { id: { not: id } } : {}) }, select: { code: true } });
      if (clash) throw badRequest(`Partner code ${input.partnerCode} is already used by outlet ${clash.code}.`);
    }
    let outlet: { id: string; code: string };
    if (id) {
      const existing = await tx.rtmOutlet.findFirst({ where: { id, businessUnitId: { in: units } }, select: { id: true, businessUnitId: true } });
      if (!existing) throw notFound("Outlet");
      if (existing.businessUnitId !== distributor.businessUnitId) throw badRequest("An outlet cannot move to another business unit's distributor.");
      outlet = await tx.rtmOutlet.update({ where: { id }, data: { ...profile(input), distributorId: distributor.id }, select: { id: true, code: true } });
      await tx.rtmOutletArea.deleteMany({ where: { outletId: id } });
    } else {
      outlet = await tx.rtmOutlet.create({
        data: { ...profile(input), distributorId: distributor.id, businessUnitId: distributor.businessUnitId, code: await nextOutletCode(tx, distributor.businessUnitId, prefix), approvalStatus: "PENDING", createdBy: actorName(actor) },
        select: { id: true, code: true },
      });
    }
    if (nodeIds.length) await tx.rtmOutletArea.createMany({ data: nodeIds.map((nodeId, i) => ({ outletId: outlet.id, nodeId, lineNo: i + 1 })) });
    return outlet;
  });
}

export async function setOutletActive(actor: Actor, id: string, raw: unknown) {
  const { isActive } = z.object({ isActive: z.boolean() }).parse(raw);
  const units = await unitIds(actor);
  const updated = await db().rtmOutlet.updateMany({ where: { id, businessUnitId: { in: units } }, data: { isActive } });
  if (!updated.count) throw notFound("Outlet");
}

/** Outlet Setup Approval. Approved outlets can take orders and deliveries. */
export async function reviewOutlet(actor: Actor, id: string, decision: "approve" | "reject") {
  const units = await unitIds(actor);
  const o = await db().rtmOutlet.findFirst({ where: { id, businessUnitId: { in: units } }, select: { id: true, code: true, businessUnitId: true, approvalStatus: true } });
  if (!o) throw notFound("Outlet");
  if (o.approvalStatus !== "PENDING") throw badRequest(`${o.code} is already ${o.approvalStatus === "APPROVED" ? "approved" : o.approvalStatus.toLowerCase()}.`);
  await decideWithPipeline(actor, { feature: "Outlet Setup Approval", documentId: id, businessUnitId: o.businessUnitId }, decision, async (tx) => {
    await tx.rtmOutlet.update({ where: { id }, data: { approvalStatus: decision === "approve" ? "APPROVED" : "REJECTED", approvedBy: actorName(actor) } });
  });
}

/** A rejected outlet, once corrected, is sent for approval again. */
export async function resubmitOutlet(actor: Actor, id: string) {
  const units = await unitIds(actor);
  const updated = await db().rtmOutlet.updateMany({ where: { id, businessUnitId: { in: units }, approvalStatus: "REJECTED" }, data: { approvalStatus: "PENDING", approvedBy: null } });
  if (!updated.count) throw badRequest("Only a rejected outlet can be sent for approval again.");
}

// ── Form options ─────────────────────────────────────────────────────────────

export async function outletFormOptions(actor: Actor) {
  const units = await unitIds(actor);
  const [districts, thanas, distributors, channels, used] = await Promise.all([
    db().district.findMany({ select: { id: true, name: true, division: true }, orderBy: { name: "asc" } }),
    db().thana.findMany({ select: { id: true, districtId: true, name: true }, orderBy: { name: "asc" } }),
    db().customer.findMany({ where: { businessUnitId: { in: units }, customerType: "DISTRIBUTOR", isActive: true }, select: { id: true, code: true, name: true }, orderBy: { name: "asc" } }),
    db().rtmChannel.findMany({ where: { businessUnitId: { in: units }, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db().rtmOutlet.findMany({ where: { businessUnitId: { in: units } }, select: { category: true, businessType: true, outletGroup: true }, distinct: ["category", "businessType", "outletGroup"], take: 500 }),
  ]);
  const values = (k: "category" | "businessType" | "outletGroup", base: string[]) => [...new Set([...base, ...used.map((u) => u[k]).filter((v): v is string => !!v)])].sort();
  return {
    divisions: [...new Set(districts.map((d) => d.division))].sort(),
    districts,
    thanas,
    distributors,
    channels,
    categories: values("category", ["Grocery", "Pharmacy", "Confectionery", "Cosmetics", "Super shop", "Tea stall", "Hotel / Restaurant", "Hardware", "Other"]),
    businessTypes: values("businessType", ["Retail", "Wholesale", "Retail & Wholesale"]),
    outletGroups: values("outletGroup", ["A", "B", "C"]),
  };
}

// ── Attachments (outlet image, other documents) ──────────────────────────────

const sanitizeFileName = (name: string) => (name.replace(/[\u0000-\u001f\u007f"\\/]/g, "_").trim() || "attachment").slice(0, 255);

async function loadOutlet(actor: Actor, outletId: string) {
  const units = await unitIds(actor);
  const o = await db().rtmOutlet.findFirst({ where: { id: outletId, businessUnitId: { in: units } }, select: { id: true } });
  if (!o) throw notFound("Outlet");
}

export async function listOutletAttachments(actor: Actor, outletId: string) {
  await loadOutlet(actor, outletId);
  const rows = await db().rtmOutletAttachment.findMany({ where: { outletId }, orderBy: { createdAt: "asc" }, select: { id: true, kind: true, originalName: true, mimeType: true, size: true, createdAt: true } });
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

export async function addOutletAttachment(actor: Actor, outletId: string, kind: string, file: Required<UploadedFile>) {
  await loadOutlet(actor, outletId);
  const k = kind === "IMAGE" ? "IMAGE" : "DOCUMENT";
  const mimeType = validateAttachment(file);
  if (k === "IMAGE" && !mimeType.startsWith("image/")) throw badRequest("The outlet image must be a PNG, JPEG or WebP picture.");
  if ((await db().rtmOutletAttachment.count({ where: { outletId } })) >= 20) throw badRequest("An outlet can have at most 20 files.");
  const storageKey = `rtm-outlets/${outletId}/${randomUUID()}`;
  await getStorage().put(storageKey, file.bytes);
  try {
    return await db().rtmOutletAttachment.create({ data: { outletId, kind: k, storageKey, originalName: sanitizeFileName(file.name), mimeType, size: file.size }, select: { id: true } });
  } catch (error) {
    await getStorage().delete(storageKey).catch(() => undefined);
    throw error;
  }
}

async function loadAttachment(actor: Actor, outletId: string, attachmentId: string) {
  await loadOutlet(actor, outletId);
  const a = await db().rtmOutletAttachment.findFirst({ where: { id: attachmentId, outletId } });
  if (!a) throw notFound("Attachment");
  return a;
}

export async function readOutletAttachment(actor: Actor, outletId: string, attachmentId: string) {
  const a = await loadAttachment(actor, outletId, attachmentId);
  const bytes = await getStorage().get(a.storageKey);
  if (!bytes) throw notFound("Attachment file");
  return { bytes, mimeType: a.mimeType, originalName: a.originalName };
}

export async function deleteOutletAttachment(actor: Actor, outletId: string, attachmentId: string) {
  const a = await loadAttachment(actor, outletId, attachmentId);
  await db().rtmOutletAttachment.delete({ where: { id: a.id } });
  await getStorage().delete(a.storageKey).catch(() => undefined);
}

// ── Bulk upload (Excel) ──────────────────────────────────────────────────────

const BULK_COLUMNS = [
  ["Outlet Name", "name"],
  ["Outlet Name (Bangla)", "nameBn"],
  ["Partner Code", "partnerCode"],
  ["Distributor Code", "distributor"],
  ["Market Code", "market"],
  ["Contact Number", "phone"],
  ["Owner Number", "ownerPhone"],
  ["Contact Person", "contactPerson"],
  ["Address", "address"],
  ["Outlet Category", "category"],
  ["Business Type", "businessType"],
  ["Outlet Group", "outletGroup"],
  ["Credit Limit", "creditLimit"],
] as const;

export async function outletTemplate(actor: Actor) {
  const units = await unitIds(actor);
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Outlets");
  sheet.addRow(BULK_COLUMNS.map(([h]) => h)).eachCell((c) => {
    c.font = { bold: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
  });
  sheet.columns = BULK_COLUMNS.map(([h]) => ({ width: Math.max(14, h.length + 4) }));
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  const [distributors, nodes] = await Promise.all([
    db().customer.findMany({ where: { businessUnitId: { in: units }, customerType: "DISTRIBUTOR", isActive: true }, select: { code: true, name: true }, orderBy: { code: "asc" } }),
    db().salesTerritoryNode.findMany({ where: { businessUnitId: { in: units }, isActive: true }, select: { code: true, name: true, layer: { select: { name: true, level: true } } }, orderBy: [{ layer: { level: "desc" } }, { code: "asc" }] }),
  ]);
  const ref = book.addWorksheet("Codes");
  ref.addRow(["Distributor Code", "Distributor", "", "Area Code", "Area", "Layer"]).font = { bold: true };
  for (let i = 0; i < Math.max(distributors.length, nodes.length); i++) {
    const d = distributors[i];
    const n = nodes[i];
    ref.addRow([d?.code ?? "", d?.name ?? "", "", n?.code ?? "", n?.name ?? "", n?.layer.name ?? ""]);
  }
  return new Uint8Array(await book.xlsx.writeBuffer());
}

/** Creates outlets (PENDING approval) from a sheet. Every row is checked first; nothing is saved when any row is wrong. */
export async function bulkCreateOutlets(actor: Actor, bytes: Uint8Array) {
  const units = await unitIds(actor);
  const book = await loadWorkbook(bytes);
  const sheet = book.worksheets[0];
  if (!sheet) throw badRequest("The workbook has no sheet.");
  const head = (sheet.getRow(1).values as unknown[]).slice(1).map((v) => String(v ?? "").trim().toLowerCase());
  const col = new Map(BULK_COLUMNS.map(([h, k]) => [k, head.indexOf(h.toLowerCase()) + 1]));
  for (const k of ["name", "distributor"] as const) if (!col.get(k)) throw badRequest(`The first row must have the column "${BULK_COLUMNS.find(([, key]) => key === k)![0]}".`);
  const get = (row: ExcelJS.Row, k: string) => {
    const c = col.get(k as never);
    if (!c) return "";
    const v = row.getCell(c).value;
    const plain = v && typeof v === "object" && "result" in v ? v.result : v && typeof v === "object" && "text" in v ? (v as { text: unknown }).text : v;
    return String(plain ?? "").trim();
  };
  const rows: { line: number; values: Record<string, string> }[] = [];
  sheet.eachRow((row, n) => {
    if (n === 1) return;
    const values = Object.fromEntries(BULK_COLUMNS.map(([, k]) => [k, get(row, k)]));
    if (Object.values(values).some(Boolean)) rows.push({ line: n, values });
  });
  if (!rows.length) throw badRequest("The sheet has no outlets.");
  if (rows.length > 5000) throw badRequest("Upload at most 5,000 outlets at a time.");
  const [distributors, nodes] = await Promise.all([
    db().customer.findMany({ where: { businessUnitId: { in: units }, customerType: "DISTRIBUTOR" }, select: { id: true, code: true, businessUnitId: true } }),
    db().salesTerritoryNode.findMany({ where: { businessUnitId: { in: units } }, select: { id: true, code: true, businessUnitId: true } }),
  ]);
  const dByCode = new Map(distributors.map((d) => [d.code.toLowerCase(), d]));
  const nByCode = new Map(nodes.map((n) => [`${n.businessUnitId}:${n.code.toLowerCase()}`, n]));
  const errors: string[] = [];
  const parsed: { businessUnitId: string; distributorId: string; nodeId: string | null; data: ReturnType<typeof profile> }[] = [];
  const partnerSeen = new Set<string>();
  for (const r of rows) {
    const d = dByCode.get(r.values.distributor.toLowerCase());
    if (!d) {
      errors.push(`Row ${r.line}: no distributor with code "${r.values.distributor}".`);
      continue;
    }
    const node = r.values.market ? nByCode.get(`${d.businessUnitId}:${r.values.market.toLowerCase()}`) : undefined;
    if (r.values.market && !node) errors.push(`Row ${r.line}: no area with code "${r.values.market}" in the distributor's business unit.`);
    const input = outletSchema.safeParse({ ...r.values, distributorId: d.id, areaNodeIds: [] });
    if (!input.success) {
      errors.push(`Row ${r.line}: ${input.error.issues[0]?.message ?? "invalid values"}`);
      continue;
    }
    if (input.data.partnerCode) {
      const key = `${d.businessUnitId}:${input.data.partnerCode.toLowerCase()}`;
      if (partnerSeen.has(key)) errors.push(`Row ${r.line}: partner code ${input.data.partnerCode} appears twice.`);
      partnerSeen.add(key);
    }
    parsed.push({ businessUnitId: d.businessUnitId, distributorId: d.id, nodeId: node?.id ?? null, data: profile(input.data) });
  }
  const partnerCodes = parsed.map((p) => p.data.partnerCode).filter((c): c is string => !!c);
  if (partnerCodes.length) {
    const taken = await db().rtmOutlet.findMany({ where: { businessUnitId: { in: units }, partnerCode: { in: partnerCodes } }, select: { partnerCode: true } });
    for (const t of taken) errors.push(`Partner code ${t.partnerCode} is already used by another outlet.`);
  }
  if (errors.length) throw badRequest(`${errors.length} row(s) need fixing: ${errors.slice(0, 8).join(" ")}${errors.length > 8 ? " …" : ""}`);
  const prefixes = new Map<string, string>();
  for (const unit of new Set(parsed.map((p) => p.businessUnitId))) prefixes.set(unit, (await getSettings(unit)).outletCodePrefix);
  await db().$transaction(
    async (tx) => {
      for (const p of parsed) {
        const o = await tx.rtmOutlet.create({
          data: { ...p.data, distributorId: p.distributorId, businessUnitId: p.businessUnitId, code: await nextOutletCode(tx, p.businessUnitId, prefixes.get(p.businessUnitId)!), approvalStatus: "PENDING", createdBy: actorName(actor) },
          select: { id: true },
        });
        if (p.nodeId) await tx.rtmOutletArea.create({ data: { outletId: o.id, nodeId: p.nodeId, lineNo: 1 } });
      }
    },
    { timeout: 120_000 },
  );
  return { created: parsed.length };
}
