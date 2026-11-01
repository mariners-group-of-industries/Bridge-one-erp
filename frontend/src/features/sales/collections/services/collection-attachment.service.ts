import { randomUUID } from "node:crypto";
import { validateAttachment, type UploadedFile } from "@/features/configuration/entity-master-data/supplier/server/supplier.service";
import { notFound } from "@/lib/api/errors";
import { assertCompanyAccess, type Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { getStorage } from "@/lib/storage";
import type { CollectionAttachment } from "../schemas/collection.schema";

// Sales collection attachments (the Advance Collection paperclip): PDF or images, 5 MB each,
// same rules and storage as customer / supplier attachments.

const SELECT = { id: true, originalName: true, mimeType: true, size: true, createdAt: true } as const;

const sanitizeFileName = (name: string) =>
  (name.replace(/[\u0000-\u001f\u007f"\\/]/g, "_").trim() || "attachment").slice(0, 255);

async function requireCollection(actor: Actor, collectionId: string) {
  const collection = await db().salesCollection.findUnique({ where: { id: collectionId }, select: { businessUnit: { select: { companyId: true } } } });
  if (!collection) throw notFound("Collection");
  assertCompanyAccess(actor, collection.businessUnit.companyId, "Collection");
}

export async function addCollectionAttachment(actor: Actor, collectionId: string, file: Required<UploadedFile>): Promise<CollectionAttachment> {
  await requireCollection(actor, collectionId);
  const mimeType = validateAttachment(file);
  const storageKey = `sales-collections/${collectionId}/${randomUUID()}`;
  await getStorage().put(storageKey, file.bytes);
  try {
    const record = await db().salesCollectionAttachment.create({
      data: { collectionId, storageKey, originalName: sanitizeFileName(file.name), mimeType, size: file.size },
      select: SELECT,
    });
    return { ...record, createdAt: record.createdAt.toISOString() };
  } catch (error) {
    await getStorage().delete(storageKey).catch(() => undefined);
    throw error;
  }
}

async function loadAttachment(actor: Actor, collectionId: string, attachmentId: string) {
  await requireCollection(actor, collectionId);
  const attachment = await db().salesCollectionAttachment.findFirst({ where: { id: attachmentId, collectionId } });
  if (!attachment) throw notFound("Attachment");
  return attachment;
}

export async function readCollectionAttachment(actor: Actor, collectionId: string, attachmentId: string) {
  const attachment = await loadAttachment(actor, collectionId, attachmentId);
  const bytes = await getStorage().get(attachment.storageKey);
  if (!bytes) throw notFound("Attachment file");
  return { bytes, mimeType: attachment.mimeType, originalName: attachment.originalName };
}

export async function deleteCollectionAttachment(actor: Actor, collectionId: string, attachmentId: string): Promise<void> {
  const attachment = await loadAttachment(actor, collectionId, attachmentId);
  await db().salesCollectionAttachment.delete({ where: { id: attachment.id } });
  await getStorage().delete(attachment.storageKey).catch(() => undefined);
}
