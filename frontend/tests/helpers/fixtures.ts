import type { Actor, Permission } from "@/lib/auth/actor";
import type { ObjectStorage } from "@/lib/storage";

export const adminActor: Actor = {
  id: "test-admin",
  role: "ADMINISTRATOR",
  permissions: new Set<Permission>(["configuration:read", "configuration:write"]),
  companyScope: "ALL",
};

export function scopedActor(companyIds: string[]): Actor {
  return { ...adminActor, id: "test-scoped", companyScope: companyIds };
}

export class MemoryStorage implements ObjectStorage {
  readonly objects = new Map<string, Uint8Array>();
  async put(key: string, data: Uint8Array) {
    this.objects.set(key, data);
  }
  async get(key: string) {
    return this.objects.get(key) ?? null;
  }
  async delete(key: string) {
    this.objects.delete(key);
  }
}

/** Minimal valid-signature PNG bytes (content after the header is irrelevant to validation). */
export function pngBytes(size = 64): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return bytes;
}

export const companyInput = {
  name: "Mariners Group",
  address: "House 1, Road 2, Dhaka",
  email: "info@mariners.example",
};

export const businessUnitInput = {
  name: "Mariners Trading",
  address: "Gulshan, Dhaka",
  contactNumber: "+880 1700-000000",
  email: "trading@mariners.example",
  dateFormat: "DD_MM_YYYY_SLASH" as const,
};

export const officeInput = {
  name: "Head Office",
  address: "Gulshan Avenue, Dhaka",
  email: "ho@mariners.example",
  phone: "+880 2 000000",
  binNumber: "000123456-0101",
};
