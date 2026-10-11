import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ObjectStorage } from "./index";

const SAFE_KEY = /^[a-zA-Z0-9][a-zA-Z0-9/_.-]*$/;

/**
 * Stores objects on the local filesystem, outside the public directory.
 * Suitable for development and single-server deployments only: serverless
 * platforms do not persist the local filesystem.
 */
export class LocalDiskStorage implements ObjectStorage {
  private readonly root: string;

  constructor(root?: string) {
    // Runtime-configured directory; keep it out of build output tracing.
    this.root = path.resolve(/*turbopackIgnore: true*/ root || path.join(process.cwd(), ".storage"));
  }

  private resolve(key: string): string {
    if (!SAFE_KEY.test(key) || key.includes("..")) {
      throw new Error(`Invalid storage key "${key}".`);
    }
    const resolved = path.resolve(/*turbopackIgnore: true*/ this.root, key);
    if (!resolved.startsWith(this.root + path.sep)) {
      throw new Error(`Invalid storage key "${key}".`);
    }
    return resolved;
  }

  async put(key: string, data: Uint8Array): Promise<void> {
    const file = this.resolve(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, data);
  }

  async get(key: string): Promise<Uint8Array | null> {
    try {
      return await readFile(this.resolve(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }
}
