import { randomUUID } from "node:crypto";
import { AppError, notFound } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { getStorage } from "@/lib/storage";
import {
  ALLOWED_ASSET_MIME_TYPES,
  MAX_ASSET_BYTES,
  type AllowedAssetMimeType,
  type OfficeAssetKind,
} from "../schemas/office.schema";
import type { OfficeAssetDto } from "../types";
import { loadOffice } from "./access";
import { removeStoredObjects, toAssetDto } from "./office.service";

const EXTENSIONS: Record<AllowedAssetMimeType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/** Detects the real image type from magic bytes; never trust the client's MIME type. */
export function sniffImageType(bytes: Uint8Array): AllowedAssetMimeType | null {
  const startsWith = (signature: number[], offset = 0) =>
    signature.every((byte, index) => bytes[offset + index] === byte);

  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) {
    return "image/webp";
  }
  return null;
}

export interface UploadedFile {
  name: string;
  type: string;
  size: number;
  bytes: Uint8Array;
}

export function validateAssetFile(file: Omit<UploadedFile, "bytes"> & { bytes?: Uint8Array }) {
  if (file.size === 0) {
    throw new AppError(400, "VALIDATION_ERROR", "The selected file is empty.");
  }
  if (file.size > MAX_ASSET_BYTES) {
    throw new AppError(413, "PAYLOAD_TOO_LARGE", "Files must be 2 MB or smaller.");
  }
  if (!(ALLOWED_ASSET_MIME_TYPES as readonly string[]).includes(file.type)) {
    throw new AppError(415, "UNSUPPORTED_MEDIA_TYPE", "Only PNG, JPEG or WebP images are allowed.");
  }
  if (file.bytes) {
    const detected = sniffImageType(file.bytes);
    if (!detected || detected !== file.type) {
      throw new AppError(
        415,
        "UNSUPPORTED_MEDIA_TYPE",
        "The file content does not match a PNG, JPEG or WebP image.",
      );
    }
    return detected;
  }
  return file.type as AllowedAssetMimeType;
}

function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[\u0000-\u001f\u007f"\\/]/g, "_").trim();
  return (cleaned || "upload").slice(0, 255);
}

/** Uploads a new branding asset for an office, replacing any existing one of the same kind. */
export async function putOfficeAsset(
  actor: Actor,
  officeId: string,
  kind: OfficeAssetKind,
  file: UploadedFile,
): Promise<OfficeAssetDto> {
  await loadOffice(actor, officeId);
  const mimeType = validateAssetFile(file);

  const storage = getStorage();
  const storageKey = `offices/${officeId}/${kind.toLowerCase()}-${randomUUID()}.${EXTENSIONS[mimeType]}`;
  await storage.put(storageKey, file.bytes);

  let previousKey: string | undefined;
  try {
    const asset = await db().$transaction(async (tx) => {
      await loadOffice(actor, officeId, tx);
      const previous = await tx.officeAsset.findUnique({
        where: { officeId_kind: { officeId, kind } },
        select: { storageKey: true },
      });
      previousKey = previous?.storageKey;
      const data = {
        storageKey,
        originalName: sanitizeFileName(file.name),
        mimeType,
        sizeBytes: file.size,
      };
      return tx.officeAsset.upsert({
        where: { officeId_kind: { officeId, kind } },
        create: { officeId, kind, ...data },
        update: data,
      });
    });
    if (previousKey) await removeStoredObjects([previousKey]);
    return toAssetDto(asset);
  } catch (error) {
    await removeStoredObjects([storageKey]);
    throw error;
  }
}

export async function deleteOfficeAsset(
  actor: Actor,
  officeId: string,
  kind: OfficeAssetKind,
): Promise<void> {
  const storageKey = await db().$transaction(async (tx) => {
    await loadOffice(actor, officeId, tx);
    const asset = await tx.officeAsset.findUnique({
      where: { officeId_kind: { officeId, kind } },
      select: { id: true, storageKey: true },
    });
    if (!asset) throw notFound("Asset");
    await tx.officeAsset.delete({ where: { id: asset.id } });
    return asset.storageKey;
  });
  await removeStoredObjects([storageKey]);
}

export async function readOfficeAsset(actor: Actor, officeId: string, kind: OfficeAssetKind) {
  await loadOffice(actor, officeId);
  const asset = await db().officeAsset.findUnique({
    where: { officeId_kind: { officeId, kind } },
  });
  if (!asset) throw notFound("Asset");
  const bytes = await getStorage().get(asset.storageKey);
  if (!bytes) throw notFound("Asset file");
  return { bytes, mimeType: asset.mimeType, originalName: asset.originalName };
}
