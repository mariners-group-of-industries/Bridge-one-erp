import { CloudinaryStorage, cloudinaryConfigFromEnv } from "./cloudinary";
import { LocalDiskStorage } from "./local-disk";
import { R2Storage, r2ConfigFromEnv } from "./r2";

/**
 * Object storage abstraction for binary files (logos, document headers, attachments ...).
 * Binary data never goes into PostgreSQL; only the storage key or CDN URL is persisted.
 */
export interface ObjectStorage {
  put(key: string, data: Uint8Array, contentType?: string): Promise<string | void>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
}

let storage: ObjectStorage | undefined;

export function getStorage(): ObjectStorage {
  if (storage) return storage;

  const driver = process.env.STORAGE_DRIVER ?? "local";
  switch (driver) {
    case "r2":
    case "s3": {
      const r2Cfg = r2ConfigFromEnv();
      if (!r2Cfg) {
        console.warn("[Storage] STORAGE_DRIVER is r2/s3 but R2 credentials are missing, falling back to local disk.");
        storage = new LocalDiskStorage(process.env.STORAGE_LOCAL_DIR);
        return storage;
      }
      storage = new R2Storage(r2Cfg);
      return storage;
    }
    case "cloudinary":
      // Use this on serverless hosting (Vercel), where the local disk is not kept.
      storage = new CloudinaryStorage(cloudinaryConfigFromEnv());
      return storage;
    case "local":
    default:
      storage = new LocalDiskStorage(process.env.STORAGE_LOCAL_DIR);
      return storage;
  }
}

/** Test hook to inject an in-memory implementation. */
export function setStorage(next: ObjectStorage | undefined): void {
  storage = next;
}
