import { createHash } from "node:crypto";
import type { ObjectStorage } from "./index";

const SAFE_KEY = /^[a-zA-Z0-9][a-zA-Z0-9/_.-]*$/;

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  /** Folder every object goes under, e.g. "bridgeone". */
  folder: string;
}

/** Reads CLOUDINARY_URL (cloudinary://key:secret@cloud) or the three separate variables. */
export function cloudinaryConfigFromEnv(env: NodeJS.ProcessEnv = process.env): CloudinaryConfig {
  const url = env.CLOUDINARY_URL?.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  const cloudName = url?.[3] ?? env.CLOUDINARY_CLOUD_NAME ?? "";
  const apiKey = url?.[1] ?? env.CLOUDINARY_API_KEY ?? "";
  const apiSecret = url?.[2] ?? env.CLOUDINARY_API_SECRET ?? "";
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("STORAGE_DRIVER is cloudinary but CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET (or CLOUDINARY_URL) are not set.");
  }
  return { cloudName, apiKey, apiSecret, folder: (env.CLOUDINARY_FOLDER || "bridgeone").replace(/^\/+|\/+$/g, "") };
}

/** Cloudinary request signature: SHA-1 of the sorted parameters followed by the API secret. */
export function signCloudinary(params: Record<string, string>, apiSecret: string): string {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash("sha1").update(payload + apiSecret).digest("hex");
}

/**
 * Stores objects in Cloudinary as "raw" files, so any file type (images, PDFs …)
 * is kept byte for byte. Keys contain random ids and are never sent to browsers:
 * files are still served through the ERP's own authorised API routes.
 */
export class CloudinaryStorage implements ObjectStorage {
  private readonly config: CloudinaryConfig;
  private readonly fetchImpl: typeof fetch;

  constructor(config: CloudinaryConfig, fetchImpl: typeof fetch = fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  private publicId(key: string): string {
    if (!SAFE_KEY.test(key) || key.includes("..")) throw new Error(`Invalid storage key "${key}".`);
    // Stored without a file extension: Cloudinary accounts may block extensions such as
    // .pdf. The ERP keeps each file's real type in its own records.
    return `${this.config.folder}/${key.replace(/\./g, "_")}`;
  }

  private async call(action: "upload" | "destroy", params: Record<string, string>, file?: Uint8Array) {
    const signed = { ...params, timestamp: String(Math.floor(Date.now() / 1000)) };
    const form = new FormData();
    for (const [key, value] of Object.entries(signed)) form.set(key, value);
    form.set("api_key", this.config.apiKey);
    form.set("signature", signCloudinary(signed, this.config.apiSecret));
    if (file) form.set("file", new Blob([new Uint8Array(file)]), "file");
    const response = await this.fetchImpl(`https://api.cloudinary.com/v1_1/${this.config.cloudName}/raw/${action}`, { method: "POST", body: form });
    const body = (await response.json().catch(() => ({}))) as { error?: { message?: string }; result?: string; existing?: boolean };
    if (!response.ok || body.error) throw new Error(`Cloudinary ${action} failed: ${body.error?.message ?? `HTTP ${response.status}`}`);
    return body;
  }

  /**
   * Keys are write-once (every upload in the ERP gets a new random key): Cloudinary's
   * CDN keeps serving the first file of a name, so overwriting would return stale data.
   */
  async put(key: string, data: Uint8Array): Promise<void> {
    const result = await this.call("upload", { public_id: this.publicId(key), overwrite: "false" }, data);
    if (result.existing) throw new Error(`Storage key "${key}" already exists; use a new key for a new file.`);
  }

  async get(key: string): Promise<Uint8Array | null> {
    const id = this.publicId(key).split("/").map(encodeURIComponent).join("/");
    const response = await this.fetchImpl(`https://res.cloudinary.com/${this.config.cloudName}/raw/upload/${id}`, { cache: "no-store" });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Cloudinary download failed: HTTP ${response.status}`);
    return new Uint8Array(await response.arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    // "not found" is fine: the object is gone either way.
    await this.call("destroy", { public_id: this.publicId(key), invalidate: "true" });
  }
}
