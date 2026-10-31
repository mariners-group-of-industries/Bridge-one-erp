import { randomUUID } from "node:crypto";
import { validateAttachment, type UploadedFile } from "@/features/configuration/entity-master-data/supplier/server/supplier.service";
import { notFound } from "@/lib/api/errors";
import { assertCompanyAccess, type Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { getStorage } from "@/lib/storage";
import type { OrderAttachment } from "../schemas/order.schema";

// Sales order attachments (the paperclip on the order form): PDF or images, 5 MB each,
// same rules and storage as customer / supplier attachments.

const SELECT = { id: true, originalName: true, mimeType: true, size: true, createdAt: true } as const;

const sanitizeFileName = (name: string) =>
  (name.replace(/[\u0000-\u001f\u007f"\\/]/g, "_").trim() || "attachment").slice(0, 255);

async function requireOrder(actor: Actor, orderId: string) {
  const order = await db().salesOrder.findUnique({ where: { id: orderId }, select: { businessUnit: { select: { companyId: true } } } });
  if (!order) throw notFound("Sales order");
  assertCompanyAccess(actor, order.businessUnit.companyId, "Sales order");
}

export async function addOrderAttachment(actor: Actor, orderId: string, file: Required<UploadedFile>): Promise<OrderAttachment> {
  await requireOrder(actor, orderId);
  const mimeType = validateAttachment(file);
  const storageKey = `sales-orders/${orderId}/${randomUUID()}`;
  await getStorage().put(storageKey, file.bytes);
  try {
    const record = await db().salesOrderAttachment.create({
      data: { orderId, storageKey, originalName: sanitizeFileName(file.name), mimeType, size: file.size },
      select: SELECT,
    });
    return { ...record, createdAt: record.createdAt.toISOString() };
  } catch (error) {
    await getStorage().delete(storageKey).catch(() => undefined);
    throw error;
  }
}

async function loadAttachment(actor: Actor, orderId: string, attachmentId: string) {
  await requireOrder(actor, orderId);
  const attachment = await db().salesOrderAttachment.findFirst({ where: { id: attachmentId, orderId } });
  if (!attachment) throw notFound("Attachment");
  return attachment;
}

export async function readOrderAttachment(actor: Actor, orderId: string, attachmentId: string) {
  const attachment = await loadAttachment(actor, orderId, attachmentId);
  const bytes = await getStorage().get(attachment.storageKey);
  if (!bytes) throw notFound("Attachment file");
  return { bytes, mimeType: attachment.mimeType, originalName: attachment.originalName };
}

export async function deleteOrderAttachment(actor: Actor, orderId: string, attachmentId: string): Promise<void> {
  const attachment = await loadAttachment(actor, orderId, attachmentId);
  await db().salesOrderAttachment.delete({ where: { id: attachment.id } });
  await getStorage().delete(attachment.storageKey).catch(() => undefined);
}
