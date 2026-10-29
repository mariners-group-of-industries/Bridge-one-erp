import { CloudinaryStorage, cloudinaryConfigFromEnv } from "./cloudinary";
import { LocalDiskStorage } from "./local-disk";

/**
 * Object storage abstraction for binary files (logos, document headers, ...).
 * Binary data never goes into PostgreSQL; only the storage key is persisted.
 */
export interface ObjectStorage {
  put(key: string, data: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
}

let storage: ObjectStorage | undefined;

export function getStorage(): ObjectStorage {
  if (storage) return storage;

  const driver = process.env.STORAGE_DRIVER ?? "local";
  switch (driver) {
    case "local":
      storage = new LocalDiskStorage(process.env.STORAGE_LOCAL_DIR);
      return storage;
    case "cloudinary":
      // Use this on serverless hosting (Vercel), where the local disk is not kept.
      storage = new CloudinaryStorage(cloudinaryConfigFromEnv());
      return storage;
    default:
      // S3-compatible drivers (AWS S3, Cloudflare R2, ...) plug in here.
      throw new Error(`Unsupported STORAGE_DRIVER "${driver}".`);
  }
}

/** Test hook to inject an in-memory implementation. */
export function setStorage(next: ObjectStorage | undefined): void {
  storage = next;
}
