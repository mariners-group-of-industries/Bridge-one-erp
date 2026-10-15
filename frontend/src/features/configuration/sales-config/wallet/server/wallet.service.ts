import { randomUUID } from "node:crypto";
import { validateAttachment, type UploadedFile } from "@/features/configuration/entity-master-data/supplier/server/supplier.service";
import { Prisma } from "@/generated/prisma/client";
import { badRequest, conflict, notFound } from "@/lib/api/errors";
import { assertCompanyAccess, type Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { getStorage } from "@/lib/storage";
import { walletInputSchema, walletListQuerySchema, type WalletDto, type WalletFormOptions, type WalletInput, type WalletList, type WalletListQuery } from "../schemas/wallet.schema";

// ─── Scoping & helpers ────────────────────────────────────────────────────────

function unitScope(actor: Actor): Prisma.BusinessUnitWhereInput {
  return actor.companyScope === "ALL" ? {} : { companyId: { in: [...actor.companyScope] } };
}

async function assertUnit(actor: Actor, businessUnitId: string) {
  const unit = await db().businessUnit.findUnique({ where: { id: businessUnitId }, select: { companyId: true } });
  if (!unit) throw notFound("Business unit");
  assertCompanyAccess(actor, unit.companyId, "Business unit");
}

async function loadWallet(actor: Actor, id: string) {
  const wallet = await db().salesWallet.findUnique({ where: { id }, include: { businessUnit: { select: { companyId: true } } } });
  if (!wallet) throw notFound("Wallet");
  assertCompanyAccess(actor, wallet.businessUnit.companyId, "Wallet");
  return wallet;
}

const orNull = (value: string) => (value === "" ? null : value);
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

function toDto(wallet: Awaited<ReturnType<typeof loadWallet>>): WalletDto {
  return {
    id: wallet.id,
    businessUnitId: wallet.businessUnitId,
    name: wallet.name,
    commissionPercent: Number(wallet.commissionPercent.toString()).toString(),
    isCash: wallet.isCash,
    bankAccountId: wallet.bankAccountId ?? "",
    officeId: wallet.officeId ?? "",
    referenceCode: wallet.referenceCode ?? "",
    isRounding: wallet.isRounding,
    isCoupon: wallet.isCoupon,
    isWalletCharge: wallet.isWalletCharge,
    isReferenceRequired: wallet.isReferenceRequired,
    isMfs: wallet.isMfs,
    isActive: wallet.isActive,
    attachment: wallet.attachmentKey ? { name: wallet.attachmentName ?? "attachment", type: wallet.attachmentType ?? "", size: wallet.attachmentSize ?? 0 } : null,
  };
}

// ─── List & read ──────────────────────────────────────────────────────────────

export async function listWallets(actor: Actor, input: WalletListQuery): Promise<WalletList> {
  const query = walletListQuerySchema.parse(input);
  const search = query.search ? { contains: escapeLike(query.search), mode: "insensitive" as const } : undefined;
  const where: Prisma.SalesWalletWhereInput = {
    businessUnit: unitScope(actor),
    ...(search ? { OR: [{ name: search }, { referenceCode: search }, { bankAccount: { accountNumber: search } }] } : {}),
  };
  const [total, wallets] = await Promise.all([
    db().salesWallet.count({ where }),
    db().salesWallet.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: { bankAccount: { select: { accountNumber: true } } },
    }),
  ]);
  return {
    rows: wallets.map((w) => ({
      id: w.id,
      name: w.name,
      commissionPercent: Number(w.commissionPercent.toString()).toString(),
      isCash: w.isCash,
      accountNo: w.bankAccount?.accountNumber ?? null,
      referenceCode: w.referenceCode,
      isRounding: w.isRounding,
      isCoupon: w.isCoupon,
      isWalletCharge: w.isWalletCharge,
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function getWallet(actor: Actor, id: string): Promise<WalletDto> {
  return toDto(await loadWallet(actor, id));
}

export async function getWalletFormOptions(actor: Actor): Promise<WalletFormOptions> {
  const [businessUnits, offices, bankAccounts] = await Promise.all([
    db().businessUnit.findMany({ where: unitScope(actor), orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db().office.findMany({ where: { businessUnit: unitScope(actor) }, orderBy: { name: "asc" }, select: { id: true, name: true, businessUnitId: true } }),
    // Bank accounts belong to Accounts and are shared by every business unit.
    db().bankAccount.findMany({ where: { isActive: true }, orderBy: [{ bankName: "asc" }, { accountNumber: "asc" }], select: { id: true, accountNumber: true, bankName: true, branchName: true } }),
  ]);
  return { businessUnits, offices, bankAccounts };
}

// ─── Save & delete ────────────────────────────────────────────────────────────

async function toData(actor: Actor, input: WalletInput) {
  const data = walletInputSchema.parse(input);
  await assertUnit(actor, data.businessUnitId);
  if (data.officeId) {
    const office = await db().office.findUnique({ where: { id: data.officeId }, select: { businessUnitId: true } });
    if (office?.businessUnitId !== data.businessUnitId) throw badRequest("Select an office of this business unit.");
  }
  const bankAccountId = data.isCash ? null : data.bankAccountId;
  if (bankAccountId && !(await db().bankAccount.findFirst({ where: { id: bankAccountId, isActive: true }, select: { id: true } }))) {
    throw badRequest("Select an active bank account.");
  }
  return {
    businessUnitId: data.businessUnitId,
    name: data.name,
    commissionPercent: data.commissionPercent,
    isCash: data.isCash,
    bankAccountId,
    officeId: orNull(data.officeId),
    referenceCode: orNull(data.referenceCode),
    isRounding: data.isRounding,
    isCoupon: data.isCoupon,
    isWalletCharge: data.isWalletCharge,
    isReferenceRequired: data.isReferenceRequired,
    isMfs: data.isMfs,
  };
}

const duplicate = (error: unknown, name: string) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return conflict(`A wallet named "${name}" already exists.`);
  return error;
};

export async function createWallet(actor: Actor, input: WalletInput): Promise<WalletDto> {
  const data = await toData(actor, input);
  try {
    const created = await db().salesWallet.create({ data });
    return getWallet(actor, created.id);
  } catch (error) {
    throw duplicate(error, data.name);
  }
}

export async function updateWallet(actor: Actor, id: string, input: WalletInput): Promise<WalletDto> {
  await loadWallet(actor, id);
  const data = await toData(actor, input);
  try {
    await db().salesWallet.update({ where: { id }, data });
  } catch (error) {
    throw duplicate(error, data.name);
  }
  return getWallet(actor, id);
}

export async function deleteWallet(actor: Actor, id: string): Promise<void> {
  const wallet = await loadWallet(actor, id);
  await db().salesWallet.delete({ where: { id } });
  if (wallet.attachmentKey)
    await getStorage()
      .delete(wallet.attachmentKey)
      .catch(() => undefined);
}

// ─── Attachment (one per wallet) ──────────────────────────────────────────────

const sanitizeFileName = (name: string) => (name.replace(/[\u0000-\u001f\u007f"\\/]/g, "_").trim() || "attachment").slice(0, 255);

/** Stores the file, replacing any earlier attachment. */
export async function setWalletAttachment(actor: Actor, id: string, file: Required<UploadedFile>): Promise<WalletDto> {
  const wallet = await loadWallet(actor, id);
  const mimeType = validateAttachment(file);
  const storageKey = `wallets/${id}/${randomUUID()}`;
  await getStorage().put(storageKey, file.bytes);
  try {
    await db().salesWallet.update({
      where: { id },
      data: { attachmentKey: storageKey, attachmentName: sanitizeFileName(file.name), attachmentType: mimeType, attachmentSize: file.size },
    });
  } catch (error) {
    await getStorage()
      .delete(storageKey)
      .catch(() => undefined);
    throw error;
  }
  if (wallet.attachmentKey)
    await getStorage()
      .delete(wallet.attachmentKey)
      .catch(() => undefined);
  return getWallet(actor, id);
}

export async function readWalletAttachment(actor: Actor, id: string) {
  const wallet = await loadWallet(actor, id);
  if (!wallet.attachmentKey) throw notFound("Attachment");
  const bytes = await getStorage().get(wallet.attachmentKey);
  if (!bytes) throw notFound("Attachment file");
  return { bytes, mimeType: wallet.attachmentType ?? "application/octet-stream", originalName: wallet.attachmentName ?? "attachment" };
}

export async function removeWalletAttachment(actor: Actor, id: string): Promise<void> {
  const wallet = await loadWallet(actor, id);
  if (!wallet.attachmentKey) return;
  await db().salesWallet.update({ where: { id }, data: { attachmentKey: null, attachmentName: null, attachmentType: null, attachmentSize: null } });
  await getStorage()
    .delete(wallet.attachmentKey)
    .catch(() => undefined);
}
