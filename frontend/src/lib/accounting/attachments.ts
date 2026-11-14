import { randomUUID } from "node:crypto";
import { validateAttachment } from "@/features/configuration/entity-master-data/supplier/server/supplier.service";
import { badRequest, notFound } from "@/lib/api/errors";
import { db } from "@/lib/prisma/client";
import { getStorage } from "@/lib/storage";

/**
 * Files attached to journal vouchers and expenses (iBOS "Attachment"). The same
 * rules as supplier attachments apply: PDF, PNG, JPEG or WebP, at most 5 MB, and
 * the content must match the declared type. The bytes go to object storage; the
 * record keeps the key so downloads stay behind the API's permission check.
 */

const sanitize = (name: string) => name.replace(/[^\w.\- ()]/g, "_").slice(0, 200) || "attachment";

/** Saves a multipart `file` field and returns the attachment record. */
export async function saveAccountsAttachment(request: Request, folder: "journal" | "expenses", createdBy: string) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw badRequest("Expected a multipart/form-data upload.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw badRequest("A file is required.");
  // Reject on declared size and type before reading the content.
  validateAttachment({ name: file.name, type: file.type, size: file.size });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = validateAttachment({ name: file.name, type: file.type, size: bytes.byteLength, bytes });

  const storageKey = `accounts/${folder}/${randomUUID()}`;
  await getStorage().put(storageKey, bytes);
  try {
    return await db().accountsAttachment.create({
      data: { storageKey, originalName: sanitize(file.name), mimeType, size: bytes.byteLength, createdBy },
      select: { id: true, originalName: true, mimeType: true, size: true },
    });
  } catch (error) {
    await getStorage().delete(storageKey).catch(() => undefined);
    throw error;
  }
}

/** Streams an attachment back as a download. */
export async function accountsAttachmentResponse(id: string) {
  const record = await db().accountsAttachment.findUnique({ where: { id } }).catch(() => null);
  if (!record) throw notFound("Attachment");
  const bytes = await getStorage().get(record.storageKey);
  if (!bytes) throw notFound("Attachment file");
  return new Response(new Blob([new Uint8Array(bytes)], { type: record.mimeType }), {
    headers: {
      "Content-Type": record.mimeType,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(record.originalName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
